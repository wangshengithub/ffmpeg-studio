/**
 * 配置管理模块
 * 负责加载、读取和保存系统配置
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = require('./default.json');

// 当前配置缓存
let currentConfig = null;

/**
 * 确保配置目录存在
 */
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * 加载配置
 * 如果配置文件不存在，则使用默认配置创建
 * @returns {Object} 配置对象
 */
function loadConfig() {
    ensureConfigDir();

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const savedConfig = JSON.parse(fileContent);
            // 深度合并默认配置和保存的配置
            currentConfig = deepMerge(DEFAULT_CONFIG, savedConfig);
        } catch (error) {
            console.error('加载配置文件失败，使用默认配置:', error.message);
            currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveConfig(currentConfig);
        }
    } else {
        currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveConfig(currentConfig);
    }

    return currentConfig;
}

/**
 * 保存配置到文件
 * @param {Object} config - 配置对象
 */
function saveConfig(config) {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    currentConfig = config;
}

/**
 * 获取当前配置
 * @returns {Object} 配置对象
 */
function getConfig() {
    if (!currentConfig) {
        loadConfig();
    }
    return currentConfig;
}

/**
 * 获取指定路径的配置值
 * @param {string} keyPath - 配置路径，如 'system.maxConcurrent'
 * @param {*} defaultValue - 默认值
 * @returns {*} 配置值
 */
function get(keyPath, defaultValue = null) {
    const config = getConfig();
    const keys = keyPath.split('.');
    let value = config;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }

    return value;
}

/**
 * 设置指定路径的配置值
 * @param {string} keyPath - 配置路径
 * @param {*} value - 配置值
 */
function set(keyPath, value) {
    const config = getConfig();
    const keys = keyPath.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    saveConfig(config);
}

/**
 * 深度合并两个对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

/**
 * 重置配置为默认值
 */
function resetConfig() {
    currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    saveConfig(currentConfig);
}

module.exports = {
    loadConfig,
    saveConfig,
    getConfig,
    get,
    set,
    resetConfig,
    CONFIG_DIR,
    CONFIG_FILE
};
