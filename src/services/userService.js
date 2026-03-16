/**
 * 用户服务模块
 * 处理用户相关的所有业务逻辑
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validateUsername, validatePassword, validateUserStatus, validateUserRole } = require('../utils/validator');
const logger = require('../utils/logger');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 密码加密轮数
const SALT_ROUNDS = 10;

// 用户数据缓存
let usersData = null;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 加载用户数据
 * @returns {Object} 用户数据对象
 */
function loadUsersData() {
    ensureDataDir();

    if (fs.existsSync(USERS_FILE)) {
        try {
            const content = fs.readFileSync(USERS_FILE, 'utf-8');
            usersData = JSON.parse(content);
        } catch (error) {
            logger.error('加载用户数据失败:', error.message);
            usersData = { users: [] };
            saveUsersData();
        }
    } else {
        usersData = { users: [] };
        saveUsersData();
    }

    return usersData;
}

/**
 * 保存用户数据
 */
function saveUsersData() {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2), 'utf-8');
}

/**
 * 获取用户数据
 * @returns {Object} 用户数据对象
 */
function getUsersData() {
    if (!usersData) {
        loadUsersData();
    }
    return usersData;
}

/**
 * 创建用户
 * @param {Object} userData - 用户数据
 * @param {string} userData.username - 用户名
 * @param {string} userData.password - 密码（明文）
 * @param {string} userData.role - 角色（user/admin）
 * @param {string} userData.status - 状态
 * @returns {Object} 创建结果 {success: boolean, user?: Object, message?: string}
 */
async function createUser(userData) {
    const { username, password, role = 'user', status = 'pending' } = userData;

    // 验证用户名
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return { success: false, message: usernameValidation.message };
    }

    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message };
    }

    // 验证角色
    if (!validateUserRole(role)) {
        return { success: false, message: '无效的用户角色' };
    }

    // 验证状态
    if (!validateUserStatus(status)) {
        return { success: false, message: '无效的用户状态' };
    }

    const data = getUsersData();

    // 检查用户名是否已存在
    if (data.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { success: false, message: '用户名已存在' };
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户对象
    const now = new Date().toISOString();
    const newUser = {
        id: uuidv4(),
        username: username.trim(),
        password: hashedPassword,
        role,
        status,
        createdAt: now,
        updatedAt: now
    };

    data.users.push(newUser);
    saveUsersData();

    logger.info(`创建用户成功: ${username} (${role})`);

    // 返回不包含密码的用户信息
    const userWithoutPassword = { ...newUser };
    delete userWithoutPassword.password;

    return { success: true, user: userWithoutPassword };
}

/**
 * 用户注册（默认pending状态）
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Object} 注册结果
 */
async function registerUser(username, password) {
    const result = await createUser({
        username,
        password,
        role: 'user',
        status: 'pending'
    });

    if (result.success) {
        logger.info(`用户注册: ${username}，等待审核`);
    }

    return result;
}

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Object} 登录结果 {success: boolean, user?: Object, message?: string}
 */
async function loginUser(username, password) {
    const data = getUsersData();

    // 查找用户
    const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        return { success: false, message: '用户名或密码错误' };
    }

    // 检查用户状态
    if (user.status === 'pending') {
        return { success: false, message: '账号正在等待管理员审核，请稍后再试' };
    }

    if (user.status === 'rejected') {
        return { success: false, message: '您的注册申请已被拒绝' };
    }

    if (user.status === 'disabled') {
        return { success: false, message: '账号已被禁用，请联系管理员' };
    }

    if (user.status !== 'approved') {
        return { success: false, message: '账号状态异常，请联系管理员' };
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return { success: false, message: '用户名或密码错误' };
    }

    // 更新最后登录时间
    user.updatedAt = new Date().toISOString();
    saveUsersData();

    logger.info(`用户登录: ${username}`);

    // 返回不包含密码的用户信息
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    return { success: true, user: userWithoutPassword };
}

/**
 * 根据ID获取用户
 * @param {string} userId - 用户ID
 * @returns {Object|null} 用户对象（不含密码）
 */
function getUserById(userId) {
    const data = getUsersData();
    const user = data.users.find(u => u.id === userId);

    if (!user) {
        return null;
    }

    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    return userWithoutPassword;
}

/**
 * 根据用户名获取用户
 * @param {string} username - 用户名
 * @returns {Object|null} 用户对象（不含密码）
 */
function getUserByUsername(username) {
    const data = getUsersData();
    const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        return null;
    }

    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    return userWithoutPassword;
}

/**
 * 获取所有用户列表
 * @param {Object} filters - 筛选条件
 * @returns {Array} 用户列表（不含密码）
 */
function getAllUsers(filters = {}) {
    const data = getUsersData();
    let users = data.users;

    // 按状态筛选
    if (filters.status) {
        users = users.filter(u => u.status === filters.status);
    }

    // 按角色筛选
    if (filters.role) {
        users = users.filter(u => u.role === filters.role);
    }

    // 搜索用户名
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        users = users.filter(u => u.username.toLowerCase().includes(searchLower));
    }

    // 返回不含密码的用户列表
    return users.map(u => {
        const userWithoutPassword = { ...u };
        delete userWithoutPassword.password;
        return userWithoutPassword;
    });
}

/**
 * 获取待审核用户列表
 * @returns {Array} 待审核用户列表
 */
function getPendingUsers() {
    return getAllUsers({ status: 'pending' });
}

/**
 * 获取待审核用户数量
 * @returns {number} 待审核用户数量
 */
function getPendingUsersCount() {
    const data = getUsersData();
    return data.users.filter(u => u.status === 'pending').length;
}

