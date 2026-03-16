/**
 * 文件上传路由
 * 处理文件上传和下载
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler, badRequest, notFound } = require('../middleware/errorHandler');

// 配置存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = config.get('storage.uploadDir');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        // 保留原始文件名（带时间戳避免冲突）
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${uniqueSuffix}_${safeName}`);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 允许的MIME类型
    const allowedMimeTypes = [
        // 视频
        'video/mp4',
        'video/x-msvideo',
        'video/x-matroska',
        'video/quicktime',
        'video/webm',
        'video/x-flv',
        'video/mpeg',
        'video/3gpp',
        'video/x-m4v',
        // 音频
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/aac',
        'audio/flac',
        'audio/x-m4a',
        'audio/x-wav',
        // 图片
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp'
    ];

    // 检查MIME类型
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        // 对于未知类型，根据扩展名判断
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = [
            '.mp4', '.avi', '.mkv', '.mov', '.webm', '.flv', '.mpeg', '.mpg',
            '.3gp', '.m4v', '.ts', '.mts', '.m2ts',
            '.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.wma',
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'
        ];

        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`不支持的文件类型: ${file.mimetype || ext}`), false);
        }
    }
};

// 配置multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.get('system.maxFileSize', 2147483648), // 从配置文件读取，默认2GB
        files: 10 // 最多10个文件
    }
});

/**
 * POST /api/upload
 * 上传单个文件
 */
router.post('/', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        throw badRequest('请选择要上传的文件');
    }

    // 修复中文文件名乱码
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const fileInfo = {
        name: originalName,
        size: req.file.size,
        path: req.file.path,
        mimeType: req.file.mimetype
    };

    res.json({
        success: true,
        file: fileInfo,
        message: '文件上传成功'
    });
}));

/**
 * POST /api/upload/multiple
 * 上传多个文件
 */
router.post('/multiple', authMiddleware, upload.array('files', 10), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        throw badRequest('请选择要上传的文件');
    }

    const files = req.files.map(file => ({
        name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        size: file.size,
        path: file.path,
        mimeType: file.mimetype
    }));

    res.json({
        success: true,
        files,
        count: files.length,
        message: `成功上传 ${files.length} 个文件`
    });
}));

/**
 * GET /api/upload/info
 * 获取上传配置信息
 */
router.get('/info', authMiddleware, (req, res) => {
    const maxFileSize = config.get('system.maxFileSize', 2147483648);

    res.json({
        success: true,
        config: {
            maxFileSize,
            maxFileSizeFormatted: formatBytes(maxFileSize),
            maxFiles: 10,
            allowedTypes: [
                'video/mp4', 'video/avi', 'video/mkv', 'video/mov', 'video/webm',
                'audio/mp3', 'audio/wav', 'audio/aac', 'audio/flac',
                'image/jpeg', 'image/png', 'image/gif'
            ]
        }
    });
});

/**
 * GET /api/download/:taskId
 * 下载任务输出文件
 */
router.get('/:taskId', authMiddleware, asyncHandler(async (req, res) => {
    const taskId = req.params.taskId;
    const taskService = require('../services/taskService');

    const task = taskService.getTaskById(taskId);

    if (!task) {
        throw notFound('任务不存在');
    }

    // 检查权限
    if (task.userId !== req.user.id && req.user.role !== 'admin') {
        const error = new Error('无权访问此文件');
        error.statusCode = 403;
        throw error;
    }

    // 检查任务状态
    if (task.status !== 'completed') {
        throw badRequest('任务尚未完成');
    }

    // 检查文件是否存在
    if (!fs.existsSync(task.outputFile.path)) {
        throw notFound('输出文件不存在');
    }

    // 发送文件
    res.download(task.outputFile.path, task.outputFile.name);
}));

/**
 * DELETE /api/upload/:filename
 * 删除上传的文件
 */
router.delete('/:filename', authMiddleware, asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    const uploadDir = config.get('storage.uploadDir');
    const filePath = path.join(uploadDir, filename);

    // 安全检查：确保文件在上传目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(uploadDir);

    if (!resolvedPath.startsWith(resolvedUploadDir)) {
        const error = new Error('无效的文件路径');
        error.statusCode = 400;
        throw error;
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        throw notFound('文件不存在');
    }

    // 删除文件
    fs.unlinkSync(filePath);

    res.json({
        success: true,
        message: '文件已删除'
    });
}));

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 可读格式
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 错误处理中间件（处理multer错误）
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: '文件大小超过限制'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: '文件数量超过限制'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: '意外的文件字段'
            });
        }
    }

    if (error.message && error.message.includes('不支持的文件类型')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    next(error);
});

module.exports = router;
