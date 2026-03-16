/**
 * 预设服务模块
 * 处理预设模板相关的所有业务逻辑
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validatePresetType } = require('../utils/validator');
const logger = require('../utils/logger');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

// 预设数据缓存
let presetsData = null;

/**
 * 系统内置预设模板
 */
const BUILTIN_PRESETS = [
    // ==================== 视频压缩 ====================
    {
        id: 'builtin-compress-high',
        name: '高压缩率',
        type: 'compress',
        description: '高压缩率，文件更小',
        config: {
            quality: 'high',
            crf: 28,
            preset: 'slow'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-compress-medium',
        name: '平衡压缩',
        type: 'compress',
        description: '平衡压缩率和质量',
        config: {
            quality: 'medium',
            crf: 23,
            preset: 'medium'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-compress-low',
        name: '高质量',
        type: 'compress',
        description: '保持高质量，文件较大',
        config: {
            quality: 'low',
            crf: 18,
            preset: 'fast'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-social-media',
        name: '社交媒体优化',
        type: 'compress',
        description: '适合微信、微博等社交平台的压缩预设',
        config: {
            quality: 'high',
            crf: 28,
            preset: 'fast',
            resolution: '720p'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 视频转换 ====================
    {
        id: 'builtin-convert-480p',
        name: '480P 标清',
        type: 'convert',
        description: '转换为480P标清格式，文件小',
        config: {
            format: 'mp4',
            resolution: '480p',
            videoBitrate: '1M',
            audioBitrate: '128k',
            fps: 30
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-convert-720p',
        name: '720P 高清',
        type: 'convert',
        description: '转换为720P高清格式',
        config: {
            format: 'mp4',
            resolution: '720p',
            videoBitrate: '2M',
            audioBitrate: '128k',
            fps: 30
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-convert-1080p',
        name: '1080P 全高清',
        type: 'convert',
        description: '转换为1080P全高清格式',
        config: {
            format: 'mp4',
            resolution: '1080p',
            videoBitrate: '4M',
            audioBitrate: '128k',
            fps: 30
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-convert-4k',
        name: '4K 超高清',
        type: 'convert',
        description: '转换为4K超高清格式',
        config: {
            format: 'mp4',
            resolution: '4k',
            videoBitrate: '20M',
            audioBitrate: '192k',
            fps: 30
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-convert-webm',
        name: 'WebM网页优化',
        type: 'convert',
        description: '转换为WebM格式，适合网页播放',
        config: {
            format: 'webm',
            resolution: '720p',
            videoBitrate: '2M',
            audioBitrate: '128k',
            fps: 30
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== GIF制作 ====================
    {
        id: 'builtin-gif-small',
        name: 'GIF 小尺寸',
        type: 'gif',
        description: '320px宽度，适合网络快速分享',
        config: {
            fps: 10,
            width: 320,
            dither: 'bayer:bayer_scale=3'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-gif-standard',
        name: 'GIF 标准尺寸',
        type: 'gif',
        description: '480px宽度，平衡质量和大小',
        config: {
            fps: 15,
            width: 480,
            dither: 'sierra2_4a'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-gif-hd',
        name: 'GIF 高清',
        type: 'gif',
        description: '720px宽度，高质量动图',
        config: {
            fps: 20,
            width: 720,
            dither: 'sierra2_4a'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 音频提取 ====================
    {
        id: 'builtin-audio-mp3',
        name: '音频提取-MP3',
        type: 'audio',
        description: '提取MP3格式音频',
        config: {
            format: 'mp3',
            bitrate: '192k',
            sampleRate: 44100
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-audio-aac',
        name: '音频提取-AAC',
        type: 'audio',
        description: '提取AAC格式音频',
        config: {
            format: 'aac',
            bitrate: '128k',
            sampleRate: 44100
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 视频裁剪 ====================
    {
        id: 'builtin-trim-fast',
        name: '快速裁剪',
        type: 'trim',
        description: '快速裁剪视频片段，无需重编码',
        config: {
            fastCopy: true
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 音频混合 ====================
    {
        id: 'builtin-audio-mix-background',
        name: '背景音乐',
        type: 'audioMix',
        description: '添加背景音乐，降低原声音量',
        config: {
            originalVolume: 0.3,
            backgroundVolume: 0.7,
            loop: -1
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 水印 ====================
    {
        id: 'builtin-watermark-corner',
        name: '图片水印',
        type: 'watermark',
        description: '右下角半透明水印',
        config: {
            position: 'bottom-right',
            opacity: 0.7,
            scale: 0.15
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-textwatermark-copyright',
        name: '版权文字水印',
        type: 'textWatermark',
        description: '右下角版权文字水印',
        config: {
            text: '© FFmpeg Studio',
            fontSize: 20,
            fontColor: '#ffffff',
            position: 'bottom-right',
            opacity: 0.6,
            borderColor: '#000000',
            borderWidth: 1,
            shadowColor: '#000000',
            shadowOffset: 1
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 截图 ====================
    {
        id: 'builtin-screenshot-preview',
        name: '预览截图',
        type: 'screenshot',
        description: '生成5张均匀分布的预览截图',
        config: {
            count: 5,
            format: 'jpg',
            width: 640
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },

    // ==================== 流媒体 ====================
    {
        id: 'builtin-hls-standard',
        name: 'HLS流媒体',
        type: 'hls',
        description: 'HLS流媒体输出，用于网页播放',
        config: {
            segmentDuration: 10,
            playlistType: 'vod'
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    },
    {
        id: 'builtin-dash-standard',
        name: 'DASH流媒体',
        type: 'dash',
        description: 'DASH流媒体输出',
        config: {
            segmentDuration: 10
        },
        isBuiltin: true,
        isPublic: true,
        stars: 0,
        usageCount: 0
    }
];

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 加载预设数据
 * @returns {Object} 预设数据对象
 */
function loadPresetsData() {
    ensureDataDir();

    if (fs.existsSync(PRESETS_FILE)) {
        try {
            const content = fs.readFileSync(PRESETS_FILE, 'utf-8');
            presetsData = JSON.parse(content);
        } catch (error) {
            logger.error('加载预设数据失败:', error.message);
            presetsData = { presets: [] };
            savePresetsData();
        }
    } else {
        presetsData = { presets: [] };
        // 初始化内置预设
        BUILTIN_PRESETS.forEach(preset => {
            presetsData.presets.push({
                ...preset,
                createdAt: new Date().toISOString()
            });
        });
        savePresetsData();
    }

    return presetsData;
}

/**
 * 保存预设数据
 */
function savePresetsData() {
    ensureDataDir();
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(presetsData, null, 2), 'utf-8');
}

/**
 * 获取预设数据
 * @returns {Object} 预设数据对象
 */
function getPresetsData() {
    if (!presetsData) {
        loadPresetsData();
    }
    return presetsData;
}

/**
 * 创建自定义预设
 * @param {Object} presetData - 预设数据
 * @returns {Object} 创建结果
 */
function createPreset(presetData) {
    const {
        userId,
        name,
        type,
        description = '',
        config = {},
        files = {},  // 预设文件
        isPublic = false
    } = presetData;

    // 验证预设类型
    if (!validatePresetType(type)) {
        return { success: false, message: '无效的预设类型' };
    }

    // 验证名称
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { success: false, message: '预设名称不能为空' };
    }

    const data = getPresetsData();

    // 检查同一用户下预设名称是否重复
    const existingPreset = data.presets.find(
        p => p.userId === userId && p.name.toLowerCase() === name.toLowerCase() && !p.isBuiltin
    );
    if (existingPreset) {
        return { success: false, message: '您已存在同名预设' };
    }

    const now = new Date().toISOString();
    const newPreset = {
        id: uuidv4(),
        userId,
        name: name.trim(),
        type,
        description: description.trim(),
        config,
        files,  // 预设文件，如 { watermarkImage: { name, path, size }, backgroundAudio: { name, path, size } }
        isBuiltin: false,
        isPublic,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
    };

    data.presets.push(newPreset);
    savePresetsData();

    logger.info(`创建预设: ${name} (${type})`);

    return { success: true, preset: newPreset };
}

/**
 * 根据ID获取预设
 * @param {string} presetId - 预设ID
 * @returns {Object|null} 预设对象
 */
function getPresetById(presetId) {
    const data = getPresetsData();
    return data.presets.find(p => p.id === presetId) || null;
}

/**
 * 获取用户预设列表
 * @param {string} userId - 用户ID
 * @returns {Array} 预设列表
 */
function getUserPresets(userId) {
    const data = getPresetsData();
    return data.presets.filter(p => p.userId === userId || p.isBuiltin || p.isPublic);
}

/**
 * 获取公开预设列表（预设市场）
 * @param {Object} options - 查询选项
 * @returns {Array} 预设列表
 */
function getPublicPresets(options = {}) {
    const data = getPresetsData();
    let presets = data.presets.filter(p => p.isPublic || p.isBuiltin);

    // 按类型筛选
    if (options.type) {
        presets = presets.filter(p => p.type === options.type);
    }

    // 排序
    switch (options.sort) {
        case 'stars':
            presets.sort((a, b) => b.stars - a.stars);
            break;
        case 'usage':
            presets.sort((a, b) => b.usageCount - a.usageCount);
            break;
        case 'newest':
        default:
            presets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
    }

    return presets;
}

/**
 * 获取内置预设列表
 * @returns {Array} 内置预设列表
 */
function getBuiltinPresets() {
    const data = getPresetsData();
    return data.presets.filter(p => p.isBuiltin);
}

/**
 * 获取所有预设列表（管理员用）
 * @param {Object} filters - 筛选条件
 * @returns {Array} 预设列表
 */
function getAllPresets(filters = {}) {
    const data = getPresetsData();
    let presets = data.presets;

    // 按类型筛选
    if (filters.type) {
        presets = presets.filter(p => p.type === filters.type);
    }

    // 按公开状态筛选
    if (filters.isPublic !== undefined) {
        presets = presets.filter(p => p.isPublic === filters.isPublic);
    }

    // 按用户筛选
    if (filters.userId) {
        presets = presets.filter(p => p.userId === filters.userId);
    }

    return presets;
}

/**
 * 更新预设
 * @param {string} presetId - 预设ID
 * @param {string} userId - 用户ID
 * @param {Object} updateData - 更新数据
 * @returns {Object} 更新结果
 */
function updatePreset(presetId, userId, updateData) {
    const data = getPresetsData();
    const presetIndex = data.presets.findIndex(p => p.id === presetId);

    if (presetIndex === -1) {
        return { success: false, message: '预设不存在' };
    }

    const preset = data.presets[presetIndex];

    // 检查权限（内置预设不可修改）
    if (preset.isBuiltin) {
        return { success: false, message: '内置预设不可修改' };
    }

    if (preset.userId !== userId) {
        return { success: false, message: '无权修改此预设' };
    }

    // 更新字段
    if (updateData.name) {
        preset.name = updateData.name.trim();
    }
    if (updateData.description !== undefined) {
        preset.description = updateData.description.trim();
    }
    if (updateData.config) {
        preset.config = { ...preset.config, ...updateData.config };
    }
    if (updateData.files !== undefined) {
        preset.files = { ...preset.files, ...updateData.files };
    }
    if (updateData.isPublic !== undefined) {
        preset.isPublic = updateData.isPublic;
    }

    preset.updatedAt = new Date().toISOString();
    savePresetsData();

    logger.info(`更新预设: ${preset.name}`);

    return { success: true, preset };
}

/**
 * 删除预设
 * @param {string} presetId - 预设ID
 * @param {string} userId - 用户ID
 * @param {boolean} isAdmin - 是否为管理员操作
 * @returns {Object} 删除结果
 */
function deletePreset(presetId, userId, isAdmin = false) {
    const data = getPresetsData();
    const presetIndex = data.presets.findIndex(p => p.id === presetId);

    if (presetIndex === -1) {
        return { success: false, message: '预设不存在' };
    }

    const preset = data.presets[presetIndex];

    // 检查权限
    if (preset.isBuiltin) {
        return { success: false, message: '内置预设不可删除' };
    }

    // 管理员可以删除任何预设，普通用户只能删除自己的
    if (!isAdmin && preset.userId !== userId) {
        return { success: false, message: '无权删除此预设' };
    }

    data.presets.splice(presetIndex, 1);
    savePresetsData();

    logger.info(`删除预设: ${preset.name}`);

    return { success: true };
}

/**
 * 增加预设使用次数
 * @param {string} presetId - 预设ID
 */
function incrementPresetUsage(presetId) {
    const data = getPresetsData();
    const preset = data.presets.find(p => p.id === presetId);

    if (preset) {
        preset.usageCount++;
        savePresetsData();
    }
}

/**
 * 获取预设统计信息
 * @returns {Object} 统计信息
 */
function getPresetStats() {
    const data = getPresetsData();
    const presets = data.presets;

    return {
        total: presets.length,
        builtin: presets.filter(p => p.isBuiltin).length,
        custom: presets.filter(p => !p.isBuiltin).length,
        public: presets.filter(p => p.isPublic).length,
        totalUsage: presets.reduce((sum, p) => sum + p.usageCount, 0)
    };
}

module.exports = {
    loadPresetsData,
    savePresetsData,
    createPreset,
    getPresetById,
    getUserPresets,
    getPublicPresets,
    getBuiltinPresets,
    getAllPresets,
    updatePreset,
    deletePreset,
    incrementPresetUsage,
    getPresetStats,
    BUILTIN_PRESETS
};
