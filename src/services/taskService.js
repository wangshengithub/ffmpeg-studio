/**
 * 任务服务模块
 * 处理任务相关的所有业务逻辑
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validateTaskType, validateTaskStatus, formatSecondsToTime } = require('../utils/validator');
const logger = require('../utils/logger');
const config = require('../config');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// 任务数据缓存
let tasksData = null;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 加载任务数据
 * @returns {Object} 任务数据对象
 */
function loadTasksData() {
    ensureDataDir();

    if (fs.existsSync(TASKS_FILE)) {
        try {
            const content = fs.readFileSync(TASKS_FILE, 'utf-8');
            tasksData = JSON.parse(content);
        } catch (error) {
            logger.error('加载任务数据失败:', error.message);
            tasksData = { tasks: [] };
            saveTasksData();
        }
    } else {
        tasksData = { tasks: [] };
        saveTasksData();
    }

    return tasksData;
}

/**
 * 保存任务数据
 */
function saveTasksData() {
    ensureDataDir();
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2), 'utf-8');
}

/**
 * 获取任务数据
 * @returns {Object} 任务数据对象
 */
function getTasksData() {
    if (!tasksData) {
        loadTasksData();
    }
    return tasksData;
}

/**
 * 创建新任务
 * @param {Object} taskData - 任务数据
 * @returns {Object} 创建的任务对象
 */
function createTask(taskData) {
    const {
        userId,
        type,
        inputFile,
        inputFiles,
        outputFile,
        presetId = null,
        config = {}
    } = taskData;

    // 验证任务类型
    if (!validateTaskType(type)) {
        return { success: false, message: '无效的任务类型' };
    }

    const data = getTasksData();

    const now = new Date().toISOString();

    // 支持多文件和单文件两种模式
    const files = inputFiles || (inputFile ? [inputFile] : []);

    const newTask = {
        id: uuidv4(),
        userId,
        type,
        status: 'pending',
        // 保存多文件数组
        inputFiles: files.map(f => ({
            name: f.name,
            size: f.size,
            path: f.path,
            mimeType: f.mimeType || 'application/octet-stream'
        })),
        // 兼容旧的单文件格式
        inputFile: files.length === 1 ? {
            name: files[0].name,
            size: files[0].size,
            path: files[0].path,
            mimeType: files[0].mimeType || 'application/octet-stream'
        } : null,
        outputFile: {
            name: outputFile.name,
            path: outputFile.path
        },
        presetId,
        config,
        progress: {
            percent: 0,
            currentTime: '00:00:00',
            totalTime: '00:00:00',
            speed: '0x',
            eta: 0
        },
        hardwareAccel: null,
        createdAt: now,
        startedAt: null,
        completedAt: null,
        error: null
    };

    data.tasks.push(newTask);
    saveTasksData();

    logger.info(`创建任务: ${newTask.id} (${type}), 文件数: ${files.length}`);

    return { success: true, task: newTask };
}

/**
 * 根据ID获取任务
 * @param {string} taskId - 任务ID
 * @returns {Object|null} 任务对象
 */
function getTaskById(taskId) {
    const data = getTasksData();
    return data.tasks.find(t => t.id === taskId) || null;
}

/**
 * 获取用户任务列表
 * @param {string} userId - 用户ID
 * @param {Object} filters - 筛选条件
 * @returns {Array} 任务列表
 */
function getUserTasks(userId, filters = {}) {
    const data = getTasksData();
    let tasks = data.tasks.filter(t => t.userId === userId);

    // 按状态筛选
    if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
    }

    // 按类型筛选
    if (filters.type) {
        tasks = tasks.filter(t => t.type === filters.type);
    }

    // 按创建时间倒序排列
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return tasks;
}

/**
 * 获取所有任务列表（管理员用）
 * @param {Object} filters - 筛选条件
 * @returns {Array} 任务列表
 */
function getAllTasks(filters = {}) {
    const data = getTasksData();
    let tasks = data.tasks;

    // 按状态筛选
    if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
    }

    // 按类型筛选
    if (filters.type) {
        tasks = tasks.filter(t => t.type === filters.type);
    }

    // 按用户筛选
    if (filters.userId) {
        tasks = tasks.filter(t => t.userId === filters.userId);
    }

    // 按创建时间倒序排列
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return tasks;
}

