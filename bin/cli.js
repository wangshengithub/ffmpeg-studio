#!/usr/bin/env node

/**
 * FFmpeg Studio CLI 工具
 * 命令行管理工具
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 加载模块
const config = require('../src/config');
const userService = require('../src/services/userService');
const logger = require('../src/utils/logger');

// 创建命令行接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * 提示输入
 * @param {string} question - 问题
 * @param {boolean} hidden - 是否隐藏输入
 * @returns {Promise<string>}
 */
function prompt(question, hidden = false) {
    return new Promise((resolve) => {
        if (hidden) {
            // 隐藏输入（用于密码）
            process.stdout.write(question);
            process.stdin.setRawMode(true);
            let password = '';
            process.stdin.resume();
            process.stdin.on('data', (char) => {
                const ch = char.toString('utf8');
                switch (ch) {
                    case '\n':
                    case '\r':
                    case '\u0004': // Ctrl+D
                        process.stdin.setRawMode(false);
                        process.stdout.write('\n');
                        process.stdin.pause();
                        resolve(password);
                        break;
                    case '\u0003': // Ctrl+C
                        process.exit();
                        break;
                    case '\u007F': // Backspace
                        password = password.slice(0, -1);
                        process.stdout.clearLine();
                        process.stdout.cursorTo(0);
                        process.stdout.write(question + '*'.repeat(password.length));
                        break;
                    default:
                        password += ch;
                        process.stdout.clearLine();
                        process.stdout.cursorTo(0);
                        process.stdout.write(question + '*'.repeat(password.length));
                        break;
                }
            });
        } else {
            rl.question(question, resolve);
        }
    });
}

/**
 * 确认操作
 * @param {string} question - 问题
 * @returns {Promise<boolean>}
 */
async function confirm(question) {
    const answer = await prompt(`${question} (y/N): `);
    return answer.toLowerCase() === 'y';
}

// 配置CLI程序
program
    .name('ffmpeg-studio')
    .description('FFmpeg Studio 命令行管理工具')
    .version(require('../package.json').version);

// ==================== 启动命令 ====================

program.command('start')
    .description('启动服务器')
    .option('-p, --port <port>', '指定端口', parseInt)
    .option('-h, --host <host>', '指定主机')
    .action((options) => {
        if (options.port) {
            config.set('system.port', options.port);
        }
        if (options.host) {
            config.set('system.host', options.host);
        }

        console.log('正在启动服务器...');
        require('../src/server');
    });

// ==================== 配置管理 ====================

const configCmd = program.command('config')
    .description('配置管理');

configCmd.command('list')
    .description('显示当前配置')
    .action(() => {
        const currentConfig = config.getConfig();
        console.log('\n当前配置:');
        console.log(JSON.stringify(currentConfig, null, 2));
    });

configCmd.command('get <key>')
    .description('获取配置值')
    .action((key) => {
        const value = config.get(key);
        if (value !== null) {
            console.log(`${key} = ${JSON.stringify(value)}`);
        } else {
            console.log(`配置项 "${key}" 不存在`);
        }
    });

configCmd.command('set <key> <value>')
    .description('设置配置值')
    .action((key, value) => {
        // 尝试解析JSON值
        let parsedValue;
        try {
            parsedValue = JSON.parse(value);
        } catch {
            parsedValue = value;
        }

        config.set(key, parsedValue);
        console.log(`已设置 ${key} = ${JSON.stringify(parsedValue)}`);
    });

configCmd.command('reset')
    .description('重置为默认配置')
    .action(async () => {
        const confirmed = await confirm('确定要重置所有配置为默认值吗？');
        if (confirmed) {
            config.resetConfig();
            console.log('配置已重置为默认值');
        } else {
            console.log('操作已取消');
        }
        rl.close();
    });

// ==================== 用户管理 ====================

const userCmd = program.command('user')
    .description('用户管理');

userCmd.command('list')
    .description('列出所有用户')
    .option('-s, --status <status>', '按状态筛选')
    .option('-r, --role <role>', '按角色筛选')
    .action((options) => {
        const filters = {};
        if (options.status) filters.status = options.status;
        if (options.role) filters.role = options.role;

        const users = userService.getAllUsers(filters);

        console.log('\n用户列表:');
        console.log('─'.repeat(80));
        console.log('%-20s %-10s %-12s %-20s', '用户名', '角色', '状态', '创建时间');
        console.log('─'.repeat(80));

        users.forEach(user => {
            console.log('%-20s %-10s %-12s %-20s',
                user.username,
                user.role,
                user.status,
                new Date(user.createdAt).toLocaleString()
            );
        });

        console.log('─'.repeat(80));
        console.log(`共 ${users.length} 个用户\n`);
        rl.close();
    });

