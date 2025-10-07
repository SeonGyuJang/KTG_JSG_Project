// 전역 변수
let currentUser = null;
let currentCategory = 'all';
let currentSearch = '';

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    loadPosts();
    initEventListeners();
    initImageUpload();
});

// 이벤트 리스너 초기화
function initEventListeners() {
    // 로그인 버튼
    document.getElementById('btnLogin').addEventListener('click', function() {
        if (currentUser) {
            logout();
        } else {
            openModal('loginModal');
        }
    });

    // 글쓰기 버튼
    document.getElementById('btnWrite').addEventListener('click', function() {
        openModal('writeModal');
        resetPostForm();
    });

    // 내 판매글 버튼
    document.getElementById('btnMyPosts').addEventListener('click', function() {
        showMyPosts();
    });

    // 관리자 버튼
    document.getElementById('btnAdmin').addEventListener('click', function() {
        window.location.href = '/admin';
    });

    // 검색 버튼
    document.getElementById('btnSearch').addEventListener('click', function() {
        currentSearch = document.getElementById('searchInput').value;
        loadPosts();
    });

    // 검색 입력 엔터키
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentSearch = this.value;
            loadPosts();
        }
    });

    // 카테고리 버튼들
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            loadPosts();
        });
    });

    // 모달 외부 클릭시 닫기
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });

    // 터치 이벤트로 스크롤 방지 (모바일)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('touchmove', function(e) {
            if (e.target === this) {
                e.preventDefault();
            }
        }, { passive: false });
    });
}

