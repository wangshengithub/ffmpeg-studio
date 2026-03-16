/**
 * 认证中间件
 * 验证JWT Token并设置用户信息
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const userService = require('../services/userService');
const logger = require('../utils/logger');

// 获取JWT密钥
function getSecret() {
    return config.get('system.sessionSecret', 'ffmpeg-studio-secret-key');
}

// 获取Token过期时间
function getExpireTime() {
    return config.get('system.tokenExpire', 86400);
}

/**
 * 生成JWT Token
 * @param {Object} user - 用户对象
 * @returns {string} Token
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role
    };

    return jwt.sign(payload, getSecret(), {
        expiresIn: getExpireTime()
    });
}

/**
 * 验证JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, getSecret());
    } catch (error) {
        return null;
    }
}

/**
 * 认证中间件
 * 验证请求中的Token并设置req.user
 */
function authMiddleware(req, res, next) {
    // 从Header获取Token
    let token = null;

    // 优先从Authorization header获取
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    // 其次从Cookie获取
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // 最后从查询参数获取
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: '未提供认证令牌'
        });
    }

    // 验证Token
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: '无效或过期的令牌'
        });
    }

    // 获取用户信息
    const user = userService.getUserById(decoded.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: '用户不存在'
        });
    }

    // 检查用户状态
    if (user.status !== 'approved') {
        return res.status(403).json({
            success: false,
            message: '账号已被禁用或未通过审核'
        });
    }

    // 设置用户信息到请求对象
    req.user = user;
    req.token = token;

    next();
}

/**
 * 可选认证中间件
 * 如果提供了Token则验证，否则继续
 */
function optionalAuthMiddleware(req, res, next) {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            const user = userService.getUserById(decoded.id);
            if (user && user.status === 'approved') {
                req.user = user;
                req.token = token;
            }
        }
    }

    next();
}

/**
 * 检查用户是否为管理员
 * @param {Object} user - 用户对象
 * @returns {boolean}
 */
function isAdmin(user) {
    return user && user.role === 'admin';
}

/**
 * 检查用户是否拥有资源
 * @param {Object} user - 用户对象
 * @param {string} resourceUserId - 资源所属用户ID
 * @returns {boolean}
 */
function isOwnerOrAdmin(user, resourceUserId) {
    return isAdmin(user) || user.id === resourceUserId;
}

module.exports = {
    generateToken,
    verifyToken,
    authMiddleware,
    optionalAuthMiddleware,
    isAdmin,
    isOwnerOrAdmin,
    getSecret,
    getExpireTime
};
