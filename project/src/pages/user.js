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
        // 加载状态
        this.loadingStates = {
            login: false,
            register: false,
            forgot: false,
            favorites: false,
            tracking: false,
            notifications: false
        };
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
                    <button id="login-btn">
                        <span class="btn-text">登录</span>
                        <span class="btn-loader" style="display:none;"></span>
                    </button>
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
                    <button id="register-btn">
                        <span class="btn-text">注册</span>
                        <span class="btn-loader" style="display:none;"></span>
                    </button>
                    <div id="register-message" class="msg"></div>
                </div>
                <div class="auth-form" id="forgot-form" style="display:none;">
                    <h2>重置密码</h2>
                    <input type="email" id="forgot-email" placeholder="注册邮箱">
                    <button id="forgot-btn">
                        <span class="btn-text">发送重置邮件</span>
                        <span class="btn-loader" style="display:none;"></span>
                    </button>
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
                    <button id="logout-btn" class="logout-btn">
                        <span class="btn-text">登出</span>
                        <span class="btn-loader" style="display:none;"></span>
                    </button>
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
            if (e.target.closest('#login-btn')) this.handleLogin(e);
            if (e.target.closest('#register-btn')) this.handleRegister(e);
            if (e.target.closest('#forgot-btn')) this.handleForgot(e);
            if (e.target.closest('#logout-btn')) this.handleLogout(e);
            
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

    // ----- 设置按钮加载状态 -----
    setButtonLoading(btn, loading) {
        if (!btn) return;
        const text = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.btn-loader');
        if (loading) {
            btn.disabled = true;
            if (text) text.style.display = 'none';
            if (loader) { loader.style.display = 'inline-block'; }
        } else {
            btn.disabled = false;
            if (text) text.style.display = 'inline';
            if (loader) { loader.style.display = 'none'; }
        }
    }

    // ----- 显示带加载动画的列表容器 -----
    showListLoader(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="list-loader-container">
                <div class="list-loader-spinner"></div>
                <p class="list-loader-text">加载中...</p>
            </div>
        `;
    }

    // ----- 显示空状态或错误状态 -----
    showListError(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="list-error-container">
                <span class="list-error-icon">⚠️</span>
                <p class="list-error-text">${message || '加载失败，请重试'}</p>
            </div>
        `;
    }

    showListEmpty(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="list-empty-container">
                <span class="list-empty-icon">📭</span>
                <p class="list-empty-text">${message || '暂无内容'}</p>
            </div>
        `;
    }

    async handleLogin(e) {
        const btn = document.getElementById('login-btn');
        if (this.loadingStates.login) return;
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const msg = document.getElementById('login-message');
        
        if (!username || !password) {
            msg.textContent = '请填写完整信息';
            msg.style.color = '#d9534f';
            return;
        }
        
        this.loadingStates.login = true;
        this.setButtonLoading(btn, true);
        msg.textContent = '';
        msg.style.color = '';
        
        try {
            const result = await userApi.login(username, password);
            this.userInfo = result;
            this.loadingStates.login = false;
            this.setButtonLoading(btn, false);
            this.render();
            this.updateNotificationBadge();
        } catch (err) {
            this.loadingStates.login = false;
            this.setButtonLoading(btn, false);
            msg.textContent = err.message || '登录失败';
            msg.style.color = '#d9534f';
        }
    }

    async handleRegister(e) {
        const btn = document.getElementById('register-btn');
        if (this.loadingStates.register) return;
        
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
        
        this.loadingStates.register = true;
        this.setButtonLoading(btn, true);
        msg.textContent = '';
        msg.style.color = '';
        
        try {
            const result = await userApi.register(username, email, password, confirm, gender);
            this.loadingStates.register = false;
            this.setButtonLoading(btn, false);
            msg.textContent = result.msg || '注册成功，请查收邮件验证';
            msg.style.color = 'green';
        } catch (err) {
            this.loadingStates.register = false;
            this.setButtonLoading(btn, false);
            msg.textContent = err.message || '注册失败';
            msg.style.color = '#d9534f';
        }
    }

    async handleForgot(e) {
        const btn = document.getElementById('forgot-btn');
        if (this.loadingStates.forgot) return;
        
        const email = document.getElementById('forgot-email').value.trim();
        const msg = document.getElementById('forgot-message');
        
        if (!email) {
            msg.textContent = '请输入邮箱';
            msg.style.color = '#d9534f';
            return;
        }
        
        this.loadingStates.forgot = true;
        this.setButtonLoading(btn, true);
        msg.textContent = '';
        msg.style.color = '';
        
        try {
            const result = await userApi.forgotPassword(email);
            this.loadingStates.forgot = false;
            this.setButtonLoading(btn, false);
            msg.textContent = result.msg || '重置邮件已发送，请查收';
            msg.style.color = 'green';
        } catch (err) {
            this.loadingStates.forgot = false;
            this.setButtonLoading(btn, false);
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
    handleLogout(e) {
        // 防止重复点击
        if (this.isLoggingOut) return;
        this.isLoggingOut = true;

        // 获取登出按钮，显示加载状态
        const logoutBtn = document.getElementById('logout-btn');
        this.setButtonLoading(logoutBtn, true);

        // 保存用户信息用于请求（登出接口可能需要）
        const currentUserInfo = this.userInfo;

        // ---- 第一步：立即清除本地状态（乐观更新） ----
        localStorage.removeItem('jwttoken');
        localStorage.removeItem('userInfo');
        this.userInfo = null;
        this.render();
        this.updateNotificationBadge();
        this.updateNavUser();

        // ---- 第二步：异步请求登出接口（不阻塞UI） ----
        if (this.logoutController) {
            this.logoutController.abort();
            this.logoutController = null;
        }

        this.logoutController = new AbortController();
        const signal = this.logoutController.signal;

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('登出请求超时')), 5000);
        });

        Promise.race([
            this.performLogout(currentUserInfo, signal),
            timeoutPromise
        ])
        .catch((err) => {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                console.log('登出请求已取消');
                return;
            }
            console.warn('登出接口请求失败（已本地登出）:', err.message);
        })
        .finally(() => {
            this.logoutController = null;
            this.isLoggingOut = false;
            // 按钮可能已被重新渲染，检查是否存在
            const btn = document.getElementById('logout-btn');
            if (btn) {
                this.setButtonLoading(btn, false);
            }
        });
    }

    /**
     * 执行实际的登出请求（支持重试）
     */
    async performLogout(userInfo, signal) {
        if (!userInfo || !userInfo.jwttoken) {
            return;
        }

        const servers = jmApi.servers || [];
        const maxRetries = Math.min(servers.length, 3);
        let lastError = null;

        for (let i = 0; i < maxRetries; i++) {
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
                    signal: signal
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        console.log('Token已失效，登出成功');
                        return;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                response.text().catch(() => {});
                return;

            } catch (err) {
                if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                    throw err;
                }
                lastError = err;
                console.warn(`登出请求失败 (服务器 ${server}):`, err.message);
            }
        }

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
        if (this.loadingStates.favorites) return;
        
        this.loadingStates.favorites = true;
        this.showListLoader(container);
        
        try {
            const data = await userApi.getFavoriteList(page);
            this.loadingStates.favorites = false;
            const list = data.list || [];
            if (list.length === 0) {
                this.showListEmpty(container, '暂无收藏');
            } else {
                container.innerHTML = this.renderComicList(list);
            }
        } catch (err) {
            this.loadingStates.favorites = false;
            this.showListError(container, err.message || '加载失败');
        }
    }

    async loadTracking(page = 1) {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        if (this.loadingStates.tracking) return;
        
        this.loadingStates.tracking = true;
        this.showListLoader(container);
        
        try {
            const data = await userApi.getTrackingList(page);
            this.loadingStates.tracking = false;
            const list = data.item || [];
            if (list.length === 0) {
                this.showListEmpty(container, '暂无追踪');
            } else {
                container.innerHTML = this.renderComicList(list);
            }
        } catch (err) {
            this.loadingStates.tracking = false;
            this.showListError(container, err.message || '加载失败');
        }
    }

    async loadNotifications(page = 1) {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        if (this.loadingStates.notifications) return;
        
        this.loadingStates.notifications = true;
        this.showListLoader(container);
        
        try {
            const data = await userApi.getNotifications(this.notificationType, page);
            this.loadingStates.notifications = false;
            
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
            this.loadingStates.notifications = false;
            console.error('加载通知失败:', err);
            this.showListError(container, err.message || '加载失败');
        }
    }

    // 渲染完整的通知区域（按钮 + 统计 + 列表）
    renderNotificationsFull() {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        
        const list = this.notificationList || [];
        const total = this.notificationTotal || 0;
        const unread = this.notificationUnread || 0;
        
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
        this.renderNotifications();
    }

    // 只渲染列表项（不重建按钮）
    renderNotifications() {
        const container = document.getElementById('user-list-container');
        if (!container) return;
        
        const list = this.notificationList || [];
        const listEl = container.querySelector('.notif-list');
        if (!listEl) return;
        
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