/**
 * 任务队列服务模块
 * 管理并发任务执行，支持持久化
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const taskService = require('./taskService');
const ffmpegService = require('./ffmpegService');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const QUEUE_FILE = path.join(DATA_DIR, 'queue_state.json');

// 任务队列
let taskQueue = [];

// 正在处理的任务
const processingTasks = new Map();

// 最大并发数
let maxConcurrent = config.get('system.maxConcurrent', 4);

// WebSocket广播函数（由server.js设置）
let broadcastFn = null;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 保存队列状态到文件
 */
function saveQueueState() {
    ensureDataDir();

    const state = {
        queue: taskQueue.map(t => ({ id: t.id })),
        processing: Array.from(processingTasks.keys()),
        savedAt: new Date().toISOString()
    };

    try {
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
        logger.error('保存队列状态失败:', error.message);
    }
}

/**
 * 加载队列状态
 */
function loadQueueState() {
    ensureDataDir();

    if (!fs.existsSync(QUEUE_FILE)) {
        return null;
    }

    try {
        const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        logger.error('加载队列状态失败:', error.message);
        return null;
    }
}

/**
 * 清除队列状态文件
 */
function clearQueueState() {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            fs.unlinkSync(QUEUE_FILE);
        }
    } catch (error) {
        logger.error('清除队列状态失败:', error.message);
    }
}

/**
 * 设置WebSocket广播函数
 * @param {Function} fn - 广播函数
 */
function setBroadcastFunction(fn) {
    broadcastFn = fn;
}

/**
 * 广播消息到WebSocket客户端
 * @param {string} type - 消息类型
 * @param {Object} data - 消息数据
 */
function broadcast(type, data) {
    if (broadcastFn) {
        broadcastFn({ type, data });
    }
}

/**
 * 设置最大并发数
 * @param {number} value - 最大并发数
 */
function setMaxConcurrent(value) {
    if (typeof value === 'number' && value > 0 && value <= 16) {
        maxConcurrent = value;
        config.set('system.maxConcurrent', value);
        logger.info(`最大并发数设置为: ${value}`);
        // 尝试处理更多任务
        processQueue();
    }
}

/**
 * 获取最大并发数
 * @returns {number} 最大并发数
 */
function getMaxConcurrent() {
    return maxConcurrent;
}

/**
 * 获取队列状态
 * @returns {Object} 队列状态
 */
function getQueueStatus() {
    return {
        queueLength: taskQueue.length,
        processingCount: processingTasks.size,
        maxConcurrent,
        queue: taskQueue.map(t => t.id),
        processing: Array.from(processingTasks.keys())
    };
}

/**
 * 添加任务到队列
 * @param {Object} task - 任务对象
 */
function addToQueue(task) {
    // 检查任务是否已在队列中
    if (taskQueue.some(t => t.id === task.id) || processingTasks.has(task.id)) {
        logger.warn(`任务 ${task.id} 已在队列中`);
        return false;
    }

    taskQueue.push(task);
    logger.info(`任务 ${task.id} 加入队列，当前队列长度: ${taskQueue.length}`);

    // 保存队列状态
    saveQueueState();

    // 广播任务加入队列
    broadcast('task:queued', { taskId: task.id, queuePosition: taskQueue.length });

    // 尝试处理队列
    processQueue();

    return true;
}

/**
 * 从队列中移除任务
 * @param {string} taskId - 任务ID
 */
function removeFromQueue(taskId) {
    const index = taskQueue.findIndex(t => t.id === taskId);
    if (index !== -1) {
        taskQueue.splice(index, 1);
        logger.info(`任务 ${taskId} 从队列移除`);

        // 保存队列状态
        saveQueueState();

        return true;
    }
    return false;
}

/**
 * 处理任务队列
 */
function processQueue() {
    // 如果正在处理的任务数已达上限，则等待
    if (processingTasks.size >= maxConcurrent) {
        return;
    }

    // 如果队列为空，则无需处理
    if (taskQueue.length === 0) {
        return;
    }

    // 从队列取出任务
    const task = taskQueue.shift();

    if (!task) {
        return;
    }

    // 检查任务状态
    const currentTask = taskService.getTaskById(task.id);
    if (!currentTask || currentTask.status === 'cancelled') {
        // 任务已被删除或取消，处理下一个
        saveQueueState();
        processQueue();
        return;
    }

    // 开始处理任务
    processTask(currentTask);
}

/**
 * 处理单个任务
 * @param {Object} task - 任务对象
 */
