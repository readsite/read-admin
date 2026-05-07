// ==================== 全局变量（前置） ====================
const API_BASE = 'https://solitudenook.top';
let currentTab = 'published'; // 当前选中的标签页
let reportsPanel, reportsListDiv, backFromReportsBtn, reportsHeaderBtn, sidebarReports;
// 分页状态管理
let pagination = {
    published: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    scheduled: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    draft: { page: 1, limit: 20, total: 0, loading: false, hasMore: true },
    changelog: { page: 1, limit: 20, total: 0, loading: false, hasMore: true }
};

// 数据缓存
let fullDataCache = {
    published: [],
    scheduled: [],
    draft: [],
    changelog: []
};

// 移动端显示条数限制（仅用于控制首屏显示，分页加载仍然生效）
let mobilePageLimit = {
    published: 15,
    scheduled: 15,
    draft: 15,
    changelog: 15
};

// 表单编辑状态
let currentMode = 'normal'; // normal, editPost, editScheduled, editDraft, changelog
let editTargetId = null;
let editTargetDate = null;

// DOM 元素引用（延迟初始化，在 DOMContentLoaded 中赋值）
let dateInput, musicTitle, musicArtist, musicCover, musicSrc,
    sentenceText, sentenceAuthor, sentenceImageUrl,
    articleTitle, articleAuthor, articleContent, articleImageUrl,
    saveDraftBtn, submitBtn, modalTitle, publishFields, changelogFields,
    modalOverlay, closeModalBtn, cancelFormBtn;

// ==================== 辅助函数 ====================
function showReportsPanel() {
    // 隐藏所有主列表容器
    const containers = ['postList', 'scheduledList', 'draftList', 'changelogList'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    // 隐藏评论面板（如果打开）
    if (commentsPanel) commentsPanel.style.display = 'none';
    // 显示举报面板
    if (reportsPanel) reportsPanel.style.display = 'block';
    // 加载举报数据
    loadReports();
}

function hideReportsPanel() {
    if (reportsPanel) reportsPanel.style.display = 'none';
    // 恢复当前激活的标签页列表
    const activeContainerId = getContainerId(currentTab);
    const activeContainer = document.getElementById(activeContainerId);
    if (activeContainer) activeContainer.style.display = 'grid';
    // 刷新当前标签页数据
    refreshCurrentTabData();
}
async function loadReports() {
    if (!reportsListDiv) return;
    reportsListDiv.innerHTML = '<div class="empty-message"><i class="ri-loader-4-line spin"></i> 加载举报记录...</div>';
    try {
        const token = getAuthToken();
        const response = await fetch(`${API_BASE}/api/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('获取举报列表失败');
        const reports = await response.json();
        // 后端返回的是数组
        if (!reports.length) {
            reportsListDiv.innerHTML = '<div class="empty-message"><i class="ri-alert-line"></i> 暂无举报记录</div>';
            return;
        }
        let html = '';
        for (const rep of reports) {
            const createdAt = rep.created_at ? new Date(rep.created_at).toLocaleString() : '未知时间';
            const nickname = escapeHtml(rep.nickname || '匿名');
            const commentContent = escapeHtml(rep.content || '【内容已删除】');
            const postDate = rep.date || '未知日期';
            const typeText = { music: '音乐', sentence: '句子', article: '文章' }[rep.type] || rep.type;
            const reason = escapeHtml(rep.reason || '无原因');
            const reporterToken = rep.reporter_token ? rep.reporter_token.substring(0, 10) + '…' : '匿名';
            html += `
                <div class="report-card" data-comment-id="${rep.comment_id}">
                    <div class="report-meta">
                        <span class="report-reason"><i class="ri-alert-line"></i> 举报原因：${reason}</span>
                        <span class="report-time">${createdAt}</span>
                    </div>
                    <div class="report-comment">
                        <div class="comment-header-sm">
                            <span><i class="ri-user-line"></i> ${nickname}</span>
                            <span>${postDate} (${typeText})</span>
                        </div>
                        <div class="comment-text">${commentContent}</div>
                    </div>
                    <div class="report-actions">
                        <button class="delete-comment-from-report" data-comment-id="${rep.comment_id}">
                            <i class="ri-delete-bin-line"></i> 删除评论
                        </button>
                    </div>
                </div>
            `;
        }
        reportsListDiv.innerHTML = html;

        // 绑定删除按钮事件
        document.querySelectorAll('.delete-comment-from-report').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;
                if (!commentId) return;
                if (!confirm('确定删除该评论吗？删除后将同时清除相关举报记录。')) return;
                try {
                    const delRes = await fetch(`${API_BASE}/api/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                    });
                    if (!delRes.ok) {
                        const errText = await delRes.text();
                        throw new Error(errText || '删除失败');
                    }
                    alert('评论已删除，相关举报记录已清除');
                    // 刷新举报列表
                    loadReports();
                    // 同时刷新评论管理面板（如果打开）
                    if (commentsPanel && commentsPanel.style.display === 'block') {
                        loadComments();
                    }
                } catch (err) {
                    console.error(err);
                    alert('删除失败：' + err.message);
                }
            });
        });
    } catch (err) {
        console.error('加载举报失败', err);
        reportsListDiv.innerHTML = `<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败：${err.message}</div>`;
    }
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
    if (typeof currentTab === 'undefined') {
        currentTab = 'published';
    }
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    loadCurrentTab();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
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
    textarea.addEventListener('input', function () { adjustTextareaHeight(this); });
    adjustTextareaHeight(textarea);
}

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

