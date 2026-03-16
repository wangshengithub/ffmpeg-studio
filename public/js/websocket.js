/**
 * WebSocket 客户端模块
 * 处理实时通信
 */

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.listeners = new Map();
        this.messageQueue = [];
        this.notificationElement = null;
        this.hadDisconnected = false;
    }

    /**
     * 显示通知提示
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (info|warning|error|success)
     * @param {number} duration - 显示时长（毫秒）
     */
    showNotification(message, type = 'info', duration = 3000) {
        // 移除之前的通知
        if (this.notificationElement) {
            this.notificationElement.remove();
        }

        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        // 添加图标
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };

        notification.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
        this.notificationElement = notification;

        // 添加到页面
        document.body.appendChild(notification);

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    notification.remove();
                    if (this.notificationElement === notification) {
                        this.notificationElement = null;
                    }
                }, 300);
            }, duration);
        }
    }

    /**
     * 连接WebSocket
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        // 获取 token
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('WebSocket 连接需要认证令牌');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(token)}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket 已连接');
            this.connected = true;
            const wasReconnecting = this.reconnectAttempts > 0;
            this.reconnectAttempts = 0;

            // 如果是重连成功，显示提示
            if (wasReconnecting || this.hadDisconnected) {
                this.showNotification('连接已恢复', 'success', 2000);
                this.hadDisconnected = false;
            }

            // 发送队列中的消息
            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.send(msg);
            }

            // 触发连接事件
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('解析WebSocket消息失败:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket 已断开');
            this.connected = false;
            this.hadDisconnected = true;
            this.emit('disconnected');

            // 显示断线提示
            this.showNotification('连接已断开，正在尝试重新连接...', 'warning', 0);

            // 尝试重连
            this.reconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.emit('error', error);
        };
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    /**
     * 重连
     */
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('达到最大重连次数');
            // 显示重连失败提示
            this.showNotification('连接失败，请刷新页面重试', 'error', 5000);

            // 移除之前的"正在重连"通知
            if (this.notificationElement) {
                setTimeout(() => {
                    if (this.notificationElement) {
                        this.notificationElement.remove();
                        this.notificationElement = null;
                    }
                }, 5000);
            }
            return;
        }

        this.reconnectAttempts++;
        console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        // 更新通知文本
        const delay = Math.round((this.reconnectDelay * this.reconnectAttempts) / 1000);
        this.showNotification(
            `正在重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})，${delay}秒后重试`,
            'warning',
            0
        );

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    /**
     * 发送消息
     * @param {Object} message - 消息对象
     */
    send(message) {
        if (!this.connected) {
            // 如果未连接，将消息加入队列
            this.messageQueue.push(message);
            return;
        }

        this.ws.send(JSON.stringify(message));
    }

    /**
     * 处理接收的消息
     * @param {Object} data - 消息数据
     */
    handleMessage(data) {
        // 根据消息类型触发相应事件
        if (data.type) {
            this.emit(data.type, data.data);
        }

        // 触发通用消息事件
        this.emit('message', data);
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;

        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`事件处理器错误 [${event}]:`, error);
            }
        });
    }

    /**
     * 订阅频道
     * @param {string} channel - 频道名称
     */
    subscribe(channel) {
        this.send({
            type: 'subscribe',
            channel
        });
    }
}

// 创建全局WebSocket客户端实例
const wsClient = new WebSocketClient();

// 自动连接
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否在需要WebSocket的页面
    const wsPages = ['/dashboard', '/admin'];
    const currentPath = window.location.pathname;

    if (wsPages.some(page => currentPath.startsWith(page))) {
        wsClient.connect();
    }
});

// 导出
window.wsClient = wsClient;