async function processTask(task) {
    const taskId = task.id;

    // 获取硬件加速配置
    const hwAccelConfig = config.get('ffmpeg.hardwareAccel', 'auto');
    const hwAccel = ffmpegService.getRecommendedHwAccel(hwAccelConfig);

    // 更新任务状态为处理中
    taskService.startTask(taskId, hwAccel);

    // 广播任务开始
    broadcast('task:started', { taskId, hwAccel });

    // 添加到正在处理的任务
    processingTasks.set(taskId, {
        task,
        startTime: Date.now(),
        process: null
    });

    // 保存队列状态
    saveQueueState();

    try {
        // 获取输入文件（支持多文件）
        const inputFiles = task.inputFiles || (task.inputFile ? [task.inputFile] : []);
        const inputPaths = inputFiles.map(f => f.path);

        // 使用新的 executeTask 方法执行 FFmpeg 任务
        await ffmpegService.executeTask(task.type, {
            input: inputPaths.length === 1 ? inputPaths[0] : inputPaths,
            output: task.outputFile.path,
            hardwareAccel: hwAccel,
            ...task.config
        }, (progress) => {
            // 更新进度
            taskService.updateTaskProgress(taskId, progress);

            // 广播进度
            broadcast('task:progress', { taskId, progress });
        });

        // 任务完成
        taskService.completeTask(taskId);
        broadcast('task:completed', { taskId });

        logger.info(`任务完成: ${taskId}`);

    } catch (error) {
        // 任务失败
        taskService.failTask(taskId, error.message);
        broadcast('task:failed', { taskId, error: error.message });

        logger.error(`任务失败: ${taskId} - ${error.message}`);
    } finally {
        // 从正在处理的任务中移除
        processingTasks.delete(taskId);

        // 保存队列状态
        saveQueueState();

        // 处理队列中的下一个任务
        processQueue();
    }
}

/**
 * 取消任务
 * @param {string} taskId - 任务ID
 * @returns {Object} 操作结果
 */
function cancelTask(taskId) {
    // 检查是否在队列中
    if (removeFromQueue(taskId)) {
        const result = taskService.cancelTask(taskId);
        broadcast('task:cancelled', { taskId });
        return result;
    }

    // 检查是否正在处理
    if (processingTasks.has(taskId)) {
        const taskInfo = processingTasks.get(taskId);

        // 终止FFmpeg进程
        if (taskInfo.process) {
            taskInfo.process.kill('SIGTERM');
        }

        const result = taskService.cancelTask(taskId);
        processingTasks.delete(taskId);

        // 保存队列状态
        saveQueueState();

        broadcast('task:cancelled', { taskId });

        // 处理队列中的下一个任务
        processQueue();

        return result;
    }

    // 任务不在队列中也不在处理中，尝试直接取消
    const result = taskService.cancelTask(taskId);
    if (result.success) {
        broadcast('task:cancelled', { taskId });
    }

    return result;
}

/**
 * 初始化队列服务
 * 加载pending状态的任务到队列，并恢复之前的队列状态
 */
function initQueueService() {
    // 尝试恢复之前的队列状态
    const savedState = loadQueueState();

    if (savedState) {
        logger.info('发现之前保存的队列状态，正在恢复...');

        // 恢复正在处理的任务为pending状态
        if (savedState.processing && savedState.processing.length > 0) {
            logger.info(`恢复 ${savedState.processing.length} 个中断的任务`);
            savedState.processing.forEach(taskId => {
                const task = taskService.getTaskById(taskId);
                if (task && task.status === 'processing') {
                    // 将处理中的任务重置为pending
                    taskService.updateTaskStatus(taskId, 'pending');
                    logger.info(`任务 ${taskId} 已重置为pending状态`);
                }
            });
        }

        // 清除旧的队列状态
        clearQueueState();
    }

    // 加载所有pending任务
    const pendingTasks = taskService.getPendingTasks();

    // 按创建时间排序
    pendingTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // 加入队列
    pendingTasks.forEach(task => {
        taskQueue.push(task);
    });

    logger.info(`队列服务初始化完成，加载 ${pendingTasks.length} 个待处理任务`);

    // 保存初始队列状态
    saveQueueState();

    // 开始处理队列
    processQueue();
}

/**
 * 获取任务在队列中的位置
 * @param {string} taskId - 任务ID
 * @returns {number} 位置（从1开始），如果不在队列中返回-1
 */
function getQueuePosition(taskId) {
    const index = taskQueue.findIndex(t => t.id === taskId);
    return index !== -1 ? index + 1 : -1;
}

/**
 * 清空队列
 */
function clearQueue() {
    // 取消所有队列中的任务
    taskQueue.forEach(task => {
        taskService.cancelTask(task.id);
        broadcast('task:cancelled', { taskId: task.id });
    });

    taskQueue.length = 0;

    // 清除队列状态文件
    clearQueueState();

    logger.info('队列已清空');
}

module.exports = {
    setBroadcastFunction,
    setMaxConcurrent,
    getMaxConcurrent,
    getQueueStatus,
    addToQueue,
    removeFromQueue,
    processQueue,
    cancelTask,
    initQueueService,
    getQueuePosition,
    clearQueue
};
