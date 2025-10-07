// admin.js
document.addEventListener('DOMContentLoaded', function() {
    loadInsights();
    loadAdminPosts();
    loadUsers();

    document.getElementById('btnLogout').addEventListener('click', logout);
});

// 인사이트 로드
async function loadInsights() {
    try {
        const response = await fetch('/api/insights', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            displayInsights(data.insights);
        } else {
            console.error('인사이트 로드 실패:', data.message);
            document.getElementById('insightsSection').innerHTML = '<p>인사이트 로드에 실패했습니다: ' + data.message + '</p>';
        }
    } catch (error) {
        console.error('인사이트 로드 오류:', error);
        document.getElementById('insightsSection').innerHTML = '<p>인사이트 로드 중 오류 발생</p>';
    }
}

function displayInsights(insights) {
    const section = document.getElementById('insightsSection');
    section.innerHTML = `
        <p>총 사용자 수: ${insights.total_users}</p>
        <p>총 게시물 수: ${insights.total_posts}</p>
        <h3>카테고리별 게시물</h3>
        <ul>
            ${insights.categories.map(cat => `<li>${cat.category}: ${cat.count}</li>`).join('')}
        </ul>
    `;
}

// 관리자 게시물 로드
async function loadAdminPosts() {
    try {
        const response = await fetch('/api/posts', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            displayAdminPosts(data.posts);
        } else {
            console.error('게시물 로드 실패:', data.message);
            document.getElementById('adminPostsGrid').innerHTML = '<p>게시물 로드에 실패했습니다: ' + data.message + '</p>';
        }
    } catch (error) {
        console.error('게시물 로드 오류:', error);
        document.getElementById('adminPostsGrid').innerHTML = '<p>게시물 로드 중 오류 발생</p>';
    }
}

function displayAdminPosts(posts) {
    const grid = document.getElementById('adminPostsGrid');
    grid.innerHTML = '';
    posts.forEach(post => {
        const card = createAdminPostCard(post);
        grid.appendChild(card);
    });
}

function createAdminPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';

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
            <div class="post-actions">
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'sale')">판매중</button>
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'reserved')">예약중</button>
                <button class="btn-secondary" onclick="updatePostStatus(${post.id}, 'sold')">판매완료</button>
                <button class="btn-danger" onclick="deletePost(${post.id})">삭제</button>
            </div>
        </div>
    `;

    return card;
}

// 사용자 로드
async function loadUsers() {
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            displayUsers(data.users);
        } else {
            console.error('사용자 로드 실패:', data.message);
            document.getElementById('usersSection').innerHTML = '<p>사용자 로드에 실패했습니다: ' + data.message + '</p>';
        }
    } catch (error) {
        console.error('사용자 로드 오류:', error);
        document.getElementById('usersSection').innerHTML = '<p>사용자 로드 중 오류 발생</p>';
    }
}

function displayUsers(users) {
    const section = document.getElementById('usersSection');
    section.innerHTML = '';
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div class="user-info">
                ${user.name} (${user.email}, 학번: ${user.student_id})
            </div>
            <button class="btn-danger" onclick="deleteUser(${user.id})">삭제</button>
        `;
        section.appendChild(item);
    });
}

// 게시글 상태 업데이트
async function updatePostStatus(postId, status) {
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status }),
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert('상태가 변경되었습니다.');
            loadAdminPosts();
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
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert('게시글이 삭제되었습니다.');
            loadAdminPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
    }
}

// 사용자 삭제
async function deleteUser(userId) {
    if (!confirm('이 사용자를 삭제하시겠습니까? 모든 게시물이 함께 삭제됩니다.')) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert('사용자가 삭제되었습니다.');
            loadUsers();
            loadAdminPosts();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
    }
}

// 로그아웃
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
    }
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