userCmd.command('create')
    .description('创建用户')
    .option('-a, --admin', '创建管理员')
    .option('-u, --username <username>', '用户名')
    .option('-p, --password <password>', '密码')
    .action(async (options) => {
        let username = options.username;
        let password = options.password;

        if (!username) {
            username = await prompt('请输入用户名: ');
        }

        if (!password) {
            password = await prompt('请输入密码: ', true);
        }

        const role = options.admin ? 'admin' : 'user';

        const result = await userService.createUser({
            username,
            password,
            role,
            status: 'approved'
        });

        if (result.success) {
            console.log(`\n用户创建成功!`);
            console.log(`用户名: ${result.user.username}`);
            console.log(`角色: ${result.user.role}`);
        } else {
            console.log(`\n创建失败: ${result.message}`);
        }

        rl.close();
    });

userCmd.command('import <file>')
    .description('从JSON文件批量导入用户')
    .action(async (file) => {
        if (!fs.existsSync(file)) {
            console.log(`文件不存在: ${file}`);
            rl.close();
            return;
        }

        try {
            const content = fs.readFileSync(file, 'utf-8');
            const data = JSON.parse(content);

            if (!data.users || !Array.isArray(data.users)) {
                console.log('无效的文件格式，需要包含 users 数组');
                rl.close();
                return;
            }

            console.log(`即将导入 ${data.users.length} 个用户...`);
            const confirmed = await confirm('确定要导入吗？');

            if (confirmed) {
                const result = await userService.importUsers(data.users);
                console.log(`\n导入完成:`);
                console.log(`成功: ${result.success}`);
                if (result.failed.length > 0) {
                    console.log(`失败: ${result.failed.length}`);
                    result.failed.forEach(f => {
                        console.log(`  - ${f.username}: ${f.reason}`);
                    });
                }
            } else {
                console.log('操作已取消');
            }
        } catch (error) {
            console.log(`导入失败: ${error.message}`);
        }

        rl.close();
    });

userCmd.command('disable <username>')
    .description('禁用用户')
    .action(async (username) => {
        const user = userService.getUserByUsername(username);
        if (!user) {
            console.log(`用户不存在: ${username}`);
            rl.close();
            return;
        }

        const confirmed = await confirm(`确定要禁用用户 "${username}" 吗？`);
        if (confirmed) {
            const result = userService.disableUser(user.id);
            if (result.success) {
                console.log(`用户 "${username}" 已禁用`);
            } else {
                console.log(`禁用失败: ${result.message}`);
            }
        } else {
            console.log('操作已取消');
        }

        rl.close();
    });

userCmd.command('enable <username>')
    .description('启用用户')
    .action(async (username) => {
        const user = userService.getUserByUsername(username);
        if (!user) {
            console.log(`用户不存在: ${username}`);
            rl.close();
            return;
        }

        const result = userService.enableUser(user.id);
        if (result.success) {
            console.log(`用户 "${username}" 已启用`);
        } else {
            console.log(`启用失败: ${result.message}`);
        }

        rl.close();
    });

userCmd.command('reset-password <username>')
    .description('重置用户密码')
    .option('-p, --password <password>', '新密码')
    .action(async (username, options) => {
        const user = userService.getUserByUsername(username);
        if (!user) {
            console.log(`用户不存在: ${username}`);
            rl.close();
            return;
        }

        let newPassword = options.password;
        if (!newPassword) {
            newPassword = await prompt('请输入新密码 (留空自动生成): ', true);
        }

        const result = await userService.resetUserPassword(user.id, newPassword || null);

        if (result.success) {
            console.log(`\n密码重置成功!`);
            console.log(`新密码: ${result.newPassword}`);
            console.log('请妥善保存新密码');
        } else {
            console.log(`\n重置失败: ${result.message}`);
        }

        rl.close();
    });

