/**
 * 系统资源监控工具模块
 * 提供系统资源信息获取功能
 */

/**
 * 获取系统资源信息
 * @returns {Object} 资源信息
 */
function getSystemResources() {
    const os = require('os');

    return {
        cpu: {
            cores: os.cpus().length,
            model: os.cpus()[0]?.model || 'Unknown',
            usage: getCpuUsage()
        },
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        platform: os.platform(),
        arch: os.arch()
    };
}

/**
 * 获取CPU使用率（简单估算）
 * @returns {number} CPU使用率百分比
 */
function getCpuUsage() {
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    }

    const totalUsage = totalTick - totalIdle;
    return ((totalUsage / totalTick) * 100).toFixed(2);
}

/**
 * 格式化字节数为可读格式
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

module.exports = {
    getSystemResources,
    formatBytes
};
