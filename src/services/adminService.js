/**
 * 管理员服务模块
 * 处理管理员相关的业务逻辑
 */

const fs = require('fs');
const path = require('path');
const userService = require('./userService');
const taskService = require('./taskService');
const presetService = require('./presetService');
const queueService = require('./queueService');
const config = require('../config');
const logger = require('../utils/logger');
const { getSystemResources, formatBytes } = require('../utils/hardwareDetect');

/**
 * 获取系统概览统计
 * @returns {Object} 统计数据
 */
function getSystemOverview() {
    const userStats = userService.getUserStats();
    const taskStats = taskService.getTaskStats();
    const presetStats = presetService.getPresetStats();
    const queueStatus = queueService.getQueueStatus();
    const resources = getSystemResources();

    return {
        users: userStats,
        tasks: taskStats,
        presets: presetStats,
        queue: queueStatus,
        resources: {
            cpuCores: resources.cpu.cores,
            cpuModel: resources.cpu.model,
            cpuUsage: resources.cpu.usage + '%',
            totalMemory: formatBytes(resources.memory.total),
            usedMemory: formatBytes(resources.memory.used),
            memoryUsage: resources.memory.usagePercent + '%',
            platform: resources.platform,
            arch: resources.arch
        }
    };
}

/**
 * 获取详细统计报告
 * @returns {Object} 统计报告
 */
function getDetailedStats() {
    const userStats = userService.getUserStats();
    const taskStats = taskService.getTaskStats();

    // 计算任务成功率
    const completedTasks = taskStats.completed;
    const totalFinished = completedTasks + taskStats.failed;
    const successRate = totalFinished > 0 ? ((completedTasks / totalFinished) * 100).toFixed(2) : 0;

    // 获取系统配置
    const systemConfig = {
        maxConcurrent: config.get('system.maxConcurrent'),
        maxFileSize: formatBytes(config.get('system.maxFileSize')),
        tokenExpire: config.get('system.tokenExpire') / 3600 + ' 小时',
        autoCleanup: config.get('storage.autoCleanup') ? '开启' : '关闭',
        cleanupAfter: config.get('storage.cleanupAfter') / 60 + ' 分钟'
    };

    return {
        summary: {
            totalUsers: userStats.total,
            activeUsers: userStats.approved,
            totalTasks: taskStats.total,
            completedTasks,
            successRate: successRate + '%',
            pendingTasks: taskStats.pending
        },
        userStats,
        taskStats,
        systemConfig
    };
}

/**
 * 批量导入用户
 * @param {Object} importData - 导入数据
 * @returns {Promise<Object>} 导入结果
 */
async function importUsers(importData) {
    if (!importData.users || !Array.isArray(importData.users)) {
        return {
            success: false,
            message: '无效的导入数据格式'
        };
    }

    const results = await userService.importUsers(importData.users);

    logger.info(`批量导入用户完成: 成功 ${results.success}, 失败 ${results.failed.length}`);

    return {
        success: true,
        imported: results.success,
        failed: results.failed,
        message: `成功导入 ${results.success} 个用户${results.failed.length > 0 ? `，${results.failed.length} 个失败` : ''}`
    };
}

/**
 * 更新系统配置
 * @param {Object} newConfig - 新配置
 * @returns {Object} 更新结果
 */
function updateSystemConfig(newConfig) {
    const allowedKeys = {
        'system.maxConcurrent': (v) => typeof v === 'number' && v > 0 && v <= 16,
        'system.maxFileSize': (v) => typeof v === 'number' && v > 0,
        'system.tokenExpire': (v) => typeof v === 'number' && v > 0,
        'storage.autoCleanup': (v) => typeof v === 'boolean',
        'storage.cleanupAfter': (v) => typeof v === 'number' && v > 0,
        'ffmpeg.hardwareAccel': (v) => ['auto', 'nvenc', 'qsv', 'vce', 'videotoolbox', 'cpu'].includes(v)
    };

    const updated = [];
    const errors = [];

    for (const [key, validator] of Object.entries(allowedKeys)) {
        if (newConfig[key] !== undefined) {
            if (validator(newConfig[key])) {
                config.set(key, newConfig[key]);
                updated.push(key);

                // 特殊处理：更新并发数
                if (key === 'system.maxConcurrent') {
                    queueService.setMaxConcurrent(newConfig[key]);
                }
            } else {
                errors.push({ key, message: '无效的配置值' });
            }
        }
    }

    if (updated.length > 0) {
        logger.info(`系统配置已更新: ${updated.join(', ')}`);
    }

    return {
        success: errors.length === 0,
        updated,
        errors,
        message: errors.length === 0 ? '配置更新成功' : '部分配置更新失败'
    };
}

