/**
 * 认证路由
 * 处理用户注册、登录、登出等
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { asyncHandler, badRequest, unauthorized } = require('../middleware/errorHandler');

/**
 * POST /api/auth/register
 * 用户注册（需要管理员审核）
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        throw badRequest('用户名和密码不能为空');
    }

    const result = await userService.registerUser(username, password);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.status(201).json({
        success: true,
        message: '注册成功，请等待管理员审核',
        user: result.user
    });
}));

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        throw badRequest('用户名和密码不能为空');
    }

    const result = await userService.loginUser(username, password);

    if (!result.success) {
        throw unauthorized(result.message);
    }

    // 生成Token
    const token = generateToken(result.user);

    // 设置Cookie
    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        sameSite: 'strict'
    });

    res.json({
        success: true,
        message: '登录成功',
        user: result.user,
        token
    });
}));

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', (req, res) => {
    // 清除Cookie
    res.clearCookie('token');

    res.json({
        success: true,
        message: '登出成功'
    });
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

/**
 * PUT /api/auth/password
 * 修改密码
 */
router.put('/password', authMiddleware, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
        throw badRequest('原密码和新密码不能为空');
    }

    const result = await userService.changePassword(userId, oldPassword, newPassword);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        message: '密码修改成功'
    });
}));

module.exports = router;
