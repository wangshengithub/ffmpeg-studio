/**
 * FFmpeg Studio - 主服务器入口
 * Express + WebSocket 服务器
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');

// 加载配置
const config = require('./config');

// 加载服务
const userService = require('./services/userService');
const presetService = require('./services/presetService');
const taskService = require('./services/taskService');
const ffmpegService = require('./services/ffmpegService');
const queueService = require('./services/queueService');

// 加载路由
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/task');
const presetRoutes = require('./routes/preset');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

// 加载中间件
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 加载日志工具
const logger = require('./utils/logger');

// 创建Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// WebSocket客户端集合
const wsClients = new Set();

// ==================== 中间件配置 ====================

// CORS配置
app.use(cors({
    origin: true,
    credentials: true
}));

// 解析请求体（不设置硬编码限制，由 multer 处理文件上传）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie解析
app.use(cookieParser());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 请求日志
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
});

// ==================== API路由 ====================

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/download', uploadRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 系统信息（公开）
app.get('/api/info', (req, res) => {
    const hwAccelInfo = ffmpegService.getHwAccelInfo();

    res.json({
        success: true,
        info: {
            version: require('../package.json').version,
            maxFileSize: config.get('system.maxFileSize'),
            maxConcurrent: config.get('system.maxConcurrent'),
            hardwareAccel: hwAccelInfo.recommended,
            availableHwAccel: hwAccelInfo.available ? [hwAccelInfo.type] : []
        }
    });
});

// ==================== 页面路由 ====================

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 登录页
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// 注册页
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/register.html'));
});

// 注册成功页
app.get('/pending', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pending.html'));
});

// 用户工作台
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// 预设市场
app.get('/presets', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/preset-market.html'));
});

// 管理员面板
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ==================== WebSocket处理 ====================

wss.on('connection', (ws, req) => {
    // 从 URL 参数或 cookie 中获取 token
    const url = new URL(req.url, `http://${req.headers.host}`);
    let token = url.searchParams.get('token');

    // 如果 URL 没有 token，尝试从 cookie 获取
    if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});
        token = cookies.token;
    }

    // 验证 token
    if (!token) {
        logger.warn('WebSocket 连接被拒绝: 缺少认证令牌');
        ws.send(JSON.stringify({
            type: 'error',
            message: '认证失败: 缺少令牌'
        }));
        ws.close();
        return;
    }

    try {
        // 验证 token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, config.get('system.sessionSecret'));

        // 保存用户信息到 WebSocket 连接
        ws.user = decoded;
        ws.token = token;

        // 添加到客户端集合
        wsClients.add(ws);
        logger.info(`WebSocket客户端连接 (用户: ${decoded.username})，当前连接数: ${wsClients.size}`);

        // 发送欢迎消息
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'WebSocket连接成功',
            user: decoded.username
        }));

        // 处理消息
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleWebSocketMessage(ws, data);
            } catch (error) {
                logger.error('WebSocket消息解析失败:', error.message);
            }
        });

        // 处理断开连接
        ws.on('close', () => {
            wsClients.delete(ws);
            logger.info(`WebSocket客户端断开 (用户: ${ws.user?.username})，当前连接数: ${wsClients.size}`);
        });

        // 处理错误
        ws.on('error', (error) => {
            logger.error('WebSocket错误:', error.message);
            wsClients.delete(ws);
        });
    } catch (error) {
        logger.warn('WebSocket 连接被拒绝: 无效令牌');
        ws.send(JSON.stringify({
            type: 'error',
            message: '认证失败: 无效令牌'
        }));
        ws.close();
    }
});

/**
 * 处理WebSocket消息
 * @param {WebSocket} ws - WebSocket连接
 * @param {Object} data - 消息数据
 */
function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        case 'subscribe':
            // 订阅特定频道的消息
            ws.subscriptions = ws.subscriptions || [];
            ws.subscriptions.push(data.channel);
            ws.send(JSON.stringify({
                type: 'subscribed',
                channel: data.channel
            }));
            break;

        default:
            logger.debug('未知WebSocket消息类型:', data.type);
    }
}

/**
 * 广播消息到所有WebSocket客户端
 * @param {Object} message - 消息对象
 */
function broadcast(message) {
    const messageStr = JSON.stringify(message);

    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// 设置队列服务的广播函数
queueService.setBroadcastFunction(broadcast);

// ==================== 错误处理 ====================

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// ==================== 初始化函数 ====================

/**
 * 初始化应用
 */
async function initializeApp() {
    logger.info('正在初始化 FFmpeg Studio...');

    // 确保必要的目录存在
    const dirs = [
        config.get('storage.uploadDir'),
        config.get('storage.outputDir'),
        path.join(__dirname, '../data'),
        path.join(__dirname, '../logs'),
        path.join(__dirname, '../temp')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info(`创建目录: ${dir}`);
        }
    });

    // 初始化FFmpeg（异步）
    const ffmpegInfo = await ffmpegService.initFFmpeg();
    const hwAccelInfo = ffmpegService.getHwAccelInfo();
    logger.info(`FFmpeg初始化完成`);
    logger.info(`硬件加速: ${hwAccelInfo.available ? hwAccelInfo.type : 'CPU'}`);
    if (hwAccelInfo.available) {
        logger.info(`编码器: ${hwAccelInfo.encoder}`);
    }

    // 初始化数据服务
    userService.loadUsersData();
    presetService.loadPresetsData();
    taskService.loadTasksData();

    // 初始化队列服务
    queueService.initQueueService();

    // 检查是否存在管理员，如果没有则创建默认管理员
    if (!userService.hasAdmin()) {
        const adminConfig = config.get('admin');
        const result = await userService.createUser({
            username: adminConfig.defaultUsername || 'admin',
            password: adminConfig.defaultPassword || 'admin123',
            role: 'admin',
            status: 'approved'
        });

        if (result.success) {
            logger.info(`创建默认管理员账户: ${result.user.username}`);
            logger.warn('请及时修改默认管理员密码！');
        }
    }

    logger.info('FFmpeg Studio 初始化完成');
}

// ==================== 启动服务器 ====================

const PORT = config.get('system.port', 3000);
const HOST = config.get('system.host', '0.0.0.0');

initializeApp().then(() => {
    server.listen(PORT, HOST, () => {
        logger.info(`=================================`);
        logger.info(`  FFmpeg Studio 服务器已启动`);
        logger.info(`  地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
        logger.info(`  WebSocket: ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
        logger.info(`=================================`);
    });
}).catch(error => {
    logger.error('服务器启动失败:', error);
    process.exit(1);
});

// ==================== 优雅关闭 ====================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    logger.info('正在关闭服务器...');

    // 关闭WebSocket服务器
    wss.close(() => {
        logger.info('WebSocket服务器已关闭');
    });

    // 关闭HTTP服务器
    server.close(() => {
        logger.info('HTTP服务器已关闭');
        process.exit(0);
    });

    // 强制退出
    setTimeout(() => {
        logger.error('强制关闭服务器');
        process.exit(1);
    }, 5000);
}

// 导出广播函数供其他模块使用
module.exports = { broadcast };
