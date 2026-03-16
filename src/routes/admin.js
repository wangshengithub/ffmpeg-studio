/**
 * 管理员路由
 * 处理管理员相关的所有操作
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const userService = require('../services/userService');
const taskService = require('../services/taskService');
const presetService = require('../services/presetService');
const adminService = require('../services/adminService');
const queueService = require('../services/queueService');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { asyncHandler, badRequest, notFound } = require('../middleware/errorHandler');

// 所有管理员路由都需要认证和管理员权限
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// 配置文件上传（用于导入用户）
const upload = multer({
    dest: 'temp/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// ==================== 用户管理 ====================

/**
 * GET /api/admin/users
 * 获取用户列表
 */
router.get('/users', asyncHandler(async (req, res) => {
    const { status, role, search } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (role) filters.role = role;
    if (search) filters.search = search;

    const users = userService.getAllUsers(filters);

    res.json({
        success: true,
        users
    });
}));

/**
 * GET /api/admin/users/pending
 * 获取待审核用户列表
 */
router.get('/users/pending', asyncHandler(async (req, res) => {
    const users = userService.getPendingUsers();

    res.json({
        success: true,
        users,
        count: users.length
    });
}));

/**
 * GET /api/admin/users/:id
 * 获取用户详情
 */
router.get('/users/:id', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const userDetails = adminService.getUserDetails(userId);

    if (!userDetails) {
        throw notFound('用户不存在');
    }

    res.json({
        success: true,
        ...userDetails
    });
}));

/**
 * POST /api/admin/users
 * 创建单个用户（直接为已通过状态）
 */
router.post('/users', asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        throw badRequest('用户名和密码不能为空');
    }

    const result = await userService.createUser({
        username,
        password,
        role: role || 'user',
        status: 'approved'
    });

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.status(201).json({
        success: true,
        user: result.user,
        message: '用户创建成功'
    });
}));

/**
 * POST /api/admin/users/import
 * JSON批量导入用户
 */
router.post('/users/import', upload.single('file'), asyncHandler(async (req, res) => {
    const fs = require('fs');

    let importData;

    // 从文件或请求体读取数据
    if (req.file) {
        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        importData = JSON.parse(fileContent);
        // 清理临时文件
        fs.unlinkSync(req.file.path);
    } else {
        importData = req.body;
    }

    const result = await adminService.importUsers(importData);

    res.json({
        success: result.success,
        imported: result.imported,
        failed: result.failed,
        message: result.message
    });
}));

/**
 * PUT /api/admin/users/:id/approve
 * 审核通过用户
 */
router.put('/users/:id/approve', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const result = userService.approveUser(userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        user: result.user,
        message: '用户已通过审核'
    });
}));

/**
 * PUT /api/admin/users/:id/reject
 * 审核拒绝用户
 */
router.put('/users/:id/reject', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const result = userService.rejectUser(userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        user: result.user,
        message: '用户已被拒绝'
    });
}));

/**
 * PUT /api/admin/users/:id/disable
 * 禁用用户
 */
router.put('/users/:id/disable', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const result = userService.disableUser(userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        user: result.user,
        message: '用户已被禁用'
    });
}));

/**
 * PUT /api/admin/users/:id/enable
 * 启用用户
 */
router.put('/users/:id/enable', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const result = userService.enableUser(userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        user: result.user,
        message: '用户已启用'
    });
}));

/**
 * PUT /api/admin/users/:id/reset
 * 重置用户密码
 */
router.put('/users/:id/reset', asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { password } = req.body;

    const result = await userService.resetUserPassword(userId, password);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        newPassword: result.newPassword,
        message: '密码已重置'
    });
}));

/**
 * DELETE /api/admin/users/:id
 * 删除用户
 */
router.delete('/users/:id', asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // 检查是否为最后一个管理员
    const user = userService.getUserById(userId);
    if (user && user.role === 'admin') {
        const stats = userService.getUserStats();
        if (stats.admins <= 1) {
            throw badRequest('无法删除最后一个管理员');
        }
    }

    const result = userService.deleteUser(userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        message: '用户已删除'
    });
}));

// ==================== 任务管理 ====================

/**
 * GET /api/admin/tasks
 * 获取所有任务列表
 */