/**
 * 获取系统日志
 * @param {Object} options - 查询选项
 * @returns {Object} 日志数据
 */
function getSystemLogs(options = {}) {
    const lines = options.lines || 100;
    const logger = require('../utils/logger');

    const logContent = logger.readLogs(lines);

    return {
        content: logContent,
        lines: logContent.split('\n').filter(l => l.trim()).length
    };
}

/**
 * 清理系统
 * @param {Object} options - 清理选项
 * @returns {Object} 清理结果
 */
function cleanupSystem(options = {}) {
    const results = {
        tasksCleaned: 0,
        filesCleaned: 0,
        bytesFreed: 0
    };

    // 清理旧任务记录
    if (options.cleanTasks) {
        results.tasksCleaned = taskService.cleanupOldTasks(options.taskDays || 30);
    }

    // 清理临时文件
    if (options.cleanFiles) {
        const uploadDir = config.get('storage.uploadDir');
        const outputDir = config.get('storage.outputDir');

        [uploadDir, outputDir].forEach(dir => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                const now = Date.now();
                const fileAge = (options.fileHours || 24) * 3600 * 1000;

                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > fileAge) {
                            const size = stats.size;
                            fs.unlinkSync(filePath);
                            results.filesCleaned++;
                            results.bytesFreed += size;
                        }
                    } catch (e) {
                        // 忽略删除失败的文件
                    }
                });
            }
        });
    }

    logger.info(`系统清理完成: 任务 ${results.tasksCleaned}, 文件 ${results.filesCleaned}`);

    return {
        success: true,
        ...results,
        bytesFreedFormatted: formatBytes(results.bytesFreed)
    };
}

/**
 * 获取用户详情（包含任务统计）
 * @param {string} userId - 用户ID
 * @returns {Object} 用户详情
 */
function getUserDetails(userId) {
    const user = userService.getUserById(userId);
    if (!user) {
        return null;
    }

    const userTasks = taskService.getAllTasks({ userId });

    // 统计任务
    const taskStats = {
        total: userTasks.length,
        pending: userTasks.filter(t => t.status === 'pending').length,
        processing: userTasks.filter(t => t.status === 'processing').length,
        completed: userTasks.filter(t => t.status === 'completed').length,
        failed: userTasks.filter(t => t.status === 'failed').length
    };

    // 计算处理的总数据量
    let totalInputSize = 0;
    userTasks.forEach(t => {
        if (t.inputFile && t.inputFile.size) {
            totalInputSize += t.inputFile.size;
        }
    });

    return {
        user,
        taskStats,
        totalInputSize: formatBytes(totalInputSize),
        recentTasks: userTasks.slice(0, 10)
    };
}

/**
 * 获取任务详情（管理员视角）
 * @param {string} taskId - 任务ID
 * @returns {Object|null} 任务详情
 */
function getTaskDetails(taskId) {
    const task = taskService.getTaskById(taskId);
    if (!task) {
        return null;
    }

    // 获取关联用户信息
    const user = userService.getUserById(task.userId);

    return {
        task,
        user: user ? {
            id: user.id,
            username: user.username,
            role: user.role
        } : null,
        queuePosition: queueService.getQueuePosition(taskId)
    };
}

/**
 * 导出用户数据
 * @returns {Object} 用户数据
 */
function exportUsers() {
    const users = userService.getAllUsers();

    // 移除敏感信息
    const exportData = users.map(u => ({
        username: u.username,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt
    }));

    return {
        users: exportData,
        exportedAt: new Date().toISOString(),
        total: exportData.length
    };
}

/**
 * 导出任务数据
 * @param {Object} filters - 筛选条件
 * @returns {Object} 任务数据
 */
function exportTasks(filters = {}) {
    const tasks = taskService.getAllTasks(filters);

    // 简化任务数据
    const exportData = tasks.map(t => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        status: t.status,
        inputFile: t.inputFile.name,
        inputSize: t.inputFile.size,
        hardwareAccel: t.hardwareAccel,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        error: t.error
    }));

    return {
        tasks: exportData,
        exportedAt: new Date().toISOString(),
        total: exportData.length
    };
}

module.exports = {
    getSystemOverview,
    getDetailedStats,
    importUsers,
    updateSystemConfig,
    getSystemLogs,
    cleanupSystem,
    getUserDetails,
    getTaskDetails,
    exportUsers,
    exportTasks
};
