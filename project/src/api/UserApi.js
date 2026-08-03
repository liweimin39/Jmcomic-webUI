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

    // 通用请求方法
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

    // 用户注册
    async register(username, email, password, passwordConfirm, gender = '') {
        const body = new URLSearchParams({
            username, email, password,
            password_confirm: passwordConfirm,
            gender
        });
        const url = `https://${jmApi.servers[0]}/register`;
        return this._request(url, {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        });
    }

    // 用户登录
    async login(username, password) {
        const body = new URLSearchParams({
            username, password,
            id_remember: 'on',
            login_remember: 'on',
            submit_login: ''
        });
        const url = `https://${jmApi.servers[0]}/login`;
        const result = await this._request(url, {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        });
        
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
            const url = `https://${jmApi.servers[0]}/logout`;
            await this._request(url, {
                method: 'POST',
                headers: this._getHeaders(true),
                body: ''
            });
        } finally {
            localStorage.removeItem('jwttoken');
            localStorage.removeItem('userInfo');
        }
    }

    // 忘记密码
    async forgotPassword(email) {
        const body = new URLSearchParams({ email });
        const url = `https://${jmApi.servers[0]}/forgot`;
        return this._request(url, {
            method: 'POST',
            headers: this._getHeaders(false),
            body: body.toString()
        });
    }

    // 获取收藏列表
    async getFavoriteList(page = 1, folderId = '0', order = 'mr') {
        const url = `https://${jmApi.servers[0]}/favorite?page=${page}&folder_id=${folderId}&o=${order}`;
        return this._request(url, {
            method: 'GET',
            headers: this._getHeaders(true)
        });
    }

    // 获取连载追踪列表
    async getTrackingList(page = 1) {
        const body = new URLSearchParams({ page });
        const url = `https://${jmApi.servers[0]}/album_tracking`;
        return this._request(url, {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        });
    }

    // 获取通知列表
    async getNotifications(type = 'all', page = 1) {
        const url = `https://${jmApi.servers[0]}/notifications?type=${type}&page=${page}`;
        return this._request(url, {
            method: 'GET',
            headers: this._getHeaders(true)
        });
    }

    // POST: 切换追踪状态 (添加或取消)
    async toggleTracking(albumId) {
        const body = new URLSearchParams({ id: albumId });
        const url = `https://${jmApi.servers[0]}/album_sertracking`;
        return this._request(url, {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        });
    }

    // GET: 获取单个漫画的追踪状态
    async getTrackingStatus(albumId) {
        const url = `https://${jmApi.servers[0]}/album_sertracking?id=${albumId}`;
        return this._request(url, {
            method: 'GET',
            headers: this._getHeaders(true)
        });
    }

    // 切换收藏
    async toggleFavorite(albumId) {
        const body = new URLSearchParams({ aid: albumId });
        const url = `https://${jmApi.servers[0]}/favorite`;
        return this._request(url, {
            method: 'POST',
            headers: this._getHeaders(true),
            body: body.toString()
        });
    }
}

export const userApi = new UserApi();