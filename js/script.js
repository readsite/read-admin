// 分页状态
let pagination = {
    published: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    scheduled: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    draft: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    changelog: { page: 1, limit: 20, total: 0, loading: false, hasMore: true }
};
// ==================== API 基础配置 ====================
const API_BASE = 'https://solitudenook.top';

// ==================== 辅助函数 ====================
function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 8);
}

function getAuthToken() {
    return sessionStorage.getItem('read_token');
}

function setAuthToken(token) {
    sessionStorage.setItem('read_token', token);
}

function clearAuthToken() {
    sessionStorage.removeItem('read_token');
}

function checkAuth() {
    return !!getAuthToken();
}

function showLogin() {
    document.getElementById('loginPanel').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    loadCurrentTab(); // 加载当前标签页数据
}

// 统一的 API 请求函数，自动处理认证和错误
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        ...options,
        headers,
    });
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthToken();
            showLogin();
            throw new Error('登录已过期，请重新登录');
        }
        const errorText = await response.text();
        throw new Error(errorText || '请求失败');
    }
    return response.json();
}
if (window.innerWidth <= 768) {
    const trashBtn = document.getElementById('trashBinBtn');
    if (trashBtn) trashBtn.style.display = 'inline-flex';
}
// ==================== 登录 ====================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.token) {
            setAuthToken(data.token);
            showApp();
        } else {
            alert('用户名或密码错误');
        }
    } catch (err) {
        console.error('登录失败', err);
        alert('登录失败，请检查网络或稍后重试');
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearAuthToken();
    showLogin();
});

// 页面加载时检查登录状态
if (checkAuth()) {
    showApp();
} else {
    showLogin();
}

// ==================== 数据缓存与分页 ====================
let fullDataCache = {
    published: [],   // 已发布内容
    scheduled: [],   // 定时任务
    draft: [],       // 草稿
    changelog: []    // 更新日志
};
let pageLimit = {
    published: 15,
    scheduled: 15,
    draft: 15,
    changelog: 15
};
let currentTab = 'published';

// ==================== 跨标签页数据同步 ====================
function notifyDataUpdate() {
    // 触发跨标签页更新通知
    localStorage.setItem('admin_data_updated', Date.now().toString());
    // 同时刷新当前标签页的数据（用于管理后台自身）
    refreshCurrentTabData();
}

function refreshCurrentTabData() {
    if (currentTab === 'published') loadPosts();
    else if (currentTab === 'scheduled') loadScheduled();
    else if (currentTab === 'draft') loadDrafts();
    else if (currentTab === 'changelog') loadChangelogs();
}

// 监听 storage 事件（可选，用于多标签页同步）
window.addEventListener('storage', (e) => {
    if (e.key === 'admin_data_updated') {
        console.log('检测到其他标签页的内容更新，刷新当前数据');
        refreshCurrentTabData();
    }
});

// ==================== 数据加载函数（增强错误处理和格式兼容） ====================
async function loadPosts(append = false) {
    const tab = 'published';
    const pg = pagination[tab];
    
    if (pg.loading) return;
    if (!append) {
        pg.page = 1;
        pg.hasMore = true;
        fullDataCache.published = [];
        // 清空容器并显示加载指示器（可选）
        const container = document.getElementById('postList');
        if (container) container.innerHTML = '<div class="loading-spinner"><i class="ri-loader-4-line spin"></i> 加载中...</div>';
    }
    if (!pg.hasMore && append) return;
    
    pg.loading = true;
    
    try {
        const res = await apiRequest(`/api/posts?type=published&page=${pg.page}&limit=${pg.limit}`);
        const items = res.items || [];
        pg.total = res.total || 0;
        pg.hasMore = items.length === pg.limit && (pg.page * pg.limit) < pg.total;
        
        if (append) {
            fullDataCache.published = [...fullDataCache.published, ...items];
        } else {
            fullDataCache.published = items;
        }
        
        renderTabData(tab);
        
        // 在列表末尾添加“加载更多”按钮（如果还有更多数据）
        if (pg.hasMore && append) {
            const container = document.getElementById('postList');
            if (container && !container.querySelector('.pagination-more')) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'pagination-more';
                moreBtn.innerHTML = `<button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button>`;
                container.appendChild(moreBtn);
            }
        } else if (!pg.hasMore && append) {
            // 可选：显示“没有更多了”
            const container = document.getElementById('postList');
            if (container && !container.querySelector('.no-more')) {
                const noMore = document.createElement('div');
                noMore.className = 'no-more';
                noMore.innerHTML = '<i class="ri-information-line"></i> 没有更多内容了';
                container.appendChild(noMore);
            }
        }
    } catch (err) {
    console.error('加载已发布内容失败', err);
    const container = document.getElementById('postList');
    if (container) {
        container.innerHTML = `<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败：${err.message || '请检查网络或联系管理员'}</div>`;
    }
} finally {
    pg.loading = false;
}
}
async function loadScheduled(append = false) {
    const tab = 'scheduled';
    const pg = pagination[tab];
    if (pg.loading) return;
    if (!append) {
        pg.page = 1;
        pg.hasMore = true;
        fullDataCache.scheduled = [];
    }
    if (!pg.hasMore && append) return;
    pg.loading = true;

    const container = document.getElementById('scheduledList');
    if (append && container) {
        container.insertAdjacentHTML('beforeend', '<div class="loading-more">加载中...</div>');
    }

    try {
        const res = await apiRequest(`/api/scheduled?page=${pg.page}&limit=${pg.limit}`);
        const items = res.items || [];
        pg.total = res.total || 0;
        pg.hasMore = items.length === pg.limit && (pg.page * pg.limit) < pg.total;

        if (append) {
            fullDataCache.scheduled = [...fullDataCache.scheduled, ...items];
        } else {
            fullDataCache.scheduled = items;
        }

        if (append && container) {
            const loadingDiv = container.querySelector('.loading-more');
            if (loadingDiv) loadingDiv.remove();
        }

        renderTabData(tab);

        if (pg.hasMore && append) {
            const moreBtn = document.createElement('div');
            moreBtn.className = 'pagination-more';
            moreBtn.innerHTML = `<button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button>`;
            container.appendChild(moreBtn);
        }
    } catch (err) {
        console.error('加载定时任务失败', err);
        if (container) container.innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    } finally {
        pg.loading = false;
    }
}

