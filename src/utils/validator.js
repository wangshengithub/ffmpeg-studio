/**
 * 数据验证工具模块
 * 提供统一的数据验证功能
 */

/**
 * 验证用户名
 * @param {string} username - 用户名
 * @returns {Object} 验证结果 {valid: boolean, message: string}
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, message: '用户名不能为空' };
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
        return { valid: false, message: '用户名长度不能少于3个字符' };
    }

    if (trimmed.length > 20) {
        return { valid: false, message: '用户名长度不能超过20个字符' };
    }

    // 只允许字母、数字、下划线
    const pattern = /^[a-zA-Z0-9_]+$/;
    if (!pattern.test(trimmed)) {
        return { valid: false, message: '用户名只能包含字母、数字和下划线' };
    }

    return { valid: true, message: '' };
}

/**
 * 验证密码
 * @param {string} password - 密码
 * @returns {Object} 验证结果 {valid: boolean, message: string}
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: '密码不能为空' };
    }

    if (password.length < 8) {
        return { valid: false, message: '密码长度不能少于8个字符' };
    }

    // 必须包含字母和数字
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
        return { valid: false, message: '密码必须包含字母和数字' };
    }

    return { valid: true, message: '' };
}

/**
 * 验证用户状态
 * @param {string} status - 状态
 * @returns {boolean} 是否有效
 */
function validateUserStatus(status) {
    const validStatuses = ['pending', 'approved', 'rejected', 'disabled'];
    return validStatuses.includes(status);
}

/**
 * 验证用户角色
 * @param {string} role - 角色
 * @returns {boolean} 是否有效
 */
function validateUserRole(role) {
    const validRoles = ['user', 'admin'];
    return validRoles.includes(role);
}

/**
 * 验证任务类型
 * @param {string} type - 任务类型
 * @returns {boolean} 是否有效
 */
function validateTaskType(type) {
    const validTypes = [
        'convert',      // 视频转换
        'compress',     // 视频压缩
        'trim',         // 视频裁剪
        'concat',       // 视频拼接
        'gif',          // GIF生成
        'audioExtract', // 音频提取
        'audioMix',     // 音频混合
        'watermark',    // 图片水印
        'textWatermark',// 文字水印
        'screenshot',   // 截图
        'hls',          // HLS流媒体
        'dash'          // DASH流媒体
    ];
    return validTypes.includes(type);
}

/**
 * 验证任务状态
 * @param {string} status - 状态
 * @returns {boolean} 是否有效
 */
function validateTaskStatus(status) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    return validStatuses.includes(status);
}

/**
 * 验证预设类型
 * @param {string} type - 预设类型
 * @returns {boolean} 是否有效
 */
function validatePresetType(type) {
    const validTypes = [
        'convert',      // 视频转换
        'compress',     // 视频压缩
        'trim',         // 视频裁剪
        'concat',       // 视频拼接
        'gif',          // GIF制作
        'audio',        // 音频提取
        'audioExtract', // 音频提取（别名）
        'audioMix',     // 音频混合
        'watermark',    // 图片水印
        'textWatermark',// 文字水印
        'screenshot',   // 截图提取
        'hls',          // HLS流
        'dash'          // DASH流
    ];
    return validTypes.includes(type);
}

/**
 * 验证文件大小
 * @param {number} size - 文件大小（字节）
 * @param {number} maxSize - 最大大小（字节）
 * @returns {Object} 验证结果
 */
function validateFileSize(size, maxSize) {
    if (typeof size !== 'number' || size <= 0) {
        return { valid: false, message: '无效的文件大小' };
    }

    if (size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
        return { valid: false, message: `文件大小超过限制（最大 ${maxMB} MB）` };
    }

    return { valid: true, message: '' };
}

/**
 * 验证视频时间范围
 * @param {string|number} startTime - 开始时间
 * @param {string|number} duration - 时长
 * @returns {Object} 验证结果
 */
function validateTimeRange(startTime, duration) {
    // 验证开始时间
    if (startTime !== undefined && startTime !== null) {
        const start = typeof startTime === 'string' ? parseTimeToSeconds(startTime) : startTime;
        if (start === null || start < 0) {
            return { valid: false, message: '无效的开始时间' };
        }
    }

    // 验证时长
    if (duration !== undefined && duration !== null) {
        const dur = typeof duration === 'string' ? parseTimeToSeconds(duration) : duration;
        if (dur === null || dur <= 0) {
            return { valid: false, message: '无效的时长' };
        }
    }

    return { valid: true, message: '' };
}

/**
 * 将时间字符串转换为秒数
 * @param {string} timeStr - 时间字符串 (HH:MM:SS 或 MM:SS 或 秒数)
 * @returns {number|null} 秒数
 */
function parseTimeToSeconds(timeStr) {
    if (typeof timeStr === 'number') {
        return timeStr;
    }

    if (typeof timeStr !== 'string') {
        return null;
    }

    // 尝试解析数字
    if (/^\d+(\.\d+)?$/.test(timeStr)) {
        return parseFloat(timeStr);
    }

    // 解析 HH:MM:SS 或 MM:SS 格式
    const parts = timeStr.split(':').map(p => parseInt(p, 10));

    if (parts.length === 3) {
        const [hours, minutes, seconds] = parts;
        if (hours >= 0 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
            return hours * 3600 + minutes * 60 + seconds;
        }
    } else if (parts.length === 2) {
        const [minutes, seconds] = parts;
        if (minutes >= 0 && seconds >= 0 && seconds < 60) {
            return minutes * 60 + seconds;
        }
    }

    return null;
}

/**
 * 将秒数转换为时间字符串
 * @param {number} seconds - 秒数
 * @returns {string} 时间字符串 (HH:MM:SS)
 */
function formatSecondsToTime(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
        return '00:00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs].map(v => v.toString().padStart(2, '0')).join(':');
}

/**
 * 验证分辨率
 * @param {string} resolution - 分辨率 (如 720p, 1080p, 4K)
 * @returns {Object} 验证结果和具体尺寸
 */
function validateResolution(resolution) {
    const resolutionMap = {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '2k': { width: 2560, height: 1440 },
        '4k': { width: 3840, height: 2160 }
    };

    const normalized = resolution.toLowerCase();

    if (resolutionMap[normalized]) {
        return { valid: true, dimensions: resolutionMap[normalized] };
    }

    // 尝试解析 WxH 格式
    const match = resolution.match(/^(\d+)[xX](\d+)$/);
    if (match) {
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        if (width > 0 && height > 0) {
            return { valid: true, dimensions: { width, height } };
        }
    }

    return { valid: false, message: '无效的分辨率格式' };
}

/**
 * 清理和转义HTML特殊字符
 * @param {string} str - 输入字符串
 * @returns {string} 清理后的字符串
 */
function sanitizeHtml(str) {
    if (typeof str !== 'string') {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };

    return str.replace(/[&<>"'/]/g, char => map[char]);
}

module.exports = {
    validateUsername,
    validatePassword,
    validateUserStatus,
    validateUserRole,
    validateTaskType,
    validateTaskStatus,
    validatePresetType,
    validateFileSize,
    validateTimeRange,
    parseTimeToSeconds,
    formatSecondsToTime,
    validateResolution,
    sanitizeHtml
};
