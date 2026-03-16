/**
 * 日志工具模块
 * 提供统一的日志记录功能
 */

const fs = require('fs');
const path = require('path');

// 日志目录和文件
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// 日志级别
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 当前日志级别（可配置）
let currentLevel = LOG_LEVELS.INFO;

// 最大日志文件大小 (5MB)
const MAX_LOG_SIZE = 5 * 1024 * 1024;

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的日期时间字符串
 */
function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 检查并轮转日志文件
 */
function rotateLogIfNeeded() {
    if (fs.existsSync(LOG_FILE)) {
        const stats = fs.statSync(LOG_FILE);
        if (stats.size >= MAX_LOG_SIZE) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(LOG_DIR, `app_${timestamp}.log`);
            fs.renameSync(LOG_FILE, backupFile);

            // 清理旧的日志文件，只保留最近5个
            const logFiles = fs.readdirSync(LOG_DIR)
                .filter(f => f.startsWith('app_') && f.endsWith('.log'))
                .sort()
                .reverse();

            if (logFiles.length > 5) {
                logFiles.slice(5).forEach(f => {
                    fs.unlinkSync(path.join(LOG_DIR, f));
                });
            }
        }
    }
}

/**
 * 写入日志
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {*} data - 附加数据
 */
function writeLog(level, message, data = null) {
    ensureLogDir();
    rotateLogIfNeeded();

    const timestamp = formatDateTime(new Date());
    let logLine = `[${timestamp}] [${level}] ${message}`;

    if (data !== null) {
        if (typeof data === 'object') {
            logLine += ' ' + JSON.stringify(data);
        } else {
            logLine += ' ' + data;
        }
    }

    // 写入文件
    fs.appendFileSync(LOG_FILE, logLine + '\n', 'utf-8');

    // 控制台输出
    const levelColors = {
        DEBUG: '\x1b[36m',  // 青色
        INFO: '\x1b[32m',   // 绿色
        WARN: '\x1b[33m',   // 黄色
        ERROR: '\x1b[31m'   // 红色
    };
    const reset = '\x1b[0m';
    console.log(`${levelColors[level] || ''}${logLine}${reset}`);
}

/**
 * 设置日志级别
 * @param {number} level - 日志级别
 */
function setLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
        currentLevel = level;
    }
}

/**
 * 调试日志
 * @param {string} message - 日志消息
 * @param {*} data - 附加数据
 */
function debug(message, data = null) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        writeLog('DEBUG', message, data);
    }
}

/**
 * 信息日志
 * @param {string} message - 日志消息
 * @param {*} data - 附加数据
 */
function info(message, data = null) {
    if (currentLevel <= LOG_LEVELS.INFO) {
        writeLog('INFO', message, data);
    }
}

/**
 * 警告日志
 * @param {string} message - 日志消息
 * @param {*} data - 附加数据
 */
function warn(message, data = null) {
    if (currentLevel <= LOG_LEVELS.WARN) {
        writeLog('WARN', message, data);
    }
}

/**
 * 错误日志
 * @param {string} message - 日志消息
 * @param {*} data - 附加数据
 */
function error(message, data = null) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
        writeLog('ERROR', message, data);
    }
}

/**
 * 读取日志文件
 * @param {number} lines - 读取的行数
 * @returns {string} 日志内容
 */
function readLogs(lines = 100) {
    if (!fs.existsSync(LOG_FILE)) {
        return '';
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());

    if (allLines.length <= lines) {
        return allLines.join('\n');
    }

    return allLines.slice(-lines).join('\n');
}

module.exports = {
    LOG_LEVELS,
    setLevel,
    debug,
    info,
    warn,
    error,
    readLogs,
    LOG_DIR,
    LOG_FILE
};