/**
 * 获取待处理任务列表
 * @returns {Array} 待处理任务列表
 */
function getPendingTasks() {
    const data = getTasksData();
    return data.tasks
        .filter(t => t.status === 'pending')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * 获取正在处理的任务列表
 * @returns {Array} 正在处理的任务列表
 */
function getProcessingTasks() {
    const data = getTasksData();
    return data.tasks.filter(t => t.status === 'processing');
}

/**
 * 更新任务状态
 * @param {string} taskId - 任务ID
 * @param {string} status - 新状态
 * @param {Object} additionalData - 额外数据
 * @returns {Object|null} 更新后的任务
 */
function updateTaskStatus(taskId, status, additionalData = {}) {
    if (!validateTaskStatus(status)) {
        return null;
    }

    const data = getTasksData();
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return null;
    }

    const task = data.tasks[taskIndex];
    task.status = status;

    // 更新时间戳
    if (status === 'processing' && !task.startedAt) {
        task.startedAt = new Date().toISOString();
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        task.completedAt = new Date().toISOString();
    }

    // 更新额外数据
    Object.assign(task, additionalData);

    saveTasksData();

    return task;
}

/**
 * 更新任务进度
 * @param {string} taskId - 任务ID
 * @param {Object} progress - 进度信息
 * @returns {Object|null} 更新后的任务
 */
function updateTaskProgress(taskId, progress) {
    const data = getTasksData();
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return null;
    }

    const task = data.tasks[taskIndex];
    task.progress = {
        percent: progress.percent || 0,
        currentTime: progress.currentTime || '00:00:00',
        totalTime: progress.totalTime || '00:00:00',
        speed: progress.speed || '0x',
        eta: progress.eta || 0
    };

    saveTasksData();

    return task;
}

/**
 * 开始处理任务
 * @param {string} taskId - 任务ID
 * @param {string} hardwareAccel - 使用的硬件加速
 * @returns {Object|null} 更新后的任务
 */
function startTask(taskId, hardwareAccel = 'cpu') {
    return updateTaskStatus(taskId, 'processing', {
        hardwareAccel,
        startedAt: new Date().toISOString()
    });
}

/**
 * 完成任务
 * @param {string} taskId - 任务ID
 * @returns {Object|null} 更新后的任务
 */
function completeTask(taskId) {
    return updateTaskStatus(taskId, 'completed', {
        progress: {
            percent: 100,
            currentTime: '00:00:00',
            totalTime: '00:00:00',
            speed: '0x',
            eta: 0
        },
        completedAt: new Date().toISOString()
    });
}

/**
 * 任务失败
 * @param {string} taskId - 任务ID
 * @param {string} errorMessage - 错误信息
 * @returns {Object|null} 更新后的任务
 */
function failTask(taskId, errorMessage) {
    return updateTaskStatus(taskId, 'failed', {
        error: errorMessage,
        completedAt: new Date().toISOString()
    });
}

/**
 * 取消任务
 * @param {string} taskId - 任务ID
 * @returns {Object|null} 更新后的任务
 */
function cancelTask(taskId) {
    const task = getTaskById(taskId);

    if (!task) {
        return { success: false, message: '任务不存在' };
    }

    // 只能取消pending或processing状态的任务
    if (task.status !== 'pending' && task.status !== 'processing') {
        return { success: false, message: '任务已完成，无法取消' };
    }

    const updatedTask = updateTaskStatus(taskId, 'cancelled', {
        completedAt: new Date().toISOString()
    });

    logger.info(`任务已取消: ${taskId}`);

    return { success: true, task: updatedTask };
}

/**
 * 删除任务
 * @param {string} taskId - 任务ID
 * @returns {Object} 删除结果
 */
