/**
 * 错误处理中间件
 * 统一处理API错误响应
 */

const logger = require('../utils/logger');
const { sanitizeHtml } = require('../utils/validator');

/**
 * 自定义API错误类
 */
class APIError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'APIError';
    }
}

/**
 * 创建400错误（Bad Request）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function badRequest(message) {
    return new APIError(message, 400, 'BAD_REQUEST');
}

/**
 * 创建401错误（Unauthorized）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function unauthorized(message = '未授权') {
    return new APIError(message, 401, 'UNAUTHORIZED');
}

/**
 * 创建403错误（Forbidden）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function forbidden(message = '禁止访问') {
    return new APIError(message, 403, 'FORBIDDEN');
}

/**
 * 创建404错误（Not Found）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function notFound(message = '资源不存在') {
    return new APIError(message, 404, 'NOT_FOUND');
}

/**
 * 创建409错误（Conflict）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function conflict(message) {
    return new APIError(message, 409, 'CONFLICT');
}

/**
 * 创建422错误（Unprocessable Entity）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function unprocessableEntity(message) {
    return new APIError(message, 422, 'UNPROCESSABLE_ENTITY');
}

/**
 * 创建500错误（Internal Server Error）
 * @param {string} message - 错误消息
 * @returns {APIError}
 */
function internalError(message = '服务器内部错误') {
    return new APIError(message, 500, 'INTERNAL_ERROR');
}

/**
 * 异步处理器包装函数
 * 自动捕获异步错误并传递给错误处理中间件
 * @param {Function} fn - 异步处理函数
 * @returns {Function}
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404处理中间件
 * 处理未匹配的路由
 */
function notFoundHandler(req, res, next) {
    const error = notFound(`路由 ${req.method} ${req.originalUrl} 不存在`);
    next(error);
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
    // 如果响应已经发送，则交给默认错误处理
    if (res.headersSent) {
        return next(err);
    }

    // 获取错误信息
    let statusCode = err.statusCode || 500;
    let code = err.code || 'INTERNAL_ERROR';
    let message = err.message || '服务器内部错误';

    // 处理特定类型的错误
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'INVALID_TOKEN';
        message = '无效的认证令牌';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'TOKEN_EXPIRED';
        message = '认证令牌已过期';
    } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
        statusCode = 400;
        code = 'INVALID_JSON';
        message = '无效的JSON格式';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        code = 'FILE_TOO_LARGE';
        message = '文件大小超过限制';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400;
        code = 'UNEXPECTED_FILE_FIELD';
        message = '意外的文件字段';
    }

    // 清理错误消息中的敏感信息
    message = sanitizeErrorMessage(message);

    // 记录错误日志
    if (statusCode >= 500) {
        logger.error(`服务器错误: ${req.method} ${req.originalUrl}`, {
            message: err.message,
            stack: err.stack,
            body: req.body,
            query: req.query,
            params: req.params
        });
    } else {
        logger.warn(`客户端错误: ${req.method} ${req.originalUrl}`, {
            statusCode,
            code,
            message
        });
    }

    // 发送错误响应
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message
        }
    });
}

/**
 * 清理错误消息中的敏感信息
 * @param {string} message - 原始错误消息
 * @returns {string} 清理后的消息
 */
function sanitizeErrorMessage(message) {
    // 移除可能的文件路径
    message = message.replace(/[A-Z]:\\[^\s]+/gi, '[PATH]');

    // 移除可能的用户目录
    message = message.replace(/\/home\/[^\s]+/gi, '[PATH]');
    message = message.replace(/\/Users\/[^\s]+/gi, '[PATH]');

    // 转义HTML
    message = sanitizeHtml(message);

    return message;
}

/**
 * 请求验证中间件
 * 验证请求体中的必填字段
 * @param {Array} requiredFields - 必填字段列表
 * @returns {Function}
 */
function validateRequired(requiredFields) {
    return (req, res, next) => {
        const missing = [];

        for (const field of requiredFields) {
            const value = getField(req.body, field);
            if (value === undefined || value === null || value === '') {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            return next(badRequest(`缺少必填字段: ${missing.join(', ')}`));
        }

        next();
    };
}

/**
 * 获取嵌套对象的字段值
 * @param {Object} obj - 对象
 * @param {string} path - 字段路径 (如 'user.name')
 * @returns {*}
 */
function getField(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current === undefined || current === null) {
            return undefined;
        }
        current = current[key];
    }

    return current;
}

module.exports = {
    APIError,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    unprocessableEntity,
    internalError,
    asyncHandler,
    notFoundHandler,
    errorHandler,
    validateRequired,
    sanitizeErrorMessage
};
