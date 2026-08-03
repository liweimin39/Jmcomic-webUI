import { jmApi } from './JmcomicApi.js';
import { crypto } from './Crypto.js';

class UserApi {
    // 构建请求头，可选携带 Authorization
    _getHeaders(includeAuth = false) {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'token': jmApi.accessToken.token,
            'tokenParam': jmApi.accessToken.tokenParam,
        };
        if (includeAuth) {
            const jwt = localStorage.getItem('jwttoken');
            if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
        }
        return headers;
    }

    // 解密数据
    _decryptData(cipherText) {
        return crypto.decryptData(jmApi.currentKey, cipherText);
    }

    // 通用请求方法（使用 retryFetch 带重试机制）
    async _request(getUrl, options = {}) {
        try {
            const url = typeof getUrl === 'function' ? getUrl(0) : getUrl;
            const resp = await fetch(url, options);
            
            const text = await resp.text();
            let json = null;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(`请求失败 (${resp.status})`);
            }
            
            // 检查 errorMsg
            if (json.errorMsg && json.errorMsg.trim() !== '') {
                const errMsg = Array.isArray(json.errorMsg) ? json.errorMsg.join('; ') : json.errorMsg;
                throw new Error(errMsg);
            }
            
            if (!resp.ok) {
                const errMsg = json.msg || json.message || `HTTP ${resp.status}`;
                throw new Error(Array.isArray(errMsg) ? errMsg.join('; ') : errMsg);
            }
            
            // 如果有加密数据，解密
            if (json.data) {
                const decrypted = this._decryptData(json.data);
                if (decrypted && typeof decrypted === 'object') {
                    if (decrypted.errorMsg && decrypted.errorMsg.trim() !== '') {
                        throw new Error(Array.isArray(decrypted.errorMsg) ? decrypted.errorMsg.join('; ') : decrypted.errorMsg);
                    }
                    if (decrypted.msg && decrypted.msg.trim() !== '') {
                        return decrypted;
                    }
                }
                return decrypted;
            }
            
            return json;
            
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    // 带重试机制的请求（使用 servers[4 - i]）
    async _requestWithRetry(getUrl, options = {}, retries = 5) {
        if (typeof getUrl === 'string') {
            const url = getUrl;
            getUrl = (i) => url;
        }
        
        let lastError = null;
        for (let i = 0; i < retries; i++) {
            try {
                const serverIndex = Math.min(4 - i, jmApi.servers.length - 1);
                if (serverIndex < 0) break;
                
                const url = getUrl(serverIndex);
                const resp = await fetch(url, options);
                
                const text = await resp.text();
                let json = null;
                try {
                    json = JSON.parse(text);
                } catch {
                    throw new Error(`请求失败 (${resp.status})`);
                }
                
                if (json.errorMsg && json.errorMsg.trim() !== '') {
                    const errMsg = Array.isArray(json.errorMsg) ? json.errorMsg.join('; ') : json.errorMsg;
                    throw new Error(errMsg);
                }
                
                if (!resp.ok) {
                    const errMsg = json.msg || json.message || `HTTP ${resp.status}`;
                    throw new Error(Array.isArray(errMsg) ? errMsg.join('; ') : errMsg);
                }
                
                if (json.data) {
                    const decrypted = this._decryptData(json.data);
                    if (decrypted && typeof decrypted === 'object') {
                        if (decrypted.errorMsg && decrypted.errorMsg.trim() !== '') {
                            throw new Error(Array.isArray(decrypted.errorMsg) ? decrypted.errorMsg.join('; ') : decrypted.errorMsg);
                        }
                        if (decrypted.msg && decrypted.msg.trim() !== '') {
                            return decrypted;
                        }
                    }
                    return decrypted;
                }
                
                return json;
                
            } catch (error) {
                lastError = error;
                // 如果不是最后一次重试，继续
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
        }
        
        throw lastError || new Error('请求失败');
    }

    // 用户注册
    async register(username, email, password, passwordConfirm, gender = '') {
        const body = new URLSearchParams({
            username, email, password,
            password_confirm: passwordConfirm,
            gender
        });
        const options = {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/register`,
            options,
            5
        );
    }

    // 用户登录
    async login(username, password) {
        const body = new URLSearchParams({
            username, password,
            id_remember: 'on',
            login_remember: 'on',
            submit_login: ''
        });
        const options = {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        };
        const result = await this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/login`,
            options,
            5
        );
        
        if (result.jwttoken) {
            localStorage.setItem('jwttoken', result.jwttoken);
            localStorage.setItem('userInfo', JSON.stringify(result));
        }
        return result;
    }

    // 用户登出
    async logout() {
        const jwt = localStorage.getItem('jwttoken');
        if (!jwt) return;
        try {
            const options = {
                method: 'POST',
                headers: this._getHeaders(true),
                body: ''
            };
            await this._requestWithRetry(
                (i) => `https://${jmApi.servers[i]}/logout`,
                options,
                5
            );
        } finally {
            localStorage.removeItem('jwttoken');
            localStorage.removeItem('userInfo');
        }
    }

    // 忘记密码
    async forgotPassword(email) {
        const body = new URLSearchParams({ email });
        const options = {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/forgot`,
            options,
            5
        );
    }

    // 获取收藏列表
    async getFavoriteList(page = 1, folderId = '0', order = 'mr') {
        const options = {
            method: 'GET',
            headers: this._getHeaders(true)
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/favorite?page=${page}&folder_id=${folderId}&o=${order}`,
            options,
            5
        );
    }

    // 获取连载追踪列表
    async getTrackingList(page = 1) {
        const body = new URLSearchParams({ page });
        const options = {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/album_tracking`,
            options,
            5
        );
    }

    // 获取通知列表
    async getNotifications(type = 'all', page = 1) {
        const options = {
            method: 'GET',
            headers: this._getHeaders(true)
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/notifications?type=${type}&page=${page}`,
            options,
            5
        );
    }

    // POST: 切换追踪状态 (添加或取消)
    async toggleTracking(albumId) {
        const body = new URLSearchParams({ id: albumId });
        const options = {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/album_sertracking`,
            options,
            5
        );
    }

    // GET: 获取单个漫画的追踪状态
    async getTrackingStatus(albumId) {
        const options = {
            method: 'GET',
            headers: this._getHeaders(true)
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/album_sertracking?id=${albumId}`,
            options,
            5
        );
    }

    // 切换收藏
    async toggleFavorite(albumId) {
        const body = new URLSearchParams({ aid: albumId });
        const options = {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        };
        return this._requestWithRetry(
            (i) => `https://${jmApi.servers[i]}/favorite`,
            options,
            5
        );
    }
}

export const userApi = new UserApi();