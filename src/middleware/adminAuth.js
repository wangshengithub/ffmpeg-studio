/**
 * 管理员权限中间件
 * 验证用户是否为管理员
 */

const { isAdmin } = require('./auth');

/**
 * 管理员权限中间件
 * 必须在认证中间件之后使用
 */
function adminAuthMiddleware(req, res, next) {
    // 检查用户是否已认证
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '未认证'
        });
    }

    // 检查是否为管理员
    if (!isAdmin(req.user)) {
        return res.status(403).json({
            success: false,
            message: '需要管理员权限'
        });
    }

    next();
}

/**
 * 创建组合中间件：先认证，再检查管理员权限
 */
function requireAdmin() {
    const authMiddleware = require('./auth').authMiddleware;

    return [authMiddleware, adminAuthMiddleware];
}

module.exports = {
    adminAuthMiddleware,
    requireAdmin
};