function deleteTask(taskId) {
    const data = getTasksData();
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return { success: false, message: '任务不存在' };
    }

    const task = data.tasks[taskIndex];

    // 不能删除正在处理的任务
    if (task.status === 'processing') {
        return { success: false, message: '无法删除正在处理的任务' };
    }

    // 删除相关文件
    try {
        // 删除所有输入文件（支持多文件）
        const filesToDelete = task.inputFiles || (task.inputFile ? [task.inputFile] : []);
        for (const file of filesToDelete) {
            if (file && file.path) {
                const inputPath = file.path;
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                    logger.info(`删除输入文件: ${inputPath}`);
                }
            }
        }

        // 删除输出文件
        if (task.outputFile && task.outputFile.path) {
            const outputPath = task.outputFile.path;
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                logger.info(`删除输出文件: ${outputPath}`);
            }
        }

        // 对于 HLS/DASH 任务，删除相关的分片文件和目录
        if (task.type === 'hls' || task.type === 'dash') {
            const outputDir = path.dirname(task.outputFile?.path || '');
            if (outputDir && fs.existsSync(outputDir)) {
                // 检查目录是否在输出目录内，防止误删
                const outputBaseDir = path.resolve(config.get('storage.outputDir'));
                const resolvedOutputDir = path.resolve(outputDir);

                if (resolvedOutputDir.startsWith(outputBaseDir) && resolvedOutputDir !== outputBaseDir) {
                    // 获取目录中的所有文件
                    const files = fs.readdirSync(resolvedOutputDir);
                    const baseName = path.basename(task.outputFile.path, path.extname(task.outputFile.path));

                    // 删除与任务相关的所有文件
                    let deletedCount = 0;
                    files.forEach(file => {
                        const filePath = path.join(resolvedOutputDir, file);
                        const fileStat = fs.statSync(filePath);

                        // 如果是文件且文件名包含任务的基础名称
                        if (fileStat.isFile() && file.includes(baseName)) {
                            try {
                                fs.unlinkSync(filePath);
                                deletedCount++;
                                logger.debug(`删除分片文件: ${file}`);
                            } catch (err) {
                                logger.warn(`删除文件失败 ${file}: ${err.message}`);
                            }
                        }
                    });

                    // 如果目录为空或只剩下这个任务的文件，删除整个目录
                    const remainingFiles = fs.readdirSync(resolvedOutputDir);
                    if (remainingFiles.length === 0) {
                        fs.rmdirSync(resolvedOutputDir);
                        logger.info(`删除空目录: ${resolvedOutputDir}`);
                    }

                    logger.info(`删除了 ${deletedCount} 个HLS/DASH相关文件`);
                }
            }
        }
    } catch (error) {
        logger.warn(`删除任务文件时出错: ${error.message}`);
        // 继续删除任务记录，即使文件删除失败
    }

    data.tasks.splice(taskIndex, 1);
    saveTasksData();

    logger.info(`删除任务: ${taskId}`);

    return { success: true };
}

/**
 * 获取任务统计信息
 * @returns {Object} 统计信息
 */
function getTaskStats() {
    const data = getTasksData();
    const tasks = data.tasks;

    return {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
}

/**
 * 清理旧任务记录
 * @param {number} daysOld - 保留天数
 * @returns {number} 清理的任务数量
 */
function cleanupOldTasks(daysOld = 30) {
    const data = getTasksData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const initialLength = data.tasks.length;

    // 只清理已完成、失败或取消的任务
    data.tasks = data.tasks.filter(t => {
        // 保留pending和processing状态的任务
        if (t.status === 'pending' || t.status === 'processing') {
            return true;
        }
        // 检查完成时间
        const completedDate = new Date(t.completedAt || t.createdAt);
        return completedDate >= cutoffDate;
    });

    const removedCount = initialLength - data.tasks.length;

    if (removedCount > 0) {
        saveTasksData();
        logger.info(`清理了 ${removedCount} 个旧任务记录`);
    }

    return removedCount;
}

module.exports = {
    loadTasksData,
    saveTasksData,
    createTask,
    getTaskById,
    getUserTasks,
    getAllTasks,
    getPendingTasks,
    getProcessingTasks,
    updateTaskStatus,
    updateTaskProgress,
    startTask,
    completeTask,
    failTask,
    cancelTask,
    deleteTask,
    getTaskStats,
    cleanupOldTasks
};