userCmd.command('delete <username>')
    .description('删除用户')
    .action(async (username) => {
        const user = userService.getUserByUsername(username);
        if (!user) {
            console.log(`用户不存在: ${username}`);
            rl.close();
            return;
        }

        if (user.role === 'admin') {
            const stats = userService.getUserStats();
            if (stats.admins <= 1) {
                console.log('无法删除最后一个管理员');
                rl.close();
                return;
            }
        }

        const confirmed = await confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复！`);
        if (confirmed) {
            const result = userService.deleteUser(user.id);
            if (result.success) {
                console.log(`用户 "${username}" 已删除`);
            } else {
                console.log(`删除失败: ${result.message}`);
            }
        } else {
            console.log('操作已取消');
        }

        rl.close();
    });

// ==================== 硬件检测 ====================

program.command('hardware')
    .description('检测硬件加速支持')
    .action(async () => {
        console.log('\n正在检测硬件加速支持...\n');

        try {
            const ffmpegService = require('../src/services/ffmpegService');

            // 初始化 FFmpeg 服务（异步）
            await ffmpegService.initFFmpeg();

            const result = ffmpegService.getHwAccelInfo();

            console.log('硬件加速检测结果:');
            console.log('─'.repeat(50));

            const hwAccelNames = {
                'nvenc': 'NVIDIA NVENC',
                'qsv': 'Intel Quick Sync Video',
                'vce': 'AMD VCE/AMF',
                'videotoolbox': 'Apple VideoToolbox',
                'cpu': 'CPU (纯软件)'
            };

            if (result.available) {
                console.log(`${(hwAccelNames[result.type] || result.type).padEnd(25)} ✓ 支持`);
                console.log(`编码器: ${result.encoder}`);
            } else {
                console.log(`${hwAccelNames['cpu'].padEnd(25)} ✓ 支持`);
                console.log(`编码器: libx264`);
            }

            console.log('─'.repeat(50));
            console.log(`推荐使用: ${result.available ? (hwAccelNames[result.type] || result.type) : 'CPU (纯软件)'}`);
            console.log();

        } catch (error) {
            console.log(`检测失败: ${error.message}`);
        }

        rl.close();
    });

// ==================== 系统信息 ====================

program.command('info')
    .description('显示系统信息')
    .action(() => {
        const hardwareDetect = require('../src/utils/hardwareDetect');
        const resources = hardwareDetect.getSystemResources();

        console.log('\n系统信息:');
        console.log('─'.repeat(50));
        console.log(`平台: ${resources.platform}`);
        console.log(`架构: ${resources.arch}`);
        console.log(`CPU: ${resources.cpu.model}`);
        console.log(`CPU核心: ${resources.cpu.cores}`);
        console.log(`CPU使用率: ${resources.cpu.usage}%`);
        console.log(`总内存: ${hardwareDetect.formatBytes(resources.memory.total)}`);
        console.log(`已用内存: ${hardwareDetect.formatBytes(resources.memory.used)}`);
        console.log(`内存使用率: ${resources.memory.usagePercent}%`);
        console.log('─'.repeat(50));

        console.log('\nFFmpeg Studio 配置:');
        console.log('─'.repeat(50));
        console.log(`端口: ${config.get('system.port')}`);
        console.log(`最大并发数: ${config.get('system.maxConcurrent')}`);
        console.log(`最大文件大小: ${hardwareDetect.formatBytes(config.get('system.maxFileSize'))}`);
        console.log(`Token过期时间: ${config.get('system.tokenExpire') / 3600} 小时`);
        console.log(`自动清理: ${config.get('storage.autoCleanup') ? '开启' : '关闭'}`);
        console.log('─'.repeat(50));
        console.log();

        rl.close();
    });

// ==================== 数据管理 ====================

const dataCmd = program.command('data')
    .description('数据管理');

dataCmd.command('export-users <file>')
    .description('导出用户数据')
    .action((file) => {
        const users = userService.getAllUsers();
        const exportData = {
            users: users.map(u => ({
                username: u.username,
                role: u.role,
                status: u.status
            })),
            exportedAt: new Date().toISOString()
        };

        fs.writeFileSync(file, JSON.stringify(exportData, null, 2));
        console.log(`已导出 ${users.length} 个用户到 ${file}`);
        rl.close();
    });

dataCmd.command('stats')
    .description('显示数据统计')
    .action(() => {
        const userStats = userService.getUserStats();
        const taskService = require('../src/services/taskService');
        const taskStats = taskService.getTaskStats();
        const presetService = require('../src/services/presetService');
        const presetStats = presetService.getPresetStats();

        console.log('\n数据统计:');
        console.log('─'.repeat(40));

        console.log('\n用户:');
        console.log(`  总数: ${userStats.total}`);
        console.log(`  已通过: ${userStats.approved}`);
        console.log(`  待审核: ${userStats.pending}`);
        console.log(`  已禁用: ${userStats.disabled}`);

        console.log('\n任务:');
        console.log(`  总数: ${taskStats.total}`);
        console.log(`  等待中: ${taskStats.pending}`);
        console.log(`  处理中: ${taskStats.processing}`);
        console.log(`  已完成: ${taskStats.completed}`);
        console.log(`  失败: ${taskStats.failed}`);

        console.log('\n预设:');
        console.log(`  总数: ${presetStats.total}`);
        console.log(`  内置: ${presetStats.builtin}`);
        console.log(`  自定义: ${presetStats.custom}`);
        console.log(`  公开: ${presetStats.public}`);

        console.log('─'.repeat(40));
        console.log();

        rl.close();
    });

// 解析命令行参数
program.parse();
