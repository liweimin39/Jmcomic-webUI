import { jmApi } from '../api/JmcomicApi.js';
import { userApi } from '../api/UserApi.js';
import { NavManager } from '../components/general/NavManager.js';
import { setting } from '../components/general/Setting.js';
import { SwitchServerBtnManager } from '../components/general/SwitchServerBtnManager.js';

class UserPage {
    constructor() {
        this.content = document.getElementById('user-content');
        this.userInfo = null;
        this.currentTab = 'favorites';
        this.favoritePage = 1;
        this.trackingPage = 1;
        this.notificationPage = 1;
        this.notificationType = 'all';
        this.notificationList = [];
        this.notificationTotal = 0;
        this.notificationUnread = 0;
        // 登出相关的 AbortController
        this.logoutController = null;
        // 是否正在登出
        this.isLoggingOut = false;
    }

    async init() {
        setting.init();
        await jmApi.init();

        new NavManager().init();
        new SwitchServerBtnManager().init();

        this.restoreSession();
        this.render();
        this.bindEvents();
        
        this.updateNotificationBadge();
    }

    restoreSession() {
        const token = localStorage.getItem('jwttoken');
        const info = localStorage.getItem('userInfo');
        if (token && info) {
            this.userInfo = JSON.parse(info);
        }
    }

    render() {
        if (this.userInfo) {
            this.renderLoggedIn();
        } else {
            this.renderLoggedOut();
        }
    }

    renderLoggedOut() {
        this.content.innerHTML = `
            <div class="auth-container">
                <div class="auth-tabs">
                    <span class="auth-tab active" data-tab="login">登录</span>
                    <span class="auth-tab" data-tab="register">注册</span>
                    <span class="auth-tab" data-tab="forgot">忘记密码</span>
                </div>
                <div class="auth-form" id="login-form">
                    <h2>登录</h2>
                    <input type="text" id="login-username" placeholder="用户名">
                    <input type="password" id="login-password" placeholder="密码">
                    <button id="login-btn">登录</button>
                    <div id="login-message" class="msg"></div>
                </div>
                <div class="auth-form" id="register-form" style="display:none;">
                    <h2>注册</h2>
                    <input type="text" id="reg-username" placeholder="用户名">
                    <input type="email" id="reg-email" placeholder="邮箱">
                    <input type="password" id="reg-password" placeholder="密码">
                    <input type="password" id="reg-password-confirm" placeholder="确认密码">
                    <select id="reg-gender">
                        <option value="">性别（可选）</option>
                        <option value="Male">男</option>
                        <option value="Female">女</option>
                    </select>
                    <button id="register-btn">注册</button>
                    <div id="register-message" class="msg"></div>
                </div>
                <div class="auth-form" id="forgot-form" style="display:none;">
                    <h2>重置密码</h2>
                    <input type="email" id="forgot-email" placeholder="注册邮箱">
                    <button id="forgot-btn">发送重置邮件</button>
                    <div id="forgot-message" class="msg"></div>
                </div>
            </div>
        `;
    }

    renderLoggedIn() {
        const info = this.userInfo;
        this.content.innerHTML = `
            <div class="user-profile">
                <div class="user-header">
                    <img src="${jmApi.getUserPhotoURL(info.photo)}" alt="头像" class="user-avatar">
                    <div class="user-details">
                        <h2>${info.username}</h2>
                        <p>等级: ${info.level_name} (Lv.${info.level})</p>
                        <p>金币: ${info.coin}</p>
                        <p>经验: ${info.exp} / ${info.nextLevelExp}</p>
                    </div>
                    <button id="logout-btn" class="logout-btn">登出</button>
                </div>
                <div class="user-tabs">
                    <span class="user-tab active" data-tab="favorites">收藏 (${info.album_favorites || 0})</span>
                    <span class="user-tab" data-tab="tracking">追踪</span>
                    <span class="user-tab" data-tab="notifications">信箱</span>
                </div>
                <div id="user-list-container"></div>
            </div>
        `;
        this.loadFavorites();
    }

