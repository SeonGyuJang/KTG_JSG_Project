from flask import Flask, render_template, request, jsonify, session, redirect
from werkzeug.utils import secure_filename
from datetime import datetime
import sqlite3
import os
import hashlib

app = Flask(__name__)
app.secret_key = 'korea-university-marketplace-secret-key-2025'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB 전체 요청 크기
app.config['MAX_IMAGES_PER_POST'] = 5  # 게시글당 최대 이미지 수
app.config['MAX_IMAGE_SIZE'] = 10 * 1024 * 1024  # 이미지당 10MB

# 업로드 폴더 생성
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 데이터베이스 초기화
def init_db():
    conn = sqlite3.connect('marketplace.db')
    c = conn.cursor()
    
    # 사용자 테이블 생성 (IF NOT EXISTS)
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            student_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # is_admin 컬럼이 없으면 추가
    c.execute("PRAGMA table_info(users)")
    columns = {row[1]: row for row in c.fetchall()}
    if 'is_admin' not in columns:
        c.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')
    
    # 게시글 테이블
    c.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            price INTEGER NOT NULL,
            category TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            status TEXT DEFAULT 'sale',
            views INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    ''')
    
    # 이미지 테이블
    c.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            upload_order INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )
    ''')
    
    # 테스트 계정 추가 (비밀번호: test1234)
    try:
        c.execute('''
            INSERT INTO users (email, password, name, student_id, is_admin)
            VALUES (?, ?, ?, ?, ?)
        ''', ('test@korea.ac.kr', hashlib.sha256('test1234'.encode()).hexdigest(), '김고려', '2021123456', 0))
    except sqlite3.IntegrityError:
        # 이미 존재하면 is_admin 업데이트
        c.execute('UPDATE users SET is_admin = 0 WHERE email = ?', ('test@korea.ac.kr',))
    
    # 관리자 계정 추가 (비밀번호: admin1234)
    try:
        c.execute('''
            INSERT INTO users (email, password, name, student_id, is_admin)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin@korea.ac.kr', hashlib.sha256('admin1234'.encode()).hexdigest(), '관리자', '0000000000', 1))
    except sqlite3.IntegrityError:
        # 이미 존재하면 is_admin 업데이트
        c.execute('UPDATE users SET is_admin = 1 WHERE email = ?', ('admin@korea.ac.kr',))
    
    conn.commit()
    conn.close()

# 데이터베이스 연결
def get_db():
    conn = sqlite3.connect('marketplace.db')
    conn.row_factory = sqlite3.Row
    return conn

# 앱 시작 시 데이터베이스 초기화
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    if 'user_id' not in session:
        return redirect('/')
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    if not user or user['is_admin'] != 1:
        return redirect('/')
    return render_template('admin.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ? AND password = ?', 
                       (email, password_hash)).fetchone()
    conn.close()
    
    if user:
        session['user_id'] = user['id']
        session['user_email'] = user['email']
        session['is_admin'] = user['is_admin']
        return jsonify({
            'success': True,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'student_id': user['student_id'],
                'is_admin': user['is_admin']
            }
        })
    return jsonify({'success': False, 'message': '이메일 또는 비밀번호가 올바르지 않습니다.'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    student_id = data.get('student_id')
    
    if not email.endswith('@korea.ac.kr'):
        return jsonify({'success': False, 'message': '고려대학교 이메일만 가입 가능합니다.'})
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        conn = get_db()
        conn.execute('INSERT INTO users (email, password, name, student_id, is_admin) VALUES (?, ?, ?, ?, ?)',
                    (email, password_hash, name, student_id, 0))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '회원가입이 완료되었습니다.'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': '이미 가입된 이메일입니다.'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/posts', methods=['GET'])
def get_posts():
    category = request.args.get('category', 'all')
    search = request.args.get('search', '')
    
    conn = get_db()
    
    query = '''
        SELECT p.*, u.name as author_name, u.email as author_email,
               GROUP_CONCAT(i.file_path) as images
        FROM posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN images i ON p.id = i.post_id
        WHERE 1=1
    '''
    params = []
    
    if category != 'all':
        query += ' AND p.category = ?'
        params.append(category)
    
    if search:
        query += ' AND (p.title LIKE ? OR p.content LIKE ?)'
        params.extend([f'%{search}%', f'%{search}%'])
    
    query += ' GROUP BY p.id ORDER BY p.created_at DESC'
    
    posts = conn.execute(query, params).fetchall()
    conn.close()
    
    posts_list = []
    for post in posts:
        post_dict = dict(post)
        post_dict['author'] = post['author_name']
        post_dict['images'] = post['images'].split(',') if post['images'] else []
        posts_list.append(post_dict)
    
    return jsonify({'success': True, 'posts': posts_list})

@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    conn = get_db()
    
    # 조회수 증가
    conn.execute('UPDATE posts SET views = views + 1 WHERE id = ?', (post_id,))
    conn.commit()
    
    post = conn.execute('''
        SELECT p.*, u.name as author_name, u.email as author_email
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = ?
    ''', (post_id,)).fetchone()
    
    if not post:
        conn.close()
        return jsonify({'success': False, 'message': '게시글을 찾을 수 없습니다.'})
    
    images = conn.execute('''
        SELECT file_path, file_size FROM images 
        WHERE post_id = ? 
        ORDER BY upload_order
    ''', (post_id,)).fetchall()
    
    conn.close()
    
    post_dict = dict(post)
    post_dict['author'] = post['author_name']
    post_dict['images'] = [dict(img) for img in images]
    
    return jsonify({'success': True, 'post': post_dict})

@app.route('/api/posts', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    # 데이터 받기
    title = request.form.get('title')
    content = request.form.get('content')
    price = request.form.get('price')
    category = request.form.get('category')
    
    if not all([title, content, price, category]):
        return jsonify({'success': False, 'message': '필수 항목을 모두 입력해주세요.'})
    
    # 이미지 파일 처리
    uploaded_files = request.files.getlist('images')
    
    # 이미지 개수 체크
    if len(uploaded_files) > app.config['MAX_IMAGES_PER_POST']:
        return jsonify({'success': False, 'message': f'최대 {app.config["MAX_IMAGES_PER_POST"]}개까지 업로드 가능합니다.'})
    
    # 이미지 크기 체크 및 저장
    saved_files = []
    total_size = 0
    
    for idx, file in enumerate(uploaded_files):
        if file and file.filename:
            if not allowed_file(file.filename):
                # 이미 저장된 파일 삭제
                for saved_file in saved_files:
                    try:
                        os.remove(saved_file['path'])
                    except:
                        pass
                return jsonify({'success': False, 'message': '허용되지 않는 파일 형식입니다.'})
            
            # 파일 크기 체크
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            
            if file_size > app.config['MAX_IMAGE_SIZE']:
                # 이미 저장된 파일 삭제
                for saved_file in saved_files:
                    try:
                        os.remove(saved_file['path'])
                    except:
                        pass
                return jsonify({'success': False, 'message': f'각 이미지는 {app.config["MAX_IMAGE_SIZE"] // (1024*1024)}MB 이하여야 합니다.'})
            
            total_size += file_size
            
            # 파일명 생성 (timestamp + 원본파일명)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = secure_filename(file.filename)
            unique_filename = f"{timestamp}_{idx}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            file.save(filepath)
            saved_files.append({
                'filename': filename,
                'path': filepath,
                'size': file_size,
                'order': idx
            })
    
    # 전체 용량 체크 (선택사항)
    max_total_size = 40 * 1024 * 1024  # 40MB
    if total_size > max_total_size:
        for saved_file in saved_files:
            try:
                os.remove(saved_file['path'])
            except:
                pass
        return jsonify({'success': False, 'message': f'전체 이미지 용량은 {max_total_size // (1024*1024)}MB 이하여야 합니다.'})
    
    # 데이터베이스에 저장
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO posts (title, content, price, category, author_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (title, content, int(price), category, session['user_id']))
    
    post_id = cursor.lastrowid
    
    # 이미지 정보 저장
    for file_info in saved_files:
        cursor.execute('''
            INSERT INTO images (post_id, filename, file_path, file_size, upload_order)
            VALUES (?, ?, ?, ?, ?)
        ''', (post_id, file_info['filename'], file_info['path'], file_info['size'], file_info['order']))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'post_id': post_id})

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    conn = get_db()
    post = conn.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    
    if not post:
        conn.close()
        return jsonify({'success': False, 'message': '게시글을 찾을 수 없습니다.'})
    
    # 관리자이거나 작성자만
    if post['author_id'] != session['user_id'] and session.get('is_admin') != 1:
        conn.close()
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    data = request.json
    status = data.get('status', post['status'])
    
    conn.execute('UPDATE posts SET status = ? WHERE id = ?', (status, post_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    conn = get_db()
    post = conn.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    
    if not post:
        conn.close()
        return jsonify({'success': False, 'message': '게시글을 찾을 수 없습니다.'})
    
    # 관리자이거나 작성자만
    if post['author_id'] != session['user_id'] and session.get('is_admin') != 1:
        conn.close()
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    # 이미지 파일 삭제
    images = conn.execute('SELECT file_path FROM images WHERE post_id = ?', (post_id,)).fetchall()
    for image in images:
        try:
            os.remove(image['file_path'])
        except:
            pass
    
    # 데이터베이스에서 삭제
    conn.execute('DELETE FROM images WHERE post_id = ?', (post_id,))
    conn.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/users', methods=['GET'])
def get_users():
    if 'is_admin' not in session or session['is_admin'] != 1:
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    conn = get_db()
    users = conn.execute('SELECT id, email, name, student_id, created_at FROM users ORDER BY created_at DESC').fetchall()
    conn.close()
    
    users_list = [dict(user) for user in users]
    return jsonify({'success': True, 'users': users_list})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if 'is_admin' not in session or session['is_admin'] != 1:
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
    
    # 사용자의 게시물 이미지 삭제
    posts = conn.execute('SELECT id FROM posts WHERE author_id = ?', (user_id,)).fetchall()
    for post in posts:
        images = conn.execute('SELECT file_path FROM images WHERE post_id = ?', (post['id'],)).fetchall()
        for image in images:
            try:
                os.remove(image['file_path'])
            except:
                pass
        conn.execute('DELETE FROM images WHERE post_id = ?', (post['id'],))
        conn.execute('DELETE FROM posts WHERE id = ?', (post['id'],))
    
    # 사용자 삭제
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/insights', methods=['GET'])
def get_insights():
    if 'is_admin' not in session or session['is_admin'] != 1:
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    conn = get_db()
    
    total_users = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
    total_posts = conn.execute('SELECT COUNT(*) as count FROM posts').fetchone()['count']
    
    categories = conn.execute('''
        SELECT category, COUNT(*) as count 
        FROM posts 
        GROUP BY category
    ''').fetchall()
    
    conn.close()
    
    insights = {
        'total_users': total_users,
        'total_posts': total_posts,
        'categories': [dict(cat) for cat in categories]
    }
    
    return jsonify({'success': True, 'insights': insights})

@app.route('/api/check-session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        conn.close()
        
        if user:
            return jsonify({
                'logged_in': True,
                'user': {
                    'email': user['email'],
                    'name': user['name'],
                    'student_id': user['student_id'],
                    'is_admin': user['is_admin']
                }
            })
    return jsonify({'logged_in': False})

if __name__ == '__main__':
    app.run(debug=True, port=5000)