async function loadDrafts() {
    try {
        const response = await apiRequest('/api/drafts');
        let drafts = Array.isArray(response) ? response : (response.drafts || response.data || []);
        if (!Array.isArray(drafts)) drafts = [];
        fullDataCache.draft = drafts;
        pageLimit.draft = 15;
        renderTabData('draft');
    } catch (err) {
        console.error('加载草稿失败', err);
        document.getElementById('draftList').innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    }
}

async function loadChangelogs() {
    try {
        const response = await apiRequest('/api/changelogs');
        let logs = Array.isArray(response) ? response : (response.logs || response.data || []);
        if (!Array.isArray(logs)) logs = [];
        fullDataCache.changelog = logs;
        pageLimit.changelog = 15;
        renderTabData('changelog');
    } catch (err) {
        console.error('加载更新日志失败', err);
        document.getElementById('changelogList').innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    }
}

// ==================== 数据操作 API（增删改） ====================
// 已发布内容
async function addPost(content) {
    return apiRequest('/api/posts', { method: 'POST', body: JSON.stringify(content) });
}
async function updatePost(date, content) {
    return apiRequest(`/api/posts/${date}`, { method: 'PUT', body: JSON.stringify(content) });
}
async function deletePostByDate(date) {
    return apiRequest(`/api/posts/${date}`, { method: 'DELETE' });
}

// 定时任务
async function addScheduled(task) {
    return apiRequest('/api/scheduled', { method: 'POST', body: JSON.stringify(task) });
}
async function updateScheduled(id, task) {
    return apiRequest(`/api/scheduled/${id}`, { method: 'PUT', body: JSON.stringify(task) });
}
async function deleteScheduledById(id) {
    return apiRequest(`/api/scheduled/${id}`, { method: 'DELETE' });
}

// 草稿
async function addDraft(draft) {
    return apiRequest('/api/drafts', { method: 'POST', body: JSON.stringify(draft) });
}
async function updateDraft(id, draft) {
    return apiRequest(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify(draft) });
}
async function deleteDraftById(id) {
    return apiRequest(`/api/drafts/${id}`, { method: 'DELETE' });
}

// 更新日志
async function addChangelog(log) {
    return apiRequest('/api/changelogs', { method: 'POST', body: JSON.stringify(log) });
}
async function deleteChangelogById(id) {
    return apiRequest(`/api/changelogs/${id}`, { method: 'DELETE' });
}

// ==================== 渲染函数（支持移动端分页） ====================
function getContainerId(tab) {
    switch (tab) {
        case 'published': return 'postList';
        case 'scheduled': return 'scheduledList';
        case 'draft': return 'draftList';
        case 'changelog': return 'changelogList';
        default: return '';
    }
}