/**
 * 更新用户状态
 * @param {string} userId - 用户ID
 * @param {string} status - 新状态
 * @returns {Object} 更新结果
 */
function updateUserStatus(userId, status) {
    if (!validateUserStatus(status)) {
        return { success: false, message: '无效的用户状态' };
    }

    const data = getUsersData();
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return { success: false, message: '用户不存在' };
    }

    data.users[userIndex].status = status;
    data.users[userIndex].updatedAt = new Date().toISOString();
    saveUsersData();

    logger.info(`用户状态更新: ${data.users[userIndex].username} -> ${status}`);

    const userWithoutPassword = { ...data.users[userIndex] };
    delete userWithoutPassword.password;

    return { success: true, user: userWithoutPassword };
}

/**
 * 审核通过用户
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function approveUser(userId) {
    return updateUserStatus(userId, 'approved');
}

/**
 * 拒绝用户
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function rejectUser(userId) {
    return updateUserStatus(userId, 'rejected');
}

/**
 * 禁用用户
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function disableUser(userId) {
    return updateUserStatus(userId, 'disabled');
}

/**
 * 启用用户
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function enableUser(userId) {
    return updateUserStatus(userId, 'approved');
}

/**
 * 重置用户密码
 * @param {string} userId - 用户ID
 * @param {string} newPassword - 新密码（可选，不提供则生成随机密码）
 * @returns {Object} 操作结果 {success: boolean, newPassword?: string, message?: string}
 */
async function resetUserPassword(userId, newPassword = null) {
    const data = getUsersData();
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return { success: false, message: '用户不存在' };
    }

    // 生成或验证密码
    let password = newPassword;
    if (!password) {
        // 生成随机密码：8位字母数字组合
        password = generateRandomPassword();
    }

    // 验证密码格式
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message };
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    data.users[userIndex].password = hashedPassword;
    data.users[userIndex].updatedAt = new Date().toISOString();
    saveUsersData();

    logger.info(`重置用户密码: ${data.users[userIndex].username}`);

    return { success: true, newPassword: password };
}

/**
 * 修改用户密码（用户自己修改）
 * @param {string} userId - 用户ID
 * @param {string} oldPassword - 旧密码
 * @param {string} newPassword - 新密码
 * @returns {Object} 操作结果 {success: boolean, message?: string}
 */
async function changePassword(userId, oldPassword, newPassword) {
    const data = getUsersData();
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return { success: false, message: '用户不存在' };
    }

    const user = data.users[userIndex];

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
        return { success: false, message: '旧密码不正确' };
    }

    // 验证新密码格式
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message };
    }

    // 检查新密码是否与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
        return { success: false, message: '新密码不能与旧密码相同' };
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    data.users[userIndex].password = hashedPassword;
    data.users[userIndex].updatedAt = new Date().toISOString();
    saveUsersData();

    logger.info(`用户修改密码: ${user.username}`);

    return { success: true, message: '密码修改成功' };
}

/**
 * 生成随机密码
 * @returns {string} 随机密码
 */
function generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    // 确保包含至少一个字母和一个数字
    password += chars.charAt(Math.floor(Math.random() * 52)); // 字母
    password += chars.charAt(52 + Math.floor(Math.random() * 10)); // 数字
    // 填充剩余字符
    for (let i = 2; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // 打乱顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 删除用户
 * @param {string} userId - 用户ID
 * @returns {Object} 删除结果
 */
function deleteUser(userId) {
    const data = getUsersData();
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return { success: false, message: '用户不存在' };
    }

    const username = data.users[userIndex].username;
    data.users.splice(userIndex, 1);
    saveUsersData();

    logger.info(`删除用户: ${username}`);

    return { success: true };
}

/**
 * 批量导入用户
 * @param {Array} usersList - 用户列表 [{username, password}]
 * @returns {Object} 导入结果 {success: number, failed: Array}
 */
async function importUsers(usersList) {
    const results = {
        success: 0,
        failed: []
    };

    for (const userData of usersList) {
        const result = await createUser({
            username: userData.username,
            password: userData.password,
            role: userData.role || 'user',
            status: 'approved' // 导入的用户直接为已通过状态
        });

        if (result.success) {
            results.success++;
        } else {
            results.failed.push({
                username: userData.username,
                reason: result.message
            });
        }
    }

    logger.info(`批量导入用户完成: 成功 ${results.success}, 失败 ${results.failed.length}`);

    return results;
}

/**
 * 检查是否存在管理员
 * @returns {boolean} 是否存在管理员
 */
function hasAdmin() {
    const data = getUsersData();
    return data.users.some(u => u.role === 'admin' && u.status === 'approved');
}

/**
 * 获取用户统计信息
 * @returns {Object} 统计信息
 */
function getUserStats() {
    const data = getUsersData();

    return {
        total: data.users.length,
        pending: data.users.filter(u => u.status === 'pending').length,
        approved: data.users.filter(u => u.status === 'approved').length,
        rejected: data.users.filter(u => u.status === 'rejected').length,
        disabled: data.users.filter(u => u.status === 'disabled').length,
        admins: data.users.filter(u => u.role === 'admin').length
    };
}

module.exports = {
    loadUsersData,
    saveUsersData,
    createUser,
    registerUser,
    loginUser,
    getUserById,
    getUserByUsername,
    getAllUsers,
    getPendingUsers,
    getPendingUsersCount,
    updateUserStatus,
    approveUser,
    rejectUser,
    disableUser,
    enableUser,
    resetUserPassword,
    changePassword,
    deleteUser,
    importUsers,
    hasAdmin,
    getUserStats,
    generateRandomPassword
};