// ==================== 统一 API 请求（增强错误处理，支持状态码） ====================
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
        cache: 'no-store',
    });
    if (!response.ok) {
        let errorMessage = `请求失败 (${response.status})`;
        let errorBody = null;
        try {
            errorBody = await response.json();
            if (errorBody && errorBody.message) errorMessage = errorBody.message;
        } catch(e) {
            // 如果不是 JSON，尝试获取文本
            errorMessage = await response.text() || errorMessage;
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        if (response.status === 401) {
            clearAuthToken();
            showLogin();
        }
        throw error;
    }
    return response.json();
}

// ==================== 数据操作 API ====================
async function addPost(content) {
    return apiRequest('/api/posts', { method: 'POST', body: JSON.stringify(content) });
}
async function updatePost(date, content) {
    const cleanContent = {
        date: content.date,
        music: content.music || {},
        sentence: content.sentence || {},
        article: content.article || {}
    };
    return apiRequest(`/api/posts/${date}`, {
        method: 'PUT',
        body: JSON.stringify(cleanContent)
    });
}
async function deletePostByDate(date) {
    return apiRequest(`/api/posts/${date}`, { method: 'DELETE' });
}
async function addScheduled(task) {
    return apiRequest('/api/scheduled', { method: 'POST', body: JSON.stringify(task) });
}
async function updateScheduled(id, task) {
    return apiRequest(`/api/scheduled/${id}`, { method: 'PUT', body: JSON.stringify(task) });
}
async function deleteScheduledById(id) {
    return apiRequest(`/api/scheduled/${id}`, { method: 'DELETE' });
}
async function addDraft(draft) {
    return apiRequest('/api/drafts', { method: 'POST', body: JSON.stringify(draft) });
}
async function updateDraft(id, draft) {
    return apiRequest(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify(draft) });
}
async function deleteDraftById(id) {
    return apiRequest(`/api/drafts/${id}`, { method: 'DELETE' });
}
async function addChangelog(log) {
    return apiRequest('/api/changelogs', { method: 'POST', body: JSON.stringify(log) });
}
async function deleteChangelogById(id) {
    return apiRequest(`/api/changelogs/${id}`, { method: 'DELETE' });
}

// ==================== 数据加载函数（支持分页与追加） ====================
async function loadPosts(append = false) {
    const tab = 'published';
    const pg = pagination[tab];
    if (pg.loading) return;
    if (!append) {
        pg.page = 1;
        pg.hasMore = true;
        fullDataCache.published = [];
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
        if (pg.hasMore && append) {
            const container = document.getElementById('postList');
            if (container && !container.querySelector('.pagination-more')) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'pagination-more';
                moreBtn.innerHTML = `<button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button>`;
                container.appendChild(moreBtn);
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
        renderTabData(tab);
        if (pg.hasMore && append) {
            const container = document.getElementById('scheduledList');
            if (container && !container.querySelector('.pagination-more')) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'pagination-more';
                moreBtn.innerHTML = `<button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button>`;
                container.appendChild(moreBtn);
            }
        }
    } catch (err) {
        console.error('加载定时任务失败', err);
        const container = document.getElementById('scheduledList');
        if (container) container.innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    } finally {
        pg.loading = false;
    }
}