function renderTabData(tab) {
    const data = fullDataCache[tab];
    // 确保 data 是数组
    if (!Array.isArray(data)) {
        console.warn(`renderTabData: ${tab} 数据不是数组`, data);
        const container = document.getElementById(getContainerId(tab));
        if (container) container.innerHTML = '<div class="empty-message">数据格式错误，请刷新重试</div>';
        return;
    }

    const isMobile = window.innerWidth <= 768;
    let displayData = data;
    let showMore = false;
    if (isMobile && data.length > 15) {
        displayData = data.slice(0, pageLimit[tab]);
        showMore = displayData.length < data.length;
    }

    const container = document.getElementById(getContainerId(tab));
    if (!container) return;

    if (!displayData.length) {
        container.innerHTML = '<div class="empty-message">暂无内容</div>';
        return;
    }

    let html = '';
    if (tab === 'published') {
        html = displayData.map(post => {
            // 兼容数据结构
            const stats = post.stats || {};
            const musicStats = stats.music || { favorites: 0, shares: 0 };
            const sentenceStats = stats.sentence || { favorites: 0, shares: 0 };
            const articleStats = stats.article || { favorites: 0, shares: 0 };
            return `
                <div class="post-card">
                    <div class="post-card-header"><h3><i class="ri-calendar-event-line"></i> ${escapeHtml(post.date)}</h3></div>
                    <div class="post-stats">
                        <div class="stat-item"><i class="ri-headphone-line"></i> 收藏 ${musicStats.favorites} · 分享 ${musicStats.shares}</div>
                        <div class="stat-item"><i class="ri-double-quotes-l"></i> 收藏 ${sentenceStats.favorites} · 分享 ${sentenceStats.shares}</div>
                        <div class="stat-item"><i class="ri-article-line"></i> 收藏 ${articleStats.favorites} · 分享 ${articleStats.shares}</div>
                    </div>
                    <div class="post-actions">
                        <button onclick="editPost('${post.date}')"><i class="ri-edit-line"></i> 编辑</button>
                        <button class="delete" onclick="deletePost('${post.date}')"><i class="ri-delete-bin-line"></i> 删除</button>
                    </div>
                </div>
            `;
        }).join('');
    } else if (tab === 'scheduled') {
        html = displayData.map(task => `
            <div class="post-card">
                <div class="post-card-header"><h3><i class="ri-calendar-schedule-line"></i> ${escapeHtml(task.date)}</h3></div>
                <div class="task-meta">
                    <span><i class="ri-music-2-line"></i> ${escapeHtml(task.content?.music?.title || '无音乐')}</span>
                    <span><i class="ri-chat-quote-line"></i> ${escapeHtml((task.content?.sentence?.text || '').substring(0, 40))}</span>
                </div>
                <div class="post-actions">
                    <button onclick="editScheduled('${task.id}')"><i class="ri-edit-line"></i> 编辑</button>
                    <button class="delete" onclick="deleteScheduled('${task.id}')"><i class="ri-delete-bin-line"></i> 删除</button>
                </div>
            </div>
        `).join('');
    } else if (tab === 'draft') {
        html = displayData.map(draft => {
            const musicTitleText = draft.music?.title || '无音乐';
            const sentencePreview = draft.sentence?.text ? draft.sentence.text.substring(0, 42) : '无句子';
            return `
                <div class="post-card">
                    <div class="post-card-header"><h3><i class="ri-draft-line"></i> ${escapeHtml(draft.date)}</h3></div>
                    <div class="task-meta">
                        <span><i class="ri-music-2-line"></i> ${escapeHtml(musicTitleText)}</span>
                        <span><i class="ri-chat-quote-line"></i> ${escapeHtml(sentencePreview)}${draft.sentence?.text && draft.sentence.text.length > 42 ? '…' : ''}</span>
                    </div>
                    <div class="post-actions">
                        <button onclick="editDraft('${draft.id}')"><i class="ri-edit-line"></i> 编辑</button>
                        <button class="delete" onclick="deleteDraft('${draft.id}')"><i class="ri-delete-bin-line"></i> 删除</button>
                    </div>
                </div>
            `;
        }).join('');
    } else if (tab === 'changelog') {
        html = displayData.map(log => `
            <div class="post-card">
                <div class="post-card-header"><h3>v${escapeHtml(log.version)} · ${log.date}</h3></div>
                <div class="task-meta">${escapeHtml(log.content).replace(/\n/g, '<br>')}</div>
                <div class="post-actions"><button class="delete" onclick="deleteChangelog('${log.id}')">删除</button></div>
            </div>
        `).join('');
    }

    if (showMore && isMobile) {
        html += `<div class="pagination-more"><button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button></div>`;
    }
    container.innerHTML = html;
}

// 加载更多（移动端）
window.loadMore = function(tab) {
    const pg = pagination[tab];
    if (pg.loading || !pg.hasMore) return;
    pg.page++;
    if (tab === 'published') loadPosts(true);
    else if (tab === 'scheduled') loadScheduled(true);
    else if (tab === 'draft') loadDrafts(true);
    else if (tab === 'changelog') loadChangelogs(true);
};

// 切换标签页
function switchTab(tab) {
    currentTab = tab;
    // 更新PC端选项卡样式
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    const pcBtn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (pcBtn) pcBtn.classList.add('active');
    // 更新移动端底部导航样式
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => item.classList.remove('active'));
    const mobileItem = document.querySelector(`.bottom-nav .nav-item[data-tab="${tab}"]`);
    if (mobileItem) mobileItem.classList.add('active');
    // 显示对应的列表容器
    const containers = ['postList', 'scheduledList', 'draftList', 'changelogList'];
    containers.forEach(id => document.getElementById(id).style.display = 'none');
    const targetId = getContainerId(tab);
    document.getElementById(targetId).style.display = 'grid';
    // 加载数据
    if (tab === 'published') loadPosts(false);
    else if (tab === 'scheduled') loadScheduled(false);
    else if (tab === 'draft') loadDrafts(false);
    else if (tab === 'changelog') loadChangelogs(false);
}
function setupInfiniteScroll() {
    const container = document.getElementById(getContainerId(currentTab));
    if (!container) return;
    
    const onScroll = () => {
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const scrollHeight = container.scrollHeight;
        if (scrollTop + clientHeight >= scrollHeight - 100) { // 距离底部100px时触发
            const pg = pagination[currentTab];
            if (!pg.loading && pg.hasMore) {
                loadMore(currentTab);
            }
        }
    };
    
    container.addEventListener('scroll', onScroll);
    // 记得移除事件监听
}
function loadCurrentTab() {
    switchTab(currentTab);
}

