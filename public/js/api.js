/**
 * API 封装模块
 * 处理所有后端API请求
 */

const API_BASE = '/api';

// API请求封装
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            // 处理 401 未授权错误
            if (response.status === 401) {
                // 清除本地存储的认证信息
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // 如果不在登录页，跳转到登录页
                if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
                    console.warn('认证失败，正在跳转到登录页');
                    window.location.href = '/login';
                }
            }

            const error = new Error(data.message || data.error?.message || '请求失败');
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (error) {
        // 处理网络错误
        if (!error.status) {
            error.message = '网络错误，请检查连接';
        }
        throw error;
    }
}

// API模块
const API = {
    // 认证相关
    auth: {
        // 注册
        async register(username, password) {
            return request('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        },

        // 登录
        async login(username, password) {
            return request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        },

        // 登出
        async logout() {
            return request('/auth/logout', {
                method: 'POST'
            });
        },

        // 获取当前用户信息
        async me() {
            return request('/auth/me');
        },

        // 修改密码
        async changePassword(oldPassword, newPassword) {
            return request('/auth/password', {
                method: 'PUT',
                body: JSON.stringify({ oldPassword, newPassword })
            });
        }
    },

    // 任务相关
    tasks: {
        // 创建任务
        async create(taskData) {
            return request('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
        },

        // 获取任务列表
        async list(filters = {}) {
            const params = new URLSearchParams(filters);
            return request(`/tasks?${params}`);
        },

        // 获取任务详情
        async get(taskId) {
            return request(`/tasks/${taskId}`);
        },

        // 取消任务
        async cancel(taskId) {
            return request(`/tasks/${taskId}/cancel`, {
                method: 'POST'
            });
        },

        // 删除任务
        async delete(taskId) {
            return request(`/tasks/${taskId}`, {
                method: 'DELETE'
            });
        },

        // 下载任务输出
        getDownloadUrl(taskId) {
            const token = localStorage.getItem('token');
            return `${API_BASE}/tasks/${taskId}/download?token=${token}`;
        },

        // 获取任务统计
        async stats() {
            return request('/tasks/stats/summary');
        }
    },

    // 预设相关
    presets: {
        // 获取预设列表
        async list(type = null) {
            const params = type ? `?type=${type}` : '';
            return request(`/presets${params}`);
        },

        // 获取预设市场
        async market(type = null, sort = 'newest') {
            const params = new URLSearchParams({ sort });
            if (type) params.append('type', type);
            return request(`/presets/market?${params}`);
        },

        // 获取内置预设
        async builtin() {
            return request('/presets/builtin');
        },

        // 获取预设详情
        async get(presetId) {
            return request(`/presets/${presetId}`);
        },

        // 创建预设
        async create(presetData) {
            return request('/presets', {
                method: 'POST',
                body: JSON.stringify(presetData)
            });
        },

        // 更新预设
        async update(presetId, presetData) {
            return request(`/presets/${presetId}`, {
                method: 'PUT',
                body: JSON.stringify(presetData)
            });
        },

        // 删除预设
        async delete(presetId) {
            return request(`/presets/${presetId}`, {
                method: 'DELETE'
            });
        },

        // 收藏预设
        async star(presetId) {
            return request(`/presets/${presetId}/star`, {
                method: 'POST'
            });
        }
    },

    // 文件上传
    upload: {
        // 上传单个文件
        async single(file, onProgress) {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('token');

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_BASE}/upload`);

                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }

                // 上传进度事件
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        console.log(`上传进度: ${percentComplete}% (${e.loaded}/${e.total})`);
                        // 使用requestAnimationFrame确保平滑更新
                        requestAnimationFrame(() => {
                            onProgress(percentComplete);
                        });
                    }
                });

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            console.log('上传完成:', response);
                            resolve(response);
                        } catch (e) {
                            console.error('解析响应失败:', e);
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        try {
                            const error = JSON.parse(xhr.responseText);
                            console.error('上传失败:', error);
                            reject(new Error(error.message || '上传失败'));
                        } catch {
                            reject(new Error('上传失败'));
                        }
                    }
                };

                xhr.onerror = () => {
                    console.error('网络错误');
                    reject(new Error('网络错误'));
                };

                xhr.ontimeout = () => {
                    console.error('上传超时');
                    reject(new Error('上传超时'));
                };

                xhr.timeout = 300000; // 5分钟超时
                xhr.send(formData);
            });
        },

        // 上传多个文件
        async multiple(files, onProgress) {
            const formData = new FormData();
            for (const file of files) {
                formData.append('files', file);
            }

            const token = localStorage.getItem('token');

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_BASE}/upload/multiple`);

                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }

                xhr.upload.onprogress = (e) => {
                    if (onProgress && e.lengthComputable) {
                        onProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        reject(new Error('上传失败'));
                    }
                };

                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.send(formData);
            });
        },

        // 获取上传配置
        async info() {
            return request('/upload/info');
        },

        // 删除上传的文件
        async delete(filePath) {
            // 从完整路径中提取文件名
            const filename = filePath.split(/[/\\]/).pop();
            return request(`/upload/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
        }
    },

    // 管理员接口
    admin: {
        // 获取系统统计
        async stats() {
            return request('/admin/stats');
        },

        // 获取详细统计
        async detailedStats() {
            return request('/admin/stats/detailed');
        },

        // 获取队列状态
        async queue() {
            return request('/admin/queue');
        },

        // 用户管理
        users: {
            async list(filters = {}) {
                const params = new URLSearchParams(filters);
                return request(`/admin/users?${params}`);
            },

            async pending() {
                return request('/admin/users/pending');
            },

            async get(userId) {
                return request(`/admin/users/${userId}`);
            },

            async create(userData) {
                return request('/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
            },

            async approve(userId) {
                return request(`/admin/users/${userId}/approve`, {
                    method: 'PUT'
                });
            },

            async reject(userId) {
                return request(`/admin/users/${userId}/reject`, {
                    method: 'PUT'
                });
            },

            async disable(userId) {
                return request(`/admin/users/${userId}/disable`, {
                    method: 'PUT'
                });
            },

            async enable(userId) {
                return request(`/admin/users/${userId}/enable`, {
                    method: 'PUT'
                });
            },

            async resetPassword(userId, password = null) {
                return request(`/admin/users/${userId}/reset`, {
                    method: 'PUT',
                    body: JSON.stringify({ password })
                });
            },

            async delete(userId) {
                return request(`/admin/users/${userId}`, {
                    method: 'DELETE'
                });
            },

            async import(data) {
                return request('/admin/users/import', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            }
        },

        // 任务管理
        tasks: {
            async list(filters = {}) {
                const params = new URLSearchParams(filters);
                return request(`/admin/tasks?${params}`);
            },

            async get(taskId) {
                return request(`/admin/tasks/${taskId}`);
            },

            async stats() {
                return request('/admin/tasks/stats');
            }
        },

        // 预设管理
        presets: {
            async list(filters = {}) {
                const params = new URLSearchParams(filters);
                return request(`/admin/presets?${params}`);
            },

            async delete(presetId) {
                return request(`/admin/presets/${presetId}`, {
                    method: 'DELETE'
                });
            }
        },

        // 配置管理
        config: {
            async get() {
                return request('/admin/config');
            },

            async update(configData) {
                return request('/admin/config', {
                    method: 'PUT',
                    body: JSON.stringify(configData)
                });
            }
        },

        // 日志
        logs: {
            async get(lines = 100) {
                return request(`/admin/logs?lines=${lines}`);
            }
        },

        // 系统维护
        cleanup(options) {
            return request('/admin/cleanup', {
                method: 'POST',
                body: JSON.stringify(options)
            });
        }
    },

    // 系统信息
    system: {
        async info() {
            return request('/info');
        },

        async health() {
            return request('/health');
        }
    }
};

// 工具函数
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

// 导出
window.API = API;
window.formatBytes = formatBytes;
window.formatDuration = formatDuration;
window.formatDate = formatDate;