async function loadDrafts(append = false) {
    // 草稿不支持分页，忽略 append 参数
    const tab = 'draft';
    try {
        const response = await apiRequest('/api/drafts');
        let drafts = Array.isArray(response) ? response : (response.drafts || response.data || []);
        if (!Array.isArray(drafts)) drafts = [];
        fullDataCache.draft = drafts;
        pagination.draft.total = drafts.length;
        pagination.draft.hasMore = false;
        renderTabData(tab);
    } catch (err) {
        console.error('加载草稿失败', err);
        document.getElementById('draftList').innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    }
}

async function loadChangelogs(append = false) {
    const tab = 'changelog';
    const pg = pagination[tab];
    if (pg.loading) return;
    if (!append) {
        pg.page = 1;
        pg.hasMore = true;
        fullDataCache.changelog = [];
    }
    if (!pg.hasMore && append) return;
    pg.loading = true;
    try {
        const res = await apiRequest(`/api/changelogs?page=${pg.page}&limit=${pg.limit}`);
        let logs = res.items || [];
        pg.total = res.total || 0;
        pg.hasMore = logs.length === pg.limit && (pg.page * pg.limit) < pg.total;
        if (append) {
            fullDataCache.changelog = [...fullDataCache.changelog, ...logs];
        } else {
            fullDataCache.changelog = logs;
        }
        renderTabData(tab);
        if (pg.hasMore && append) {
            const container = document.getElementById('changelogList');
            if (container && !container.querySelector('.pagination-more')) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'pagination-more';
                moreBtn.innerHTML = `<button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button>`;
                container.appendChild(moreBtn);
            }
        }
    } catch (err) {
        console.error('加载更新日志失败', err);
        const container = document.getElementById('changelogList');
        if (container) container.innerHTML = '<div class="empty-message"><i class="ri-error-warning-line"></i> 加载失败，请刷新重试</div>';
    } finally {
        pg.loading = false;
    }
}

// ==================== 渲染函数 ====================
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
    if (!Array.isArray(data)) {
        console.warn(`renderTabData: ${tab} 数据不是数组`, data);
        const container = document.getElementById(getContainerId(tab));
        if (container) container.innerHTML = '<div class="empty-message">数据格式错误，请刷新重试</div>';
        return;
    }

    const isMobile = window.innerWidth <= 768;
    let displayData = data;
    let showMore = false;
    if (isMobile && data.length > mobilePageLimit[tab]) {
        displayData = data.slice(0, mobilePageLimit[tab]);
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

    if (showMore) {
        html += `<div class="pagination-more"><button class="load-more-btn" onclick="loadMore('${tab}')"><i class="ri-arrow-down-line"></i> 加载更多</button></div>`;
    }
    container.innerHTML = html;
}

// 加载更多（移动端/分页通用）
window.loadMore = function (tab) {
    const pg = pagination[tab];
    if (pg.loading || !pg.hasMore) return;
    pg.page++;
    if (tab === 'published') loadPosts(true);
    else if (tab === 'scheduled') loadScheduled(true);
    else if (tab === 'draft') {
        // 草稿不支持分页，提示无更多
        alert('草稿暂不支持分页，请下拉刷新');
        pg.hasMore = false;
    } else if (tab === 'changelog') loadChangelogs(true);
};

// 刷新当前标签页数据
function refreshCurrentTabData() {
    if (currentTab === 'published') loadPosts(false);
    else if (currentTab === 'scheduled') loadScheduled(false);
    else if (currentTab === 'draft') loadDrafts(false);
    else if (currentTab === 'changelog') loadChangelogs(false);
}

// 切换标签页
function switchTab(tab) {
    currentTab = tab;
    // PC端选项卡样式
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    const pcBtn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (pcBtn) pcBtn.classList.add('active');
    // 移动端底部导航样式
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => item.classList.remove('active'));
    const mobileItem = document.querySelector(`.bottom-nav .nav-item[data-tab="${tab}"]`);
    if (mobileItem) mobileItem.classList.add('active');
    // 显示对应列表容器
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

function loadCurrentTab() {
    if (typeof currentTab === 'undefined') {
        currentTab = 'published';
    }
    switchTab(currentTab);
}