// 选项卡事件绑定
document.getElementById('tabPublished')?.addEventListener('click', () => switchTab('published'));
document.getElementById('tabScheduled')?.addEventListener('click', () => switchTab('scheduled'));
document.getElementById('tabDraft')?.addEventListener('click', () => switchTab('draft'));
document.getElementById('tabChangelog')?.addEventListener('click', () => switchTab('changelog'));

// 移动端底部导航点击
document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// 移动端中央按钮弹出菜单
const centerBtn = document.getElementById('mobileCenterBtn');
const actionSheet = document.getElementById('actionSheet');
const actionOverlay = document.getElementById('actionSheetOverlay');
function closeSheet() {
    actionSheet?.classList.remove('active');
    actionOverlay?.classList.remove('active');
}
centerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    actionSheet?.classList.toggle('active');
    actionOverlay?.classList.toggle('active');
});
actionOverlay?.addEventListener('click', closeSheet);
document.getElementById('mobileNewPost')?.addEventListener('click', () => {
    closeSheet();
    document.getElementById('newPostBtn').click();
});
document.getElementById('mobileNewChangelog')?.addEventListener('click', () => {
    closeSheet();
    document.getElementById('newChangelogBtn').click();
});

// ==================== 编辑与删除全局函数 ====================
// 编辑已发布内容
window.editPost = async function(date) {
    try {
        let postData = null;
        // 优先从缓存获取
        const cachedPosts = fullDataCache.published;
        if (cachedPosts && Array.isArray(cachedPosts)) {
            const cached = cachedPosts.find(p => p.date === date);
            if (cached) {
                postData = cached.content ? cached.content : cached;
            }
        }
        if (!postData) {
            const response = await apiRequest(`/api/posts/${date}`);
            postData = response.content ? response.content : response;
        }
        fillFormWithData(postData, 'immediate');
        currentMode = 'editPost';
        editTargetDate = date;
        saveDraftBtn.style.display = 'none';
        submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存发布';
        modalTitle.innerHTML = '<i class="ri-pencil-line"></i> 编辑已发布内容';
        publishFields.style.display = 'block';
        changelogFields.style.display = 'none';
        openModal();
    } catch (err) {
        console.error('获取帖子详情失败', err);
        alert('获取帖子详情失败');
    }
};

// 删除已发布内容
window.deletePost = async function(date) {
    if (confirm('删除后互动数据将丢失')) {
        try {
            await deletePostByDate(date);
            notifyDataUpdate(); // 触发全局刷新
        } catch (err) {
            console.error('删除失败', err);
            alert('删除失败: ' + (err.message || '未知错误'));
        }
    }
};

// 编辑定时任务
window.editScheduled = async function(id) {
    try {
        const tasks = await apiRequest('/api/scheduled');
        const task = tasks.find(t => t.id === id);
        if (task) {
            fillFormWithData(task.content, 'scheduled');
            currentMode = 'editScheduled';
            editTargetId = id;
            saveDraftBtn.style.display = 'none';
            submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存发布';
            modalTitle.innerHTML = '<i class="ri-time-line"></i> 编辑定时任务';
            publishFields.style.display = 'block';
            changelogFields.style.display = 'none';
            openModal();
        }
    } catch (err) {
        console.error('获取定时任务失败', err);
        alert('获取定时任务失败');
    }
};

