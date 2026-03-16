/**
 * 预设路由
 * 处理预设模板的CRUD操作
 */

const express = require('express');
const router = express.Router();
const presetService = require('../services/presetService');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { asyncHandler, badRequest, notFound, forbidden } = require('../middleware/errorHandler');
const { getSystemFonts } = require('../utils/system');

/**
 * GET /api/presets/fonts
 * 获取系统字体列表
 */
router.get('/fonts', asyncHandler(async (req, res) => {
    const fonts = await getSystemFonts();
    res.json({
        success: true,
        fonts
    });
}));

/**
 * GET /api/presets
 * 获取预设列表
 * 普通用户获取自己的预设 + 公开预设 + 内置预设
 */
router.get('/', optionalAuthMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const { type, sort } = req.query;

    let presets;

    if (userId) {
        // 已登录用户获取所有可用预设
        presets = presetService.getUserPresets(userId);
    } else {
        // 未登录用户只获取公开预设
        presets = presetService.getPublicPresets({ type, sort });
    }

    // 按类型筛选
    if (type) {
        presets = presets.filter(p => p.type === type);
    }

    res.json({
        success: true,
        presets
    });
}));

/**
 * GET /api/presets/market
 * 获取预设市场列表（公开预设）
 */
router.get('/market', asyncHandler(async (req, res) => {
    const { type, sort } = req.query;

    const presets = presetService.getPublicPresets({ type, sort });

    res.json({
        success: true,
        presets
    });
}));

/**
 * GET /api/presets/builtin
 * 获取内置预设列表
 */
router.get('/builtin', asyncHandler(async (req, res) => {
    const presets = presetService.getBuiltinPresets();

    res.json({
        success: true,
        presets
    });
}));

/**
 * GET /api/presets/:id
 * 获取预设详情
 */
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req, res) => {
    const presetId = req.params.id;
    const userId = req.user ? req.user.id : null;

    const preset = presetService.getPresetById(presetId);

    if (!preset) {
        throw notFound('预设不存在');
    }

    // 检查访问权限
    if (!preset.isPublic && !preset.isBuiltin && preset.userId !== userId) {
        throw forbidden('无权访问此预设');
    }

    res.json({
        success: true,
        preset
    });
}));

/**
 * POST /api/presets
 * 创建自定义预设
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, type, description, config, files, isPublic } = req.body;

    if (!name || !type || !config) {
        throw badRequest('预设名称、类型和配置不能为空');
    }

    const result = presetService.createPreset({
        userId,
        name,
        type,
        description,
        config,
        files,  // 预设文件
        isPublic: isPublic || false
    });

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.status(201).json({
        success: true,
        preset: result.preset
    });
}));

/**
 * PUT /api/presets/:id
 * 更新预设
 */
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const presetId = req.params.id;
    const userId = req.user.id;
    const { name, description, config, files, isPublic } = req.body;

    const result = presetService.updatePreset(presetId, userId, {
        name,
        description,
        config,
        files,  // 预设文件
        isPublic
    });

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        preset: result.preset
    });
}));

/**
 * DELETE /api/presets/:id
 * 删除预设
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const presetId = req.params.id;
    const userId = req.user.id;

    const result = presetService.deletePreset(presetId, userId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        message: '预设已删除'
    });
}));

module.exports = router;
