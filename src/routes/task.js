/**
 * 任务路由
 * 处理任务创建、查询、取消等
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const taskService = require('../services/taskService');
const queueService = require('../services/queueService');
const presetService = require('../services/presetService');
const ffmpegService = require('../services/ffmpegService');
const config = require('../config');
const logger = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler, badRequest, notFound, forbidden } = require('../middleware/errorHandler');

// 确保输出目录存在
function ensureOutputDir() {
    const outputDir = config.get('storage.outputDir');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

/**
 * 获取输出文件名
 * @param {string} inputName - 输入文件名
 * @param {string} type - 任务类型
 * @param {Object} taskConfig - 任务配置
 * @returns {string} 输出文件名
 */
function getOutputFileName(inputName, type, taskConfig) {
    const ext = path.extname(inputName);
    const baseName = path.basename(inputName, ext);
    const timestamp = Date.now();

    const outputFormats = {
        convert: taskConfig.format || 'mp4',
        compress: 'mp4',
        trim: ext.replace('.', '') || 'mp4',
        concat: 'mp4',
        gif: 'gif',
        audioExtract: taskConfig.format || 'mp3',
        audioMix: 'mp4',
        watermark: ext.replace('.', '') || 'mp4',
        textWatermark: ext.replace('.', '') || 'mp4',
        screenshot: taskConfig.format || 'png',
        hls: 'm3u8',
        dash: 'mpd'
    };

    const outputExt = outputFormats[type] || ext.replace('.', '') || 'mp4';

    return `${baseName}_${type}_${timestamp}.${outputExt}`;
}

/**
 * POST /api/tasks
 * 创建新任务
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type, inputFile, inputFiles, presetId, config: taskConfig } = req.body;

    // 支持单文件和多文件两种模式
    let files = inputFiles || (inputFile ? [inputFile] : []);

    if (!type || files.length === 0) {
        throw badRequest('任务类型和输入文件不能为空');
    }

    // 检查所有输入文件是否存在
    for (const file of files) {
        if (!fs.existsSync(file.path)) {
            throw badRequest(`输入文件不存在: ${file.name}`);
        }
    }

    // 获取预设配置（如果指定）
    let finalConfig = taskConfig || {};
    let presetFiles = {};
    if (presetId) {
        const preset = presetService.getPresetById(presetId);
        if (preset) {
            finalConfig = { ...preset.config, ...taskConfig };
            presetFiles = preset.files || {};

            // 根据任务类型自动添加预设文件
            if (type === 'watermark' && presetFiles.watermarkImage) {
                // 图片水印任务：添加预设的水印图片
                const watermarkFile = presetFiles.watermarkImage;
                if (fs.existsSync(watermarkFile.path)) {
                    // 确保用户没有上传水印图片，或者替换为预设的
                    files = files.filter(f => f.slot !== 1);
                    files.push({
                        ...watermarkFile,
                        slot: 1  // 水印图片槽位
                    });
                }
            } else if (type === 'audioMix' && presetFiles.backgroundAudio) {
                // 音频混合任务：添加预设的背景音频
                const audioFile = presetFiles.backgroundAudio;
                if (fs.existsSync(audioFile.path)) {
                    // 确保用户没有上传音频文件，或者替换为预设的
                    files = files.filter(f => f.slot !== 1);
                    files.push({
                        ...audioFile,
                        slot: 1  // 背景音频槽位
                    });
                }
            }

            presetService.incrementPresetUsage(presetId);
        }
    }

    // 按槽位排序文件
    files.sort((a, b) => (a.slot || 0) - (b.slot || 0));

    // 确保输出目录存在
    const outputDir = ensureOutputDir();

    // 生成输出文件名（使用第一个输入文件）
    const outputFileName = getOutputFileName(files[0].name, type, finalConfig);
    const outputPath = path.join(outputDir, outputFileName);

    // 创建任务
    const result = taskService.createTask({
        userId,
        type,
        inputFiles: files.map(f => ({
            name: f.name,
            size: f.size,
            path: f.path,
            mimeType: f.mimeType
        })),
        // 兼容旧的单文件格式
        inputFile: files.length === 1 ? {
            name: files[0].name,
            size: files[0].size,
            path: files[0].path,
            mimeType: files[0].mimeType
        } : null,
        outputFile: {
            name: outputFileName,
            path: outputPath
        },
        presetId,
        config: finalConfig
    });

    if (!result.success) {
        throw badRequest(result.message);
    }

    // 添加到队列
    queueService.addToQueue(result.task);

    res.status(201).json({
        success: true,
        task: result.task
    });
}));

/**
 * GET /api/tasks
 * 获取任务列表
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { status, type, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const tasks = taskService.getUserTasks(userId, filters);

    // 分页
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    res.json({
        success: true,
        tasks: paginatedTasks,
        pagination: {
            total: tasks.length,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(tasks.length / parseInt(limit))
        }
    });
}));

/**
 * GET /api/tasks/:id
 * 获取任务详情
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== userId && req.user.role !== 'admin') {
        throw forbidden('无权访问此任务');
    }

    // 获取队列位置
    const queuePosition = queueService.getQueuePosition(taskId);

    res.json({
        success: true,
        task: {
            ...task,
            queuePosition
        }
    });
}));

/**
 * DELETE /api/tasks/:id
 * 取消/删除任务
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== userId && req.user.role !== 'admin') {
        throw forbidden('无权操作此任务');
    }

    // 如果任务正在处理或等待中，先取消
    if (task.status === 'pending' || task.status === 'processing') {
        queueService.cancelTask(taskId);
    }

    // 删除任务记录
    const result = taskService.deleteTask(taskId);

    res.json({
        success: true,
        message: '任务已删除'
    });
}));

/**
 * POST /api/tasks/:id/cancel
 * 取消任务
 */
router.post('/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== userId && req.user.role !== 'admin') {
        throw forbidden('无权操作此任务');
    }

    const result = queueService.cancelTask(taskId);

    if (!result.success) {
        throw badRequest(result.message);
    }

    res.json({
        success: true,
        message: '任务已取消',
        task: result.task
    });
}));

/**
 * GET /api/tasks/:id/download
 * 下载输出文件
 */
router.get('/:id/download', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== userId && req.user.role !== 'admin') {
        throw forbidden('无权访问此任务');
    }

    // 检查任务状态
    if (task.status !== 'completed') {
        throw badRequest('任务尚未完成');
    }

    // 检查输出文件是否存在
    if (!fs.existsSync(task.outputFile.path)) {
        throw notFound('输出文件不存在');
    }

    // 发送文件
    res.download(task.outputFile.path, task.outputFile.name);
}));

/**
 * GET /api/tasks/:id/preview
 * 预览输出文件（用于HLS/DASH等）
 */
router.get('/:id/preview', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== userId && req.user.role !== 'admin') {
        throw forbidden('无权访问此任务');
    }

    // 检查任务状态
    if (task.status !== 'completed') {
        throw badRequest('任务尚未完成');
    }

    // 检查输出文件是否存在
    if (!fs.existsSync(task.outputFile.path)) {
        throw notFound('输出文件不存在');
    }

    // 读取文件内容
    const content = fs.readFileSync(task.outputFile.path, 'utf-8');

    res.type(path.extname(task.outputFile.name));
    res.send(content);
}));

/**
 * GET /api/tasks/stats
 * 获取任务统计（当前用户）
 */
router.get('/stats/summary', authMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const tasks = taskService.getUserTasks(userId);

    const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length
    };

    res.json({
        success: true,
        stats
    });
}));

module.exports = router;