router.get('/tasks', asyncHandler(async (req, res) => {
    const { status, type, userId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (userId) filters.userId = userId;

    const tasks = taskService.getAllTasks(filters);

    res.json({
        success: true,
        tasks
    });
}));

/**
 * GET /api/admin/tasks/:id
 * 获取任务详情
 */
router.get('/tasks/:id', asyncHandler(async (req, res) => {
    const taskId = req.params.id;

    const taskDetails = adminService.getTaskDetails(taskId);

    if (!taskDetails) {
        throw notFound('任务不存在');
    }

    res.json({
        success: true,
        ...taskDetails
    });
}));

/**
 * GET /api/admin/tasks/stats
 * 获取任务统计
 */
router.get('/tasks/stats', asyncHandler(async (req, res) => {
    const stats = taskService.getTaskStats();

    res.json({
        success: true,
        stats
    });
}));

// ==================== 系统配置 ====================

/**
 * GET /api/admin/config
 * 获取系统配置
 */
router.get('/config', asyncHandler(async (req, res) => {
    const systemConfig = {
        system: {
            maxConcurrent: config.get('system.maxConcurrent'),
            maxFileSize: config.get('system.maxFileSize'),
            tokenExpire: config.get('system.tokenExpire')
        },
        storage: {
            uploadDir: config.get('storage.uploadDir'),
            outputDir: config.get('storage.outputDir'),
            autoCleanup: config.get('storage.autoCleanup'),
            cleanupAfter: config.get('storage.cleanupAfter')
        },
        ffmpeg: {
            hardwareAccel: config.get('ffmpeg.hardwareAccel'),
            defaultPreset: config.get('ffmpeg.defaultPreset')
        }
    };

    res.json({
        success: true,
        config: systemConfig
    });
}));

/**
 * PUT /api/admin/config
 * 更新系统配置
 */
router.put('/config', asyncHandler(async (req, res) => {
    const result = adminService.updateSystemConfig(req.body);

    res.json({
        success: result.success,
        updated: result.updated,
        errors: result.errors,
        message: result.message
    });
}));

// ==================== 统计与监控 ====================

/**
 * GET /api/admin/stats
 * 获取系统统计
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = adminService.getSystemOverview();

    res.json({
        success: true,
        stats
    });
}));

/**
 * GET /api/admin/stats/detailed
 * 获取详细统计报告
 */
router.get('/stats/detailed', asyncHandler(async (req, res) => {
    const stats = adminService.getDetailedStats();

    res.json({
        success: true,
        ...stats
    });
}));

/**
 * GET /api/admin/queue
 * 获取队列状态
 */
router.get('/queue', asyncHandler(async (req, res) => {
    const status = queueService.getQueueStatus();

    res.json({
        success: true,
        queue: status
    });
}));

// ==================== 预设管理 ====================

/**
 * GET /api/admin/presets
 * 获取所有预设
 */
router.get('/presets', asyncHandler(async (req, res) => {
    const { type, isPublic } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

    const presets = presetService.getAllPresets(filters);

    res.json({
        success: true,
        presets
    });
}));

/**
 * DELETE /api/admin/presets/:id
 * 删除预设（管理员可删除任何预设）
 */
router.delete('/presets/:id', asyncHandler(async (req, res) => {
    const presetId = req.params.id;

    // 管理员直接删除，跳过权限检查
    const preset = presetService.getPresetById(presetId);

    if (!preset) {
        throw notFound('预设不存在');
    }

    if (preset.isBuiltin) {
        throw badRequest('内置预设不可删除');
    }

    // 使用管理员权限删除（跳过用户ID检查）
    const result = presetService.deletePreset(presetId, null, true);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        message: '预设已删除'
    });
}));

// ==================== 日志管理 ====================

/**
 * GET /api/admin/logs
 * 获取系统日志
 */
router.get('/logs', asyncHandler(async (req, res) => {
    const { lines } = req.query;

    const result = adminService.getSystemLogs({ lines: parseInt(lines) || 100 });

    res.json({
        success: true,
        ...result
    });
}));

// ==================== 系统维护 ====================

/**
 * POST /api/admin/cleanup
 * 清理系统
 */
router.post('/cleanup', asyncHandler(async (req, res) => {
    const { cleanTasks, cleanFiles, taskDays, fileHours } = req.body;

    const result = adminService.cleanupSystem({
        cleanTasks,
        cleanFiles,
        taskDays,
        fileHours
    });

    res.json({
        success: result.success,
        ...result
    });
}));

/**
 * GET /api/admin/export/users
 * 导出用户数据
 */
router.get('/export/users', asyncHandler(async (req, res) => {
    const data = adminService.exportUsers();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=users_export.json');
    res.json(data);
}));

/**
 * GET /api/admin/export/tasks
 * 导出任务数据
 */
router.get('/export/tasks', asyncHandler(async (req, res) => {
    const { status, type } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const data = adminService.exportTasks(filters);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.json');
    res.json(data);
}));

module.exports = router;