// 이미지 업로드 초기화
function initImageUpload() {
    const input = document.getElementById('postImages');
    const preview = document.getElementById('imagePreview');
    const totalSizeSpan = document.getElementById('totalSize');

    input.addEventListener('change', function() {
        const files = Array.from(this.files);
        let totalSize = 0;

        preview.innerHTML = '';

        files.forEach((file, index) => {
            if (file.size > 10 * 1024 * 1024) {
                alert('각 이미지는 10MB 이하여야 합니다.');
                return;
            }
            totalSize += file.size;

            const reader = new FileReader();
            reader.onload = function(e) {
                const div = document.createElement('div');
                div.className = 'image-preview';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="preview" loading="lazy">
                    <button class="image-remove" onclick="removeImage(this, ${file.size})">&times;</button>
                `;
                preview.appendChild(div);
            };
            reader.readAsDataURL(file);
        });

        totalSizeSpan.textContent = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';
    });
}

function removeImage(button, size) {
    const totalSizeSpan = document.getElementById('totalSize');
    let currentSize = parseFloat(totalSizeSpan.textContent) * 1024 * 1024;
    currentSize -= size;
    totalSizeSpan.textContent = (currentSize / (1024 * 1024)).toFixed(2) + ' MB';
    button.parentElement.remove();
}

// 세션 체크
async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            currentUser = data.user;
            updateUIForLoggedIn();
            if (currentUser.is_admin === 1) {
                document.getElementById('btnAdmin').style.display = 'block';
            }
        } else {
            currentUser = null;
            updateUIForLoggedOut();
        }
    } catch (error) {
        console.error('세션 체크 오류:', error);
    }
}

// 로그인 상태 UI 업데이트
function updateUIForLoggedIn() {
    document.getElementById('btnLogin').textContent = '로그아웃';
    document.getElementById('btnWrite').style.display = 'block';
    document.getElementById('btnMyPosts').style.display = 'block';
}

// 로그아웃 상태 UI 업데이트
function updateUIForLoggedOut() {
    document.getElementById('btnLogin').textContent = '로그인';
    document.getElementById('btnWrite').style.display = 'none';
    document.getElementById('btnMyPosts').style.display = 'none';
    document.getElementById('btnAdmin').style.display = 'none';
}

// 로그인
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            closeModal('loginModal');
            updateUIForLoggedIn();
            if (currentUser.is_admin === 1) {
                document.getElementById('btnAdmin').style.display = 'block';
            }
            alert('로그인되었습니다!');
            loadPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다.');
    }
}

// 회원가입
async function register() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const name = document.getElementById('registerName').value;
    const student_id = document.getElementById('registerStudentId').value;

    if (!email || !password || !name || !student_id) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, name, student_id })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('registerModal');
            openModal('loginModal');
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        alert('회원가입 중 오류가 발생했습니다.');
    }
}

// 로그아웃
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            currentUser = null;
            updateUIForLoggedOut();
            alert('로그아웃되었습니다.');
            loadPosts();
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
    }
}

// 게시글 목록 로드
async function loadPosts() {
    try {
        const params = new URLSearchParams({
            category: currentCategory,
            search: currentSearch
        });

        const response = await fetch(`/api/posts?${params}`);
        const data = await response.json();

        if (data.success) {
            displayPosts(data.posts);
        }
    } catch (error) {
        console.error('게시글 로드 오류:', error);
    }
}

// 게시글 표시
function displayPosts(posts) {
    const grid = document.getElementById('postsGrid');
    const emptyState = document.getElementById('emptyState');

    if (posts.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    posts.forEach(post => {
        const card = createPostCard(post);
        grid.appendChild(card);
    });
}

// 게시글 카드 생성
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.onclick = () => showPostDetail(post.id);

    const statusText = {
        'sale': '판매중',
        'reserved': '예약중',
        'sold': '판매완료'
    };

    const imageSrc = post.images && post.images.length > 0 ? post.images[0] : '';

    card.innerHTML = `
        <div class="post-image">
            ${imageSrc ? `<img src="${imageSrc}" alt="${post.title}" loading="lazy">` : '📦'}
        </div>
        <div class="post-content">
            <div class="post-status ${post.status}">${statusText[post.status]}</div>
            <div class="post-title">${post.title}</div>
            <div class="post-price">${formatPrice(post.price)}원</div>
            <div class="post-meta">
                <span>${post.author}</span>
                <span>${formatDate(post.created_at)}</span>
            </div>
        </div>
    `;

    return card;
}

// 게시글 상세 보기
async function showPostDetail(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();

        if (data.success) {
            displayPostDetail(data.post);
            openModal('postDetailModal');
        }
    } catch (error) {
        console.error('게시글 상세 로드 오류:', error);
    }
}

// 게시글 상세 표시
function displayPostDetail(post) {
    document.getElementById('detailTitle').textContent = post.title;

    const statusText = {
        'sale': '판매중',
        'reserved': '예약중',
        'sold': '판매완료'
    };

    const categoryText = {
        'electronics': '전자기기',
        'books': '도서',
        'fashion': '의류',
        'etc': '기타'
    };

    let imagesHTML = '';
    if (post.images && post.images.length > 0) {
        imagesHTML = '<div class="post-detail-images">';
        post.images.forEach(img => {
            imagesHTML += `<img src="${img.file_path}" alt="상품 이미지" class="post-detail-image" onclick="enlargeImage('${img.file_path}')">`;
        });
        imagesHTML += '</div>';
    }

    let actionsHTML = '';
    if (currentUser && (currentUser.email === post.author_email || currentUser.is_admin === 1)) {
        actionsHTML = `
            <div class="post-actions">
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'sale')">판매중</button>
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'reserved')">예약중</button>
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'sold')">판매완료</button>
                <button class="btn-danger" onclick="deletePost(${post.id})">삭제</button>
            </div>
        `;
    }

    document.getElementById('detailContent').innerHTML = `
        <div class="post-detail">
            ${imagesHTML}
            <div class="post-detail-info">
                <div class="post-status ${post.status}">${statusText[post.status]}</div>
                <div class="post-detail-price">${formatPrice(post.price)}원</div>
                <div class="post-detail-meta">
                    <span>카테고리: ${categoryText[post.category]}</span>
                    <span>작성자: ${post.author}</span>
                    <span>${formatDate(post.created_at)}</span>
                </div>
            </div>
            <div class="post-detail-content">
                ${post.content.replace(/\n/g, '<br>')}
            </div>
            ${actionsHTML}
        </div>
    `;
}

// 이미지 확대
function enlargeImage(src) {
    document.getElementById('enlargedImage').src = src;
    openModal('imageModal');
}

// 게시글 작성
async function createPost() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    const form = document.getElementById('postForm');
    const formData = new FormData(form);

    if (!formData.get('title') || !formData.get('price') || !formData.get('content')) {
        alert('제목, 가격, 설명은 필수 항목입니다.');
        return;
    }

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert('게시글이 등록되었습니다!');
            closeModal('writeModal');
            resetPostForm();
            loadPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('게시글 작성 오류:', error);
        alert('게시글 작성 중 오류가 발생했습니다.');
    }
}

// 게시글 작성 폼 리셋
function resetPostForm() {
    document.getElementById('postTitle').value = '';
    document.getElementById('postCategory').value = 'electronics';
    document.getElementById('postPrice').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postImages').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('totalSize').textContent = '0 MB';
}

// 게시글 상태 업데이트
async function updatePostStatus(postId, status) {
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();

        if (data.success) {
            alert('상태가 변경되었습니다.');
            closeModal('postDetailModal');
            loadPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('상태 업데이트 오류:', error);
    }
}

// 게시글 삭제
async function deletePost(postId) {
    if (!confirm('정말 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('게시글이 삭제되었습니다.');
            closeModal('postDetailModal');
            loadPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
    }
}

// 내 판매글 보기
async function showMyPosts() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    try {
        const response = await fetch('/api/posts');
        const data = await response.json();

        if (data.success) {
            const myPosts = data.posts.filter(post => post.author_email === currentUser.email);
            displayPosts(myPosts);
        }
    } catch (error) {
        console.error('내 판매글 로드 오류:', error);
    }
}

// 모달 열기
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden'; // 모바일 스크롤 방지
}

// 모달 닫기
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = ''; // 스크롤 복원
}

// 회원가입 모달 표시
function showRegisterModal() {
    closeModal('loginModal');
    openModal('registerModal');
}

// 가격 포맷팅
function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return `${date.getMonth() + 1}.${date.getDate()}`;
}