// ==================== 跨标签页数据同步 ====================
function notifyDataUpdate() {
    localStorage.setItem('admin_data_updated', Date.now().toString());
    refreshCurrentTabData();
}

window.addEventListener('storage', (e) => {
    if (e.key === 'admin_data_updated') {
        console.log('检测到其他标签页的内容更新，刷新当前数据');
        refreshCurrentTabData();
    }
});

// ==================== 表单与模态框操作 ====================
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

async function handlePublish() {
    const formData = collectFormData();
    if (!formData.date) {
        alert('请选择日期');
        return;
    }

    // 清理前端专用字段，只保留后端需要的字段
    const cleanData = {
        date: formData.date,
        music: formData.music || {},
        sentence: formData.sentence || {},
        article: formData.article || {}
    };

    try {
        // 1. 草稿转发布（草稿编辑后直接发布）
        if (currentMode === 'editDraft' && editTargetId) {
            if (formData.publishType === 'immediate') {
                await addPost(cleanData);
            } else {
                await addScheduled({ date: formData.date, publishTime: `${formData.date}T00:00:00`, content: cleanData });
            }
            await deleteDraftById(editTargetId);
            alert('发布成功');
            closeModal();
            notifyDataUpdate();
            return;
        }

        // 2. 编辑已发布内容（支持日期迁移并保留统计数据）
        if (currentMode === 'editPost' && editTargetDate) {
            const oldDate = editTargetDate;
            const newDate = formData.date;

            // 日期发生变化 → 使用迁移接口
            if (oldDate !== newDate) {
                try {
                    const response = await fetch(`${API_BASE}/api/posts/${oldDate}/move`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getAuthToken()}`
                        },
                        body: JSON.stringify({ newDate, content: cleanData })
                    });

                    if (!response.ok) {
                        if (response.status === 409) {
                            alert(`日期 ${newDate} 已有内容发布，请选择其他日期`);
                            return;
                        }
                        const errText = await response.text();
                        throw new Error(errText || '迁移失败');
                    }

                    // 迁移本地收藏状态（如果存在此函数）
                    if (typeof migrateLocalFavorites === 'function') {
                        await migrateLocalFavorites(oldDate, newDate);
                    }

                    alert(`内容已从 ${oldDate} 移至 ${newDate}，统计数据已保留`);
                    closeModal();
                    notifyDataUpdate();

                    // 如果收藏页面当前打开，刷新
                    if (document.body.classList.contains('favorites-open') && typeof renderFavorites === 'function') {
                        renderFavorites();
                    }
                    return;
                } catch (err) {
                    console.error('日期迁移失败', err);
                    alert('修改日期失败：' + (err.message || '请检查网络或联系管理员'));
                    return;
                }
            } 
            // 日期未变 → 普通更新
            else {
                await updatePost(editTargetDate, cleanData);
                alert('内容已更新');
                closeModal();
                notifyDataUpdate();
                return;
            }
        }

        // 3. 编辑定时任务（支持转为立即发布）
        if (currentMode === 'editScheduled' && editTargetId) {
            if (formData.publishType === 'immediate') {
                // 立即发布：先调用 addPost，成功后再删除原定时任务
                await addPost(cleanData);
                try {
                    await deleteScheduledById(editTargetId);
                } catch (delErr) {
                    console.error('删除原定时任务失败，请手动清理', delErr);
                    alert('发布成功，但原定时任务删除失败，请手动到定时任务列表中删除');
                }
                alert('已立即发布');
                closeModal();
                notifyDataUpdate();
                if (currentTab === 'scheduled') {
                    switchTab('published');
                }
                return;
            } else {
                // 仍为定时发布，更新定时任务
                await updateScheduled(editTargetId, { date: formData.date, publishTime: `${formData.date}T00:00:00`, content: cleanData });
                alert('定时任务已更新');
                closeModal();
                notifyDataUpdate();
                return;
            }
        }

        // 4. 新增发布（正常模式）
        if (formData.publishType === 'immediate') {
            await addPost(cleanData);
        } else {
            await addScheduled({ date: formData.date, publishTime: `${formData.date}T00:00:00`, content: cleanData });
        }
        alert('发布成功');
        closeModal();
        notifyDataUpdate();

    } catch (err) {
        console.error('发布失败', err);
        // 针对日期冲突的友好提示
        if (err.status === 409 || (err.message && err.message.includes('已存在'))) {
            alert(`日期 ${formData.date} 已有内容发布，请更换日期后再试。`);
        } else {
            alert('发布失败：' + (err.message || '请重试'));
        }
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

// ==================== 回收站模块 ====================
async function addToTrash(originalType, originalId, dataPayload) {
    const token = getAuthToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/api/trash`, {
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
    const token = getAuthToken();
    if (!token) return [];
    const res = await fetch(`${API_BASE}/api/trash`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('获取回收站失败');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
}

async function restoreTrashItem(trashId, type, originalData) {
    const token = getAuthToken();
    if (!token) throw new Error('未登录');

    let restoreSuccess = false;

    // 对 post 类型，确保数据格式为标准结构 { date, music, sentence, article }
    let normalizedData = originalData;
    if (type === 'post') {
        // 如果 originalData 含有 content 字段，则提取
        if (originalData.content && !originalData.music) {
            normalizedData = {
                date: originalData.date,
                music: originalData.content.music || {},
                sentence: originalData.content.sentence || {},
                article: originalData.content.article || {}
            };
        } else if (!originalData.music && !originalData.sentence && !originalData.article) {
            // 异常数据，尝试补救
            normalizedData = {
                date: originalData.date || '',
                music: {},
                sentence: {},
                article: {}
            };
        }
    }

    try {
        if (type === 'post') {
            // 检查日期是否冲突
            const checkRes = await fetch(`${API_BASE}/api/posts/${normalizedData.date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (checkRes.ok) {
                const existing = await checkRes.json();
                if (existing && Object.keys(existing).length > 0) {
                    throw new Error(`日期 ${normalizedData.date} 已存在内容，请先删除或修改日期后再恢复。`);
                }
            }
            await apiRequest('/api/posts', { method: 'POST', body: JSON.stringify(normalizedData) });
            restoreSuccess = true;
        } else if (type === 'scheduled') {
            const payload = {
                date: originalData.date,
                publishTime: `${originalData.date}T00:00:00`,
                content: originalData.content || originalData   // 兼容存储结构
            };
            await apiRequest('/api/scheduled', { method: 'POST', body: JSON.stringify(payload) });
            restoreSuccess = true;
        } else if (type === 'draft') {
            await apiRequest('/api/drafts', { method: 'POST', body: JSON.stringify(originalData) });
            restoreSuccess = true;
        } else if (type === 'changelog') {
            await apiRequest('/api/changelogs', { method: 'POST', body: JSON.stringify(originalData) });
            restoreSuccess = true;
        }
    } catch (err) {
        console.error('恢复操作失败:', err);
        throw err;   // 向上抛出，让调用方捕获并提示
    }

    if (restoreSuccess) {
        await apiRequest(`/api/trash/${trashId}`, { method: 'DELETE' });
        return true;
    }
    return false;
}

async function permanentDeleteTrashItem(trashId) {
    const token = getAuthToken();
    if (!token) throw new Error('未登录');
    const res = await fetch(`${API_BASE}/api/trash/${trashId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('彻底删除失败');
    return true;
}

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
                        await loadTrashData();           // 刷新回收站
                        refreshCurrentTabData();          // 刷新主列表
                    }
                } catch (err) {
                    console.error(err);
                    alert('恢复失败: ' + (err.message || '请检查日期是否冲突或网络问题'));
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

// ==================== 劫持删除函数（移入回收站） ====================
const originalDeletePost = window.deletePost;
const originalDeleteScheduled = window.deleteScheduled;
const originalDeleteDraft = window.deleteDraft;
const originalDeleteChangelog = window.deleteChangelog;

window.deletePost = async function (date) {
    if (!confirm('删除后内容将移至回收站，可恢复。确定删除吗？')) return;
    try {
        let postData = null;
        if (fullDataCache.published) {
            const cached = fullDataCache.published.find(p => p.date === date);
            if (cached) {
                // 标准化存储：只保留必要字段
                postData = {
                    date: cached.date,
                    music: cached.content?.music || {},
                    sentence: cached.content?.sentence || {},
                    article: cached.content?.article || {}
                };
            }
        }
        if (!postData) {
            const response = await apiRequest(`/api/posts/${date}`);
            // 后端返回的是 { music, sentence, article, musicStats... }
            postData = {
                date: date,
                music: response.music || {},
                sentence: response.sentence || {},
                article: response.article || {}
            };
        }
        await addToTrash('post', date, postData);
        await deletePostByDate(date);
        notifyDataUpdate();
    } catch (err) {
        console.error('删除失败', err);
        alert('删除失败: ' + (err.message || '未知错误'));
    }
};

window.deleteScheduled = async function (id) {
    if (!confirm('删除定时任务后将移入回收站，确定删除？')) return;
    try {
        const response = await apiRequest('/api/scheduled?page=1&limit=100');
        const tasks = response.items || [];
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

window.deleteDraft = async function (id) {
    if (!confirm('删除草稿后将移入回收站，可恢复。确定删除？')) return;
    try {
        const response = await apiRequest('/api/drafts?page=1&limit=100');
        const drafts = response.items || [];
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

window.deleteChangelog = async function (id) {
    if (!confirm('删除日志后将移入回收站，确定删除？')) return;
    try {
        // 修复：正确解析分页响应，获取 items 数组
        const response = await apiRequest('/api/changelogs');
        const logs = response.items || [];
        const log = logs.find(l => l.id === id);
        
        let trashAdded = false;
        if (log) {
            try {
                await addToTrash('changelog', id, log);
                trashAdded = true;
            } catch (trashErr) {
                console.warn('移入回收站失败，将直接删除日志', trashErr);
                alert('回收站记录失败，但日志仍会删除');
            }
        } else {
            console.warn('未找到日志详情，跳过回收站记录，直接删除');
        }
        
        // 执行删除
        await deleteChangelogById(id);
        notifyDataUpdate();
        
        if (!trashAdded && log) {
            alert('日志已删除，但回收站记录失败，请稍后手动清理');
        } else if (!log) {
            alert('日志已删除（未记录回收站）');
        }
    } catch (err) {
        console.error('删除日志失败', err);
        alert('删除失败：' + (err.message || '未知错误，请检查网络或联系管理员'));
    }
};

// ==================== 编辑函数（保留原有编辑逻辑） ====================
window.editPost = async function (date) {
    try {
        let postData = null;
        // 优先从缓存获取，确保结构统一
        if (fullDataCache.published) {
            const cached = fullDataCache.published.find(p => p.date === date);
            if (cached) {
                // 兼容两种存储结构：{ content: {...} } 或直接包含 music/sentence/article
                postData = cached.content || cached;
            }
        }
        if (!postData) {
            const response = await apiRequest(`/api/posts/${date}`);
            // 根据实际后端返回结构调整，常见为 { music, sentence, article, stats... }
            postData = response.content || response;
        }
        // 验证必要字段
        if (!postData.music && !postData.sentence && !postData.article) {
            console.error('获取到的帖子数据格式异常', postData);
            alert('数据格式错误，无法编辑');
            return;
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
        alert('获取帖子详情失败：' + (err.message || '请检查网络'));
    }
};

window.editScheduled = async function (id) {
    try {
        // 获取第一页数据（如果任务不在第一页，需要循环获取，见下文优化）
        const response = await apiRequest('/api/scheduled?page=1&limit=100');  // 适当增大 limit
        const tasks = response.items || [];   // ✅ 正确提取数组
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
        } else {
            // 如果第一页没找到，可能需要加载更多分页（见下文进阶修复）
            alert('未找到该定时任务，可能不在当前分页中');
        }
    } catch (err) {
        console.error('获取定时任务失败', err);
        alert('获取定时任务失败');
    }
};

window.editDraft = async function (id) {
    try {
        const response = await apiRequest('/api/drafts?page=1&limit=100');
        const drafts = response.items || [];
        const draft = drafts.find(d => d.id === id);
        if (draft) {
            fillFormWithData(draft, draft.publishType);
            // ... 其余代码不变
        }
    } catch (err) {
        console.error('获取草稿失败', err);
        alert('获取草稿失败');
    }
};

// ==================== 登录与初始化 ====================
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

// ==================== DOM 元素获取与事件绑定 ====================
document.addEventListener('DOMContentLoaded', () => {
reportsPanel = document.getElementById('reportsPanel');
reportsListDiv = document.getElementById('reportsList');
backFromReportsBtn = document.getElementById('backFromReportsBtn');
reportsHeaderBtn = document.getElementById('reportsHeaderBtn');
sidebarReports = document.getElementById('sidebarReports');
// 密码显示/隐藏切换
const togglePwd = document.getElementById('togglePassword');
const pwdInput = document.getElementById('password');
if (reportsHeaderBtn) {
    reportsHeaderBtn.addEventListener('click', showReportsPanel);
}
if (backFromReportsBtn) {
    backFromReportsBtn.addEventListener('click', hideReportsPanel);
}
if (sidebarReports) {
    sidebarReports.addEventListener('click', () => {
        closeSidebar();
        showReportsPanel();
    });
}
if (togglePwd && pwdInput) {
    togglePwd.addEventListener('click', function () {
        const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
        pwdInput.setAttribute('type', type);
        // 切换图标样式
        this.classList.toggle('ri-eye-off-line');
        this.classList.toggle('ri-eye-line');
    });
}
    // 获取表单元素引用
    dateInput = document.getElementById('date');
    musicTitle = document.getElementById('musicTitle');
    musicArtist = document.getElementById('musicArtist');
    musicCover = document.getElementById('musicCover');
    musicSrc = document.getElementById('musicSrc');
    sentenceText = document.getElementById('sentenceText');
    sentenceAuthor = document.getElementById('sentenceAuthor');
    sentenceImageUrl = document.getElementById('sentenceImageUrl');
    articleTitle = document.getElementById('articleTitle');
    articleAuthor = document.getElementById('articleAuthor');
    articleContent = document.getElementById('articleContent');
    articleImageUrl = document.getElementById('articleImageUrl');
    saveDraftBtn = document.getElementById('saveDraftBtn');
    submitBtn = document.getElementById('submitFormBtn');
    modalTitle = document.getElementById('modalTitle');
    publishFields = document.getElementById('publishFields');
    changelogFields = document.getElementById('changelogFields');
    modalOverlay = document.getElementById('modalOverlay');
    closeModalBtn = document.getElementById('closeModalBtn');
    cancelFormBtn = document.getElementById('cancelFormBtn');

    // 绑定自适应文本域
    bindAutoResizeForTextarea(sentenceText);
    bindAutoResizeForTextarea(articleContent);
    const changelogContent = document.getElementById('changelogContent');
    if (changelogContent) bindAutoResizeForTextarea(changelogContent);

    // 图片预览
    setupUrlPreview(articleImageUrl, document.getElementById('imagePreview'), document.getElementById('imagePreviewContainer'));
    setupUrlPreview(sentenceImageUrl, document.getElementById('sentenceImagePreview'), document.getElementById('sentenceImagePreviewContainer'));

    // 选项卡事件
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

    // 新建发布按钮
    document.getElementById('newPostBtn')?.addEventListener('click', () => {
        resetForm();
        saveDraftBtn.style.display = 'inline-flex';
        submitBtn.innerHTML = '<i class="ri-save-3-line"></i> 保存发布';
        currentMode = 'normal';
        publishFields.style.display = 'block';
        changelogFields.style.display = 'none';
        modalTitle.innerHTML = '<i class="ri-add-circle-line"></i> 新建发布内容';
        openModal();
    });

    // 新增更新日志按钮
    document.getElementById('newChangelogBtn')?.addEventListener('click', openChangelogModal);

    // 保存草稿 / 发布 / 取消
    saveDraftBtn?.addEventListener('click', saveAsDraft);
    submitBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentMode === 'changelog') saveChangelog();
        else handlePublish();
    });
    cancelFormBtn?.addEventListener('click', closeModal);
    closeModalBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // 回收站按钮
    const trashBtn = document.getElementById('trashBinBtn');
    if (trashBtn) trashBtn.addEventListener('click', openTrashModal);
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
});
// ==================== 侧边栏交互 ====================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openSidebar);
}
if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeSidebar);
}
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// ==================== 侧边栏菜单项功能 ====================
// 评论管理（侧边栏）
const sidebarComments = document.getElementById('sidebarComments');
if (sidebarComments) {
    sidebarComments.addEventListener('click', () => {
        closeSidebar();
        showCommentsPanel();
    });
}
// 回收站（侧边栏）
const sidebarTrash = document.getElementById('sidebarTrash');
if (sidebarTrash) {
    sidebarTrash.addEventListener('click', () => {
        closeSidebar();
        openTrashModal();
    });
}
// 退出登录（侧边栏）
const sidebarLogout = document.getElementById('sidebarLogout');
if (sidebarLogout) {
    sidebarLogout.addEventListener('click', () => {
        closeSidebar();
        clearAuthToken();
        showLogin();
    });
}

// ==================== 评论管理完整功能 ====================
const commentsPanel = document.getElementById('commentsPanel');
const commentsListDiv = document.getElementById('commentsList');
const backFromCommentsBtn = document.getElementById('backFromCommentsBtn');
const commentsHeaderBtn = document.getElementById('commentsHeaderBtn'); // PC顶部按钮

// 显示评论面板（隐藏主列表容器）
function showCommentsPanel() {
    // 隐藏所有列表容器
    const containers = ['postList', 'scheduledList', 'draftList', 'changelogList'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    // 显示评论面板
    if (commentsPanel) commentsPanel.style.display = 'block';
    // 加载评论数据
    loadComments();
}

// 隐藏评论面板，恢复当前标签页视图
function hideCommentsPanel() {
    if (commentsPanel) commentsPanel.style.display = 'none';
    // 重新显示当前激活的标签页对应的列表容器
    const activeContainerId = getContainerId(currentTab);
    const activeContainer = document.getElementById(activeContainerId);
    if (activeContainer) activeContainer.style.display = 'grid';
    // 重新加载当前标签页数据（确保刷新）
    refreshCurrentTabData();
}

// 返回按钮事件
if (backFromCommentsBtn) {
    backFromCommentsBtn.addEventListener('click', hideCommentsPanel);
}
// PC顶部评论管理按钮
if (commentsHeaderBtn) {
    commentsHeaderBtn.addEventListener('click', showCommentsPanel);
}

async function loadComments() {
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<div class="empty-message"><i class="ri-loader-4-line spin"></i> 加载评论中...</div>';
    try {
        const token = getAuthToken();
        // 修改点 1：使用 /api/comments/all 获取所有评论
        const response = await fetch(`${API_BASE}/api/comments/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('获取评论失败');
        const comments = await response.json();
        // 后端返回的是数组
        const commentArray = Array.isArray(comments) ? comments : [];
        if (commentArray.length === 0) {
            commentsListDiv.innerHTML = '<div class="empty-message"><i class="ri-chat-3-line"></i> 暂无评论</div>';
            return;
        }
        // 渲染评论列表
        let html = '';
        for (const comment of commentArray) {
            // 修改点 2：字段名映射
            const nickname = escapeHtml(comment.nickname || '匿名');
            const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString() : '未知时间';
            const content = escapeHtml(comment.content || '');
            const postDate = comment.date || '未知日期';
            const typeMap = { music: '音乐', sentence: '句子', article: '文章' };
            const typeText = typeMap[comment.type] || comment.type;

            html += `
                <div class="comment-card" data-id="${comment.id}">
                    <div class="comment-meta">
                        <span class="comment-user"><i class="ri-user-line"></i> ${nickname}</span>
                        <span>${createdAt}</span>
                    </div>
                    <div class="comment-content">${content}</div>
                    <div class="comment-target">
                        <i class="ri-file-copy-line"></i> 关联：${postDate} (${typeText})
                    </div>
                    <div class="comment-actions">
                        <button class="delete-comment-btn" data-id="${comment.id}"><i class="ri-delete-bin-line"></i> 删除评论</button>
                    </div>
                </div>
            `;
        }
        commentsListDiv.innerHTML = html;
        // 绑定删除按钮事件（保持原有逻辑）
        document.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.id;
                if (confirm('确定删除这条评论吗？')) {
                    try {
                        const delRes = await fetch(`${API_BASE}/api/comments/${commentId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                        });
                        if (!delRes.ok) throw new Error('删除失败');
                        alert('评论已删除');
                        loadComments(); // 刷新列表
                    } catch (err) {
                        console.error(err);
                        alert('删除失败：' + err.message);
                    }
                }
            });
        });
    } catch (err) {
        console.error('加载评论失败', err);
        commentsListDiv.innerHTML = `<div class="empty-message"><i class="ri-error-warning-line"></i> 加载评论失败：${err.message}</div>`;
    }
}