// src/components/chapter/ChapterActionManager.js
import { userApi } from '../../api/UserApi.js';

export class ChapterActionManager {
    constructor() {
        this.comicId = null;
        this.favoriteBtn = document.querySelector('.favorite-btn');
        this.trackingBtn = document.querySelector('.tracking-btn');
        this.isFavorite = false;
        this.isTracking = false;
        this.isLoading = false;
        this._loginClickHandler = null;
    }

    init(comicId) {
        this.comicId = comicId;
        var self = this;
        
        if (this.favoriteBtn) {
            this.favoriteBtn.dataset.id = comicId;
            this.favoriteBtn.addEventListener('click', function(e) {
                self.toggleFavorite(e);
            });
        }
        if (this.trackingBtn) {
            this.trackingBtn.dataset.id = comicId;
            this.trackingBtn.addEventListener('click', function(e) {
                self.toggleTracking(e);
            });
        }
        this.checkLoginStatus();
        this.loadInitialStates();
    }

    checkLoginStatus() {
        var token = localStorage.getItem('jwttoken');
        var isLoggedIn = !!token;
        var self = this;
        
        if (!isLoggedIn) {
            [this.favoriteBtn, this.trackingBtn].forEach(function(btn) {
                if (btn) {
                    btn.style.cursor = 'pointer';
                    if (self._loginClickHandler) {
                        btn.removeEventListener('click', self._loginClickHandler);
                    }
                    self._loginClickHandler = function(e) {
                        if (!localStorage.getItem('jwttoken')) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = './user.html';
                        }
                    };
                    btn.addEventListener('click', self._loginClickHandler);
                }
            });
        }
        return isLoggedIn;
    }

    async loadInitialStates() {
        var token = localStorage.getItem('jwttoken');
        if (!token || !this.comicId) return;

        try {
            var favStatus = await this.getFavoriteStatus();
            var trackStatus = await this.getTrackingStatus();

            this.isFavorite = favStatus;
            this.isTracking = trackStatus;
            this.updateFavoriteUI();
            this.updateTrackingUI();
        } catch (err) {
            console.error('加载状态失败:', err);
        }
    }

    async getFavoriteStatus() {
        try {
            var data = await userApi.getFavoriteList(1);
            if (data && data.list) {
                var self = this;
                return data.list.some(function(item) {
                    return String(item.id) === String(self.comicId);
                });
            }
            return false;
        } catch (err) {
            console.error('获取收藏状态失败:', err);
            return false;
        }
    }

    // GET: 获取追踪状态
    async getTrackingStatus() {
        try {
            var result = await userApi.getTrackingStatus(this.comicId);
            return result === true || result === 'true';
        } catch (err) {
            console.error('获取追踪状态失败:', err);
            return false;
        }
    }

    // POST: 切换收藏
    async toggleFavorite(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (this.isLoading) return;
        
        if (!this.checkLoginStatus()) {
            window.location.href = './user.html';
            return;
        }

        this.setLoading(true);
        var self = this;
        
        try {
            var result = await userApi.toggleFavorite(this.comicId);
            console.log('收藏切换结果:', result);
            
            if (result.type === 'add') {
                self.isFavorite = true;
            } else if (result.type === 'remove') {
                self.isFavorite = false;
            } else if (result.msg) {
                self.isFavorite = result.msg.indexOf('添加到') !== -1;
            }
            
            self.updateFavoriteUI();
            self.showToast(self.isFavorite ? '已收藏' : '已取消收藏');
        } catch (err) {
            console.error('切换收藏失败:', err);
            self.showToast('操作失败: ' + (err.message || '未知错误'), 'error');
        } finally {
            self.setLoading(false);
        }
    }

    // POST: 切换追踪状态，然后 GET 获取最新状态
    async toggleTracking(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (this.isLoading) return;
        
        if (!this.checkLoginStatus()) {
            window.location.href = './user.html';
            return;
        }

        this.setLoading(true);
        var self = this;
        
        try {
            // 1. 先发送 POST 请求切换追踪状态
            var result = await userApi.toggleTracking(this.comicId);
            console.log('追踪切换请求结果:', result);
            
            // 2. 再发送 GET 请求获取最新的追踪状态
            var newStatus = await self.getTrackingStatus();
            console.log('最新追踪状态:', newStatus);
            
            self.isTracking = newStatus;
            self.updateTrackingUI();
            self.showToast(self.isTracking ? '已开启追踪' : '已取消追踪');
            
        } catch (err) {
            console.error('切换追踪失败:', err);
            self.showToast('操作失败: ' + (err.message || '未知错误'), 'error');
        } finally {
            self.setLoading(false);
        }
    }

    updateFavoriteUI() {
        if (!this.favoriteBtn) return;
        var svg = this.favoriteBtn.querySelector('svg');
        var span = this.favoriteBtn.querySelector('span');
        
        if (this.isFavorite) {
            this.favoriteBtn.classList.add('active');
            if (svg) {
                svg.setAttribute('fill', 'currentColor');
                svg.setAttribute('stroke', 'currentColor');
            }
            if (span) span.textContent = '已收藏';
        } else {
            this.favoriteBtn.classList.remove('active');
            if (svg) {
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
            }
            if (span) span.textContent = '收藏';
        }
    }

    updateTrackingUI() {
        if (!this.trackingBtn) return;
        var svg = this.trackingBtn.querySelector('svg');
        var span = this.trackingBtn.querySelector('span');
        
        if (this.isTracking) {
            this.trackingBtn.classList.add('active');
            if (svg) {
                svg.setAttribute('fill', 'currentColor');
                svg.setAttribute('stroke', 'currentColor');
            }
            if (span) span.textContent = '追踪中';
        } else {
            this.trackingBtn.classList.remove('active');
            if (svg) {
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
            }
            if (span) span.textContent = '追踪';
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        var self = this;
        [this.favoriteBtn, this.trackingBtn].forEach(function(btn) {
            if (btn) {
                if (loading) {
                    btn.classList.add('loading');
                } else {
                    btn.classList.remove('loading');
                }
                btn.disabled = loading;
            }
        });
    }

    showToast(message, type) {
        var toast = document.createElement('div');
        toast.className = 'toast-message ' + (type || 'success');
        toast.textContent = message;
        var bgColor = type === 'error' ? '#dc3545' : '#28a745';
        toast.style.cssText = [
            'position: fixed',
            'bottom: 100px',
            'left: 50%',
            'transform: translateX(-50%)',
            'background: ' + bgColor,
            'color: #fff',
            'padding: 12px 24px',
            'border-radius: 8px',
            'font-size: 16px',
            'z-index: 1000',
            'opacity: 0',
            'transition: opacity 0.3s ease',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.3)',
            'max-width: 80%'
        ].join(';');
        document.body.appendChild(toast);
        requestAnimationFrame(function() {
            toast.style.opacity = '1';
        });
        setTimeout(function() {
            toast.style.opacity = '0';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }
}