// 删除定时任务
window.deleteScheduled = async function(id) {
    if (confirm('删除定时任务')) {
        try {
            await deleteScheduledById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    }
};

// 编辑草稿
window.editDraft = async function(id) {
    try {
        const drafts = await apiRequest('/api/drafts');
        const draft = drafts.find(d => d.id === id);
        if (draft) {
            fillFormWithData(draft, draft.publishType);
            currentMode = 'editDraft';
            editTargetId = id;
            saveDraftBtn.style.display = 'inline-flex';
            saveDraftBtn.innerHTML = '<i class="ri-save-line"></i> 更新草稿';
            submitBtn.innerHTML = '<i class="ri-rocket-line"></i> 发布';
            modalTitle.innerHTML = '<i class="ri-draft-line"></i> 编辑草稿';
            publishFields.style.display = 'block';
            changelogFields.style.display = 'none';
            openModal();
        }
    } catch (err) {
        console.error('获取草稿失败', err);
        alert('获取草稿失败');
    }
};

// 删除草稿
window.deleteDraft = async function(id) {
    if (confirm('删除草稿后不可恢复')) {
        try {
            await deleteDraftById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    }
};

// 删除更新日志
window.deleteChangelog = async function(id) {
    if (confirm('删除日志')) {
        try {
            await deleteChangelogById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    }
};

// ==================== 表单与模态框操作 ====================
let currentMode = 'normal'; // normal, editPost, editScheduled, editDraft, changelog
let editTargetId = null;
let editTargetDate = null;

const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const submitBtn = document.getElementById('submitFormBtn');
const publishFields = document.getElementById('publishFields');
const changelogFields = document.getElementById('changelogFields');
const modalTitle = document.getElementById('modalTitle');

function closeModal() {
    modalOverlay.classList.remove('active');
}

function openModal() {
    modalOverlay.classList.add('active');
    setTimeout(() => {
        adjustTextareaHeight(sentenceText);
        adjustTextareaHeight(articleContent);
    }, 20);
}

function resetUIMode() {
    currentMode = 'normal';
    editTargetId = null;
    editTargetDate = null;
    saveDraftBtn.style.display = 'inline-flex';
    saveDraftBtn.innerHTML = '<i class="ri-save-line"></i> 保存草稿';
    submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存发布';
    modalTitle.innerHTML = '<i class="ri-add-circle-line"></i> 新建发布内容';
    publishFields.style.display = 'block';
    changelogFields.style.display = 'none';
}

function resetForm() {
    document.getElementById('postForm').reset();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    document.querySelector('input[name="publishType"][value="scheduled"]').checked = true;
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('sentenceImagePreviewContainer').style.display = 'none';
    resetUIMode();
    adjustTextareaHeight(sentenceText);
    adjustTextareaHeight(articleContent);
}

function fillFormWithData(data, publishTypeVal = 'immediate') {
    dateInput.value = data.date || '';
    if (publishTypeVal === 'immediate') {
        document.querySelector('input[name="publishType"][value="immediate"]').checked = true;
    } else {
        document.querySelector('input[name="publishType"][value="scheduled"]').checked = true;
    }
    musicTitle.value = data.music?.title || '';
    musicArtist.value = data.music?.artist || '';
    musicCover.value = data.music?.cover || '';
    musicSrc.value = data.music?.src || '';
    sentenceText.value = data.sentence?.text || '';
    sentenceAuthor.value = data.sentence?.author || '';
    sentenceImageUrl.value = data.sentence?.image || '';
    articleTitle.value = data.article?.title || '';
    articleAuthor.value = data.article?.author || '';
    articleContent.value = data.article?.content || '';
    articleImageUrl.value = data.article?.image || '';
    if (articleImageUrl.value) {
        document.getElementById('imagePreview').src = articleImageUrl.value;
        document.getElementById('imagePreviewContainer').style.display = 'flex';
    } else {
        document.getElementById('imagePreviewContainer').style.display = 'none';
    }
    if (sentenceImageUrl.value) {
        document.getElementById('sentenceImagePreview').src = sentenceImageUrl.value;
        document.getElementById('sentenceImagePreviewContainer').style.display = 'flex';
    } else {
        document.getElementById('sentenceImagePreviewContainer').style.display = 'none';
    }
    adjustTextareaHeight(sentenceText);
    adjustTextareaHeight(articleContent);
}

function collectFormData() {
    const publishType = document.querySelector('input[name="publishType"]:checked').value;
    return {
        date: dateInput.value,
        publishType: publishType,
        music: {
            title: musicTitle.value,
            artist: musicArtist.value,
            cover: musicCover.value,
            src: musicSrc.value
        },
        sentence: {
            text: sentenceText.value,
            author: sentenceAuthor.value,
            image: sentenceImageUrl.value
        },
        article: {
            title: articleTitle.value,
            author: articleAuthor.value,
            content: articleContent.value,
            image: articleImageUrl.value
        }
    };
}

// 保存草稿
async function saveAsDraft() {
    const formData = collectFormData();
    if (!formData.date) {
        alert('请填写生效日期');
        return;
    }
    try {
        if (currentMode === 'editDraft' && editTargetId) {
            await updateDraft(editTargetId, formData);
            alert('草稿已更新');
        } else {
            await addDraft(formData);
            alert('草稿已保存');
        }
        closeModal();
        notifyDataUpdate();
    } catch (err) {
        console.error('保存草稿失败', err);
        alert('保存失败');
    }
}

// 发布（立即或定时）
async function handlePublish() {
    const formData = collectFormData();
    if (!formData.date) {
        alert('请选择日期');
        return;
    }

    try {
        // 草稿转发布
        if (currentMode === 'editDraft' && editTargetId) {
            if (formData.publishType === 'immediate') {
                await addPost(formData);
            } else {
                await addScheduled({ date: formData.date, publishTime: `${formData.date}T00:00:00`, content: formData });
            }
            await deleteDraftById(editTargetId);
            alert('发布成功');
            closeModal();
            notifyDataUpdate();
            return;
        }

        // 编辑已发布内容
        if (currentMode === 'editPost' && editTargetDate) {
    if (editTargetDate !== formData.date) {
        // 日期已改变：先删除旧日期的内容
        await deletePostByDate(editTargetDate);
        // 在新日期下新增内容（无法保留原统计数据，可提示用户）
        if (formData.publishType === 'immediate') {
            await addPost(formData);
        } else {
            await addScheduled({ date: formData.date, publishTime: `${formData.date}T00:00:00`, content: formData });
        }
        alert(`内容已从 ${editTargetDate} 移至 ${formData.date}，原互动数据已清零。`);
    } else {
        // 日期未变：使用 PUT 更新内容
        await updatePost(editTargetDate, formData);
        alert('内容已更新');
    }
    closeModal();
    notifyDataUpdate();
    return;
}

        // 编辑定时任务
        if (currentMode === 'editScheduled' && editTargetId) {
            await updateScheduled(editTargetId, { date: formData.date, publishTime: `${formData.date}T00:00:00`, content: formData });
            alert('定时任务已更新');
            closeModal();
            notifyDataUpdate();
            return;
        }

        // 新增
        if (formData.publishType === 'immediate') {
            await addPost(formData);
        } else {
            await addScheduled({ date: formData.date, publishTime: `${formData.date}T00:00:00`, content: formData });
        }
        alert('发布成功');
        closeModal();
        notifyDataUpdate();
    } catch (err) {
        console.error('发布失败', err);
        alert('发布失败，请重试');
    }
}

// ==================== 更新日志相关 ====================
function openChangelogModal() {
    resetForm();
    publishFields.style.display = 'none';
    changelogFields.style.display = 'block';
    modalTitle.innerHTML = '<i class="ri-history-line"></i> 新增更新日志';
    document.getElementById('changelogVersion').value = '';
    document.getElementById('changelogDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('changelogContent').value = '';
    currentMode = 'changelog';
    saveDraftBtn.style.display = 'none';
    submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存日志';
    openModal();
}

async function saveChangelog() {
    const version = document.getElementById('changelogVersion').value.trim();
    const date = document.getElementById('changelogDate').value;
    const content = document.getElementById('changelogContent').value.trim();
    if (!version || !date || !content) return alert('请完整填写');
    try {
        await addChangelog({ version, date, content });
        closeModal();
        notifyDataUpdate();
    } catch (err) {
        console.error('保存日志失败', err);
        alert('保存失败');
    }
}

// 按钮事件
document.getElementById('newPostBtn').addEventListener('click', () => {
    resetForm();
    saveDraftBtn.style.display = 'inline-flex';
    submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存发布';
    currentMode = 'normal';
    publishFields.style.display = 'block';
    changelogFields.style.display = 'none';
    modalTitle.innerHTML = '<i class="ri-add-circle-line"></i> 新建发布内容';
    openModal();
});
document.getElementById('newChangelogBtn').addEventListener('click', openChangelogModal);
saveDraftBtn.addEventListener('click', saveAsDraft);
submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentMode === 'changelog') saveChangelog();
    else handlePublish();
});
cancelFormBtn.addEventListener('click', closeModal);
closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ==================== 辅助函数 ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

function adjustTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    let newHeight = textarea.scrollHeight;
    const minHeight = 82;
    if (newHeight < minHeight) newHeight = minHeight;
    textarea.style.height = newHeight + 'px';
}