    bindEvents() {
        this.content.addEventListener('click', (e) => {
            // 认证标签切换
            const tab = e.target.closest('.auth-tab');
            if (tab) {
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
                document.getElementById(tabName + '-form').style.display = 'block';
                const msg = document.getElementById(tabName + '-message');
                if (msg) { msg.textContent = ''; msg.style.color = ''; }
            }

            // 用户标签切换
            const userTab = e.target.closest('.user-tab');
            if (userTab) {
                const tabName = userTab.dataset.tab;
                document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
                userTab.classList.add('active');
                this.currentTab = tabName;
                if (tabName === 'favorites') this.loadFavorites();
                else if (tabName === 'tracking') this.loadTracking();
                else if (tabName === 'notifications') this.loadNotifications();
            }

            // 按钮事件
            if (e.target.id === 'login-btn') this.handleLogin();
            if (e.target.id === 'register-btn') this.handleRegister();
            if (e.target.id === 'forgot-btn') this.handleForgot();
            if (e.target.id === 'logout-btn') this.handleLogout();
            
            // 通知类型切换（事件委托）
            const typeBtn = e.target.closest('.notif-type-btn');
            if (typeBtn) {
                const type = typeBtn.dataset.type;
                if (type && type !== this.notificationType) {
                    document.querySelectorAll('.notif-type-btn').forEach(b => b.classList.remove('active'));
                    typeBtn.classList.add('active');
                    this.notificationType = type;
                    this.notificationPage = 1;
                    this.loadNotifications();
                }
            }
        });
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const msg = document.getElementById('login-message');
        if (!username || !password) {
            msg.textContent = '请填写完整信息';
            msg.style.color = '#d9534f';
            return;
        }
        try {
            const result = await userApi.login(username, password);
            this.userInfo = result;
            this.render();
            this.updateNotificationBadge();
        } catch (err) {
            msg.textContent = err.message || '登录失败';
            msg.style.color = '#d9534f';
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-password-confirm').value;
        const gender = document.getElementById('reg-gender').value;
        const msg = document.getElementById('register-message');
        if (!username || !email || !password || !confirm) {
            msg.textContent = '请填写所有必填项';
            msg.style.color = '#d9534f';
            return;
        }
        if (password !== confirm) {
            msg.textContent = '两次密码输入不一致';
            msg.style.color = '#d9534f';
            return;
        }
        try {
            const result = await userApi.register(username, email, password, confirm, gender);
            msg.textContent = result.msg || '注册成功，请查收邮件验证';
            msg.style.color = 'green';
        } catch (err) {
            msg.textContent = err.message || '注册失败';
            msg.style.color = '#d9534f';
        }
    }

    async handleForgot() {
        const email = document.getElementById('forgot-email').value.trim();
        const msg = document.getElementById('forgot-message');
        if (!email) {
            msg.textContent = '请输入邮箱';
            msg.style.color = '#d9534f';
            return;
        }
        try {
            const result = await userApi.forgotPassword(email);
            msg.textContent = result.msg || '重置邮件已发送，请查收';
            msg.style.color = 'green';
        } catch (err) {
            msg.textContent = err.message || '发送失败';
            msg.style.color = '#d9534f';
        }
    }

    /**
     * 优化后的登出方法
     * 1. 立即清除本地状态（乐观更新），界面立刻响应
     * 2. 异步请求登出接口，不阻塞UI
     * 3. 使用 AbortController 管理请求，避免重复请求
     * 4. 接口失败时静默处理，不阻塞用户
     */
    handleLogout() {
        // 防止重复点击
        if (this.isLoggingOut) return;
        this.isLoggingOut = true;

        // 获取登出按钮，显示加载状态
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.textContent = '登出中...';
            logoutBtn.disabled = true;
        }

        // 保存用户信息用于请求（登出接口可能需要）
        const currentUserInfo = this.userInfo;

        // ---- 第一步：立即清除本地状态（乐观更新） ----
        // 清除 localStorage
        localStorage.removeItem('jwttoken');
        localStorage.removeItem('userInfo');
        
        // 更新内存状态
        this.userInfo = null;
        
        // 立即更新 UI（显示登录界面）
        this.render();
        this.updateNotificationBadge();
        
        // 更新导航栏的用户名
        this.updateNavUser();

        // ---- 第二步：异步请求登出接口（不阻塞UI） ----
        // 取消之前的登出请求
        if (this.logoutController) {
            this.logoutController.abort();
            this.logoutController = null;
        }

        // 创建新的 AbortController
        this.logoutController = new AbortController();
        const signal = this.logoutController.signal;

        // 使用 Promise.race 实现超时控制（5秒超时）
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('登出请求超时')), 5000);
        });

        // 执行登出请求（带超时）
        Promise.race([
            this.performLogout(currentUserInfo, signal),
            timeoutPromise
        ])
        .catch((err) => {
            // 如果是 AbortError，说明请求被取消，忽略
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                console.log('登出请求已取消');
                return;
            }
            // 其他错误静默处理（已经本地登出了）
            console.warn('登出接口请求失败（已本地登出）:', err.message);
        })
        .finally(() => {
            // 清理状态
            this.logoutController = null;
            this.isLoggingOut = false;
            
            // 恢复按钮状态（如果还在登录页，按钮已被移除）
            if (logoutBtn && document.getElementById('logout-btn')) {
                logoutBtn.textContent = '登出';
                logoutBtn.disabled = false;
            }
        });
    }

    /**
     * 执行实际的登出请求（支持重试）
     */
    async performLogout(userInfo, signal) {
        // 如果没有 token，直接返回
        if (!userInfo || !userInfo.jwttoken) {
            return;
        }

        // 尝试多个服务器，每个服务器最多尝试1次，总共最多3次
        const servers = jmApi.servers || [];
        const maxRetries = Math.min(servers.length, 3);
        
        let lastError = null;

        for (let i = 0; i < maxRetries; i++) {
            // 检查是否已取消
            if (signal && signal.aborted) {
                throw new DOMException('Request cancelled', 'AbortError');
            }

            const serverIndex = i % servers.length;
            const server = servers[serverIndex];
            
            try {
                const url = `https://${server}/logout`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'token': jmApi.accessToken.token,
                        'tokenParam': jmApi.accessToken.tokenParam,
                        'Authorization': `Bearer ${userInfo.jwttoken || ''}`
                    },
                    body: '',
                    signal: signal // 支持取消
                });

                // 无论响应状态如何，只要请求完成就算成功（本地已登出）
                // 但如果是网络错误，继续重试
                if (!response.ok) {
                    // 如果是 401/403，说明 token 已失效，视为成功
                    if (response.status === 401 || response.status === 403) {
                        console.log('Token已失效，登出成功');
                        return;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                // 读取响应（但不需要等待解析完成）
                // 异步读取，不阻塞
                response.text().catch(() => {});
                return;

            } catch (err) {
                // 如果是取消错误，立即抛出
                if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                    throw err;
                }
                lastError = err;
                console.warn(`登出请求失败 (服务器 ${server}):`, err.message);
                // 继续重试
            }
        }

        // 所有重试都失败，抛出最后一个错误
        throw lastError || new Error('所有登出请求均失败');
    }

    /**
     * 更新导航栏中的用户链接文字
     */
    updateNavUser() {
        const userLinks = document.querySelectorAll('.user-nav-link');
        userLinks.forEach(link => {
            const span = link.querySelector('span');
            if (span) {
                // 如果已登出，显示"登录"
                if (!this.userInfo) {
                    span.textContent = '登录';
                } else {
                    span.textContent = this.userInfo.username;
                }
            }
        });
    }

    async loadFavorites(page = 1) {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        container.innerHTML = '<div class="loading-icon"></div>';
        try {
            const data = await userApi.getFavoriteList(page);
            container.innerHTML = this.renderComicList(data.list || []);
        } catch (err) {
            container.innerHTML = `<p style="color:#d9534f;">加载失败: ${err.message || '未知错误'}</p>`;
        }
    }

    async loadTracking(page = 1) {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        container.innerHTML = '<div class="loading-icon"></div>';
        try {
            const data = await userApi.getTrackingList(page);
            container.innerHTML = this.renderComicList(data.item || []);
        } catch (err) {
            container.innerHTML = `<p style="color:#d9534f;">加载失败: ${err.message || '未知错误'}</p>`;
        }
    }

    async loadNotifications(page = 1) {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        container.innerHTML = '<div class="loading-icon"></div>';
        try {
            const data = await userApi.getNotifications(this.notificationType, page);
            
            let list = [];
            let total = 0;
            let unread = 0;
            
            if (Array.isArray(data)) {
                list = data;
                total = data.length;
                unread = data.filter(item => !item.read && !item.is_read).length;
            } else if (data && data.list && Array.isArray(data.list)) {
                list = data.list;
                total = data.total || list.length;
                unread = data.unread || 0;
            } else if (data && data.data && Array.isArray(data.data)) {
                list = data.data;
                total = data.total || list.length;
                unread = data.unread || 0;
            } else {
                list = [];
                total = 0;
                unread = 0;
            }
            
            this.notificationList = list;
            this.notificationTotal = total;
            this.notificationUnread = unread;
            
            this.renderNotificationsFull();
            
            if (unread !== undefined) {
                this.updateNotificationBadge(unread);
            }
        } catch (err) {
            console.error('加载通知失败:', err);
            container.innerHTML = `<p style="color:#d9534f;">加载失败: ${err.message || '未知错误'}</p>`;
        }
    }

    // 渲染完整的通知区域（按钮 + 统计 + 列表）
    renderNotificationsFull() {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        
        const list = this.notificationList || [];
        const total = this.notificationTotal || 0;
        const unread = this.notificationUnread || 0;
        
        // 构建按钮和统计区域
        const typeButtons = `
            <div class="notif-types">
                <span class="notif-type-btn ${this.notificationType === 'all' ? 'active' : ''}" data-type="all">全部</span>
                <span class="notif-type-btn ${this.notificationType === 'comic_follow' ? 'active' : ''}" data-type="comic_follow">漫画更新</span>
                <span class="notif-type-btn ${this.notificationType === 'site_notice' ? 'active' : ''}" data-type="site_notice">系统公告</span>
            </div>
            <div class="notif-stats">共 ${total} 条通知，未读 ${unread} 条</div>
            <div class="notif-list"></div>
        `;
        
        container.innerHTML = typeButtons;
        
        // 渲染列表项
        this.renderNotifications();
    }

    // 只渲染列表项（不重建按钮）
    renderNotifications() {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        
        const list = this.notificationList || [];
        const listEl = container.querySelector('.notif-list');
        if (!listEl) return;
        
        // 更新统计信息
        const statsEl = container.querySelector('.notif-stats');
        if (statsEl) {
            statsEl.textContent = `共 ${this.notificationTotal || 0} 条通知，未读 ${this.notificationUnread || 0} 条`;
        }
        
        if (!list || !list.length) {
            listEl.innerHTML = `<div class="notif-empty"><p>暂无通知</p></div>`;
            return;
        }
        
        const items = list.map(item => {
            const isRead = item.read || item.is_read || false;
            const date = item.date || '';
            let contentHtml = '';
            
            if (item.type === 'comic_follow') {
                const updates = item.content || [];
                contentHtml = updates.map(update => `
                    <div class="notif-comic-update">
                        <a href="./chapter.html?id=${update.comicId}" class="notif-comic-link">
                            ${update.comicTitle || '未知漫画'}
                        </a>
                        <span class="notif-update-date">更新于 ${update.updateDate || date}</span>
                    </div>
                `).join('');
            } else if (item.type === 'site_notice') {
                contentHtml = `
                    <div class="notif-site-content">
                        ${item.content || ''}
                    </div>
                `;
            } else {
                const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '');
                contentHtml = `<div class="notif-content">${content}</div>`;
            }
            
            return `
                <div class="notif-item ${isRead ? 'read' : 'unread'}">
                    <div class="notif-header">
                        <span class="notif-type-tag">${item.type === 'comic_follow' ? '漫画更新' : '系统公告'}</span>
                        <span class="notif-status">${isRead ? '已读' : '未读'}</span>
                        <span class="notif-date">${date}</span>
                    </div>
                    ${item.title ? `<div class="notif-title">${item.title}</div>` : ''}
                    <div class="notif-body">
                        ${contentHtml}
                    </div>
                </div>
            `;
        }).join('');
        
        listEl.innerHTML = items;
    }

    updateNotificationBadge(unread = null) {
        const userLinks = document.querySelectorAll('.user-nav-link');
        if (!userLinks.length) return;
        
        if (unread === null && this.userInfo) {
            userApi.getNotifications('all', 1).then(data => {
                let count = 0;
                if (Array.isArray(data)) {
                    count = data.filter(item => !item.read && !item.is_read).length;
                } else if (data && data.unread !== undefined) {
                    count = data.unread;
                }
                this._updateBadgeText(count);
            }).catch(() => {});
        } else {
            this._updateBadgeText(unread);
        }
    }

    _updateBadgeText(unread) {
        const userLinks = document.querySelectorAll('.user-nav-link');
        userLinks.forEach(link => {
            const span = link.querySelector('span');
            if (span) {
                if (unread && unread > 0 && this.userInfo) {
                    span.textContent = `信箱 ${unread}`;
                } else if (this.userInfo) {
                    span.textContent = this.userInfo.username;
                } else {
                    span.textContent = '登录';
                }
            }
        });
    }

    renderComicList(list) {
        if (!list || !list.length) return '<p>暂无内容</p>';
        return `<div class="comics-cr">${list.map(item => `
            <div class="comic-item">
                <a class="cover" href="./chapter.html?id=${item.id}">
                    <img src="${jmApi.getCoverImageURL(item.id)}" alt="封面">
                </a>
                <h1 class="c-title">${item.name}</h1>
                <h2 class="c-sr-title">${item.author || ''}</h2>
            </div>
        `).join('')}</div>`;
    }
}

const app = new UserPage();
app.init();