function bindAutoResizeForTextarea(textarea) {
    if (!textarea) return;
    textarea.addEventListener('input', function() { adjustTextareaHeight(this); });
    adjustTextareaHeight(textarea);
}

const sentenceText = document.getElementById('sentenceText');
const articleContent = document.getElementById('articleContent');
bindAutoResizeForTextarea(sentenceText);
bindAutoResizeForTextarea(articleContent);
const changelogContent = document.getElementById('changelogContent');
if (changelogContent) bindAutoResizeForTextarea(changelogContent);

// 图片预览
function setupUrlPreview(inputEl, previewImg, container) {
    const update = () => {
        const url = inputEl.value.trim();
        if (url) {
            previewImg.src = url;
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    };
    inputEl.addEventListener('input', update);
    update();
}
const articleImageUrl = document.getElementById('articleImageUrl');
const sentenceImageUrl = document.getElementById('sentenceImageUrl');
setupUrlPreview(articleImageUrl, document.getElementById('imagePreview'), document.getElementById('imagePreviewContainer'));
setupUrlPreview(sentenceImageUrl, document.getElementById('sentenceImagePreview'), document.getElementById('sentenceImagePreviewContainer'));
(function() {
    // 确保全局函数和变量不冲突
    if (window._trashInitialized) return;
    window._trashInitialized = true;

    // ========== 回收站 API 封装 ==========
    const API_BASE_TRASH = window.API_BASE || 'https://solitudenook.top';
    
async function addToTrash(originalType, originalId, dataPayload) {
    const token = sessionStorage.getItem('read_token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/api/trash`, {  // 使用 API_BASE
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: originalType,
                originalId: originalId,
                data: dataPayload,
                deletedAt: new Date().toISOString()
            })
        });
        if (!res.ok) throw new Error('addToTrash failed');
        return await res.json();
    } catch (err) {
        console.error('移入回收站失败', err);
        throw err;
    }
}

    async function fetchTrashItems() {
        const token = sessionStorage.getItem('read_token');
        if (!token) return [];
        const res = await fetch(`${API_BASE_TRASH}/api/trash`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('获取回收站失败');
        const data = await res.json();
        return Array.isArray(data) ? data : (data.items || []);
    }

    async function restoreTrashItem(trashId, type, originalData) {
        // 恢复：根据类型调用相应创建接口，成功后删除回收站记录
        const token = sessionStorage.getItem('read_token');
        if (!token) throw new Error('未登录');
        let restoreSuccess = false;
        if (type === 'post') {
            // 已发布内容
            const res = await fetch(`${API_BASE_TRASH}/api/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(originalData)
            });
            if (res.ok) restoreSuccess = true;
        } else if (type === 'scheduled') {
            const payload = { date: originalData.date, publishTime: `${originalData.date}T00:00:00`, content: originalData };
            const res = await fetch(`${API_BASE_TRASH}/api/scheduled`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) restoreSuccess = true;
        } else if (type === 'draft') {
            const res = await fetch(`${API_BASE_TRASH}/api/drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(originalData)
            });
            if (res.ok) restoreSuccess = true;
        } else if (type === 'changelog') {
            const res = await fetch(`${API_BASE_TRASH}/api/changelogs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(originalData)
            });
            if (res.ok) restoreSuccess = true;
        }
        if (restoreSuccess) {
            // 删除回收站条目
            await fetch(`${API_BASE_TRASH}/api/trash/${trashId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return true;
        }
        return false;
    }

    async function permanentDeleteTrashItem(trashId) {
        const token = sessionStorage.getItem('read_token');
        if (!token) throw new Error('未登录');
        const res = await fetch(`${API_BASE_TRASH}/api/trash/${trashId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('彻底删除失败');
        return true;
    }

    // 打开回收站模态框并加载数据
    async function openTrashModal() {
        const modal = document.getElementById('trashModal');
        if (!modal) return;
        modal.classList.add('active');
        await loadTrashData();
    }

    async function loadTrashData() {
        const container = document.getElementById('trashListContainer');
        if (!container) return;
        try {
            const items = await fetchTrashItems();
            const countSpan = document.getElementById('trashCount');
            if (countSpan) countSpan.innerText = `${items.length} 项`;
            if (!items.length) {
                container.innerHTML = '<div class="empty-trash"><i class="ri-recycle-line"></i> 回收站为空</div>';
                return;
            }
            let html = '';
            for (const item of items) {
                const typeLabel = { post: '已发布内容', scheduled: '定时任务', draft: '草稿', changelog: '更新日志' }[item.type] || '内容';
                let preview = '';
                if (item.type === 'post') {
                    preview = `日期: ${item.data.date} | 音乐: ${item.data.music?.title || '无'} | 句子: ${(item.data.sentence?.text || '').substring(0, 50)}`;
                } else if (item.type === 'scheduled') {
                    preview = `定时发布: ${item.data.date} | 内容预览: ${item.data.music?.title || '无音乐'}`;
                } else if (item.type === 'draft') {
                    preview = `草稿日期: ${item.data.date} | 标题: ${item.data.music?.title || '无'}`;
                } else if (item.type === 'changelog') {
                    preview = `v${item.data.version} ${item.data.date} : ${item.data.content.substring(0, 60)}`;
                }
                html += `
                    <div class="trash-card" data-id="${item.id}">
                        <div class="trash-card-header">
                            <div class="trash-type-badge"><i class="ri-delete-bin-line"></i> ${typeLabel}</div>
                            <div class="trash-original-id">ID: ${escapeHtml(String(item.originalId || '—'))}</div>
                        </div>
                        <div class="trash-preview">${escapeHtml(preview)}</div>
                        <div class="trash-actions">
                            <button class="restore-btn" data-id="${item.id}" data-type="${item.type}" data-data='${JSON.stringify(item.data).replace(/'/g, "&#39;")}'><i class="ri-refund-line"></i> 恢复</button>
                            <button class="permanent-btn" data-id="${item.id}"><i class="ri-delete-bin-2-line"></i> 彻底删除</button>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
            // 绑定恢复和彻底删除事件
            container.querySelectorAll('.restore-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const type = btn.dataset.type;
                    let rawData = btn.dataset.data;
                    try {
                        const dataObj = JSON.parse(rawData);
                        if (confirm(`恢复该项内容？恢复后将重新出现在对应列表中。`)) {
                            await restoreTrashItem(id, type, dataObj);
                            alert('恢复成功');
                            await loadTrashData();
                            // 刷新主界面相关数据
                            if (window.refreshCurrentTabData) window.refreshCurrentTabData();
                            else if (window.loadCurrentTab) window.loadCurrentTab();
                        }
                    } catch (err) {
                        console.error(err);
                        alert('恢复失败: ' + err.message);
                    }
                });
            });
            container.querySelectorAll('.permanent-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    if (confirm('彻底删除后将无法恢复，确定吗？')) {
                        try {
                            await permanentDeleteTrashItem(id);
                            alert('已彻底删除');
                            await loadTrashData();
                        } catch (err) {
                            alert('删除失败');
                        }
                    }
                });
            });
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="empty-trash"><i class="ri-error-warning-line"></i> 加载回收站失败，请稍后重试</div>';
        }
    }

    function closeTrashModal() {
        const modal = document.getElementById('trashModal');
        if (modal) modal.classList.remove('active');
    }

    // 劫持原有删除函数，先移入回收站再调用原删除API（需保存原始数据）
    // 保存原始全局删除函数的引用
    const originalDeletePost = window.deletePost;
    const originalDeleteScheduled = window.deleteScheduled;
    const originalDeleteDraft = window.deleteDraft;
    const originalDeleteChangelog = window.deleteChangelog;

    // 增强 deletePost
    window.deletePost = async function(date) {
        if (!confirm('删除后内容将移至回收站，可恢复。确定删除吗？')) return;
        try {
            // 获取帖子详情（从缓存或接口）
            let postData = null;
            if (fullDataCache && fullDataCache.published) {
                const cached = fullDataCache.published.find(p => p.date === date);
                if (cached) postData = cached.content ? cached.content : cached;
            }
            if (!postData) {
                const response = await apiRequest(`/api/posts/${date}`);
                postData = response.content ? response.content : response;
            }
            if (postData) {
                await addToTrash('post', date, postData);
            }
            // 调用原有删除
            await deletePostByDate(date);
            notifyDataUpdate();
        } catch (err) {
            console.error('删除失败', err);
            alert('删除失败: ' + (err.message || '未知错误'));
        }
    };

    window.deleteScheduled = async function(id) {
        if (!confirm('删除定时任务后将移入回收站，确定删除？')) return;
        try {
            const tasks = await apiRequest('/api/scheduled');
            const task = tasks.find(t => t.id === id);
            if (task) {
                await addToTrash('scheduled', id, task.content);
            }
            await deleteScheduledById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    };

    window.deleteDraft = async function(id) {
        if (!confirm('删除草稿后将移入回收站，可恢复。确定删除？')) return;
        try {
            const drafts = await apiRequest('/api/drafts');
            const draft = drafts.find(d => d.id === id);
            if (draft) {
                await addToTrash('draft', id, draft);
            }
            await deleteDraftById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    };

    window.deleteChangelog = async function(id) {
        if (!confirm('删除日志后将移入回收站，确定删除？')) return;
        try {
            const logs = await apiRequest('/api/changelogs');
            const log = logs.find(l => l.id === id);
            if (log) {
                await addToTrash('changelog', id, log);
            }
            await deleteChangelogById(id);
            notifyDataUpdate();
        } catch (err) {
            alert('删除失败');
        }
    };

// 劫持原有 editPost 实现增强回收站
if (window.editPost) {
    const originalEditPost = window.editPost;
    window.editPost = async function(date) {
        // 调用原始编辑前暂存原数据用于后续可能的删除回收
        let originalPostData = null;
        try {
            if (fullDataCache && fullDataCache.published) {
                const cached = fullDataCache.published.find(p => p.date === date);
                if (cached) originalPostData = cached.content ? cached.content : cached;
            }
            if (!originalPostData) {
                const response = await apiRequest(`/api/posts/${date}`);
                originalPostData = response.content ? response.content : response;
            }
            window.__tempOriginalPostForTrash = { date, data: originalPostData };
        } catch(e) { console.warn(e);}
        await originalEditPost(date);
    };
}

    // 绑定回收站按钮事件
    const trashBtn = document.getElementById('trashBinBtn');
    if (trashBtn) {
        trashBtn.addEventListener('click', openTrashModal);
    }
    const closeTrashBtn = document.getElementById('closeTrashBtn');
    const closeTrashFooter = document.getElementById('closeTrashFooterBtn');
    if (closeTrashBtn) closeTrashBtn.addEventListener('click', closeTrashModal);
    if (closeTrashFooter) closeTrashFooter.addEventListener('click', closeTrashModal);
    const trashModalOverlay = document.getElementById('trashModal');
    if (trashModalOverlay) {
        trashModalOverlay.addEventListener('click', (e) => {
            if (e.target === trashModalOverlay) closeTrashModal();
        });
    }

    // 导出部分辅助方法供全局使用
    window._refreshTrash = loadTrashData;
})();

// DOM 元素引用
const dateInput = document.getElementById('date');
const musicTitle = document.getElementById('musicTitle');
const musicArtist = document.getElementById('musicArtist');
const musicCover = document.getElementById('musicCover');
const musicSrc = document.getElementById('musicSrc');
const sentenceAuthor = document.getElementById('sentenceAuthor');
const articleTitle = document.getElementById('articleTitle');
const articleAuthor = document.getElementById('articleAuthor');