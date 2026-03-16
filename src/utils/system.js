/**
 * 系统工具模块
 */

const { exec } = require('child_process');
const path = require('path');
const logger = require('./logger');

/**
 * 获取系统已安装的字体列表
 * @returns {Promise<Array>} 字体列表
 */
async function getSystemFonts() {
    return new Promise((resolve) => {
        const platform = process.platform;
        let command = '';

        if (platform === 'win32') {
            // Windows: 使用 PowerShell 加载 System.Drawing 后获取字体
            command = 'powershell -command "Add-Type -AssemblyName System.Drawing; [System.Drawing.FontFamily]::Families | Select-Object -ExpandProperty Name | Sort-Object"';
        } else if (platform === 'darwin') {
            // macOS: 使用 system_profiler
            command = 'system_profiler SPFontsDataType 2>/dev/null | grep "Full Name:" | cut -d: -f2- | sed \'s/^[[:space:]]*//\'';
        } else if (platform === 'linux') {
            // Linux: 使用 fc-list
            command = 'fc-list : family | cut -d: -f2- | sed \'s/^[[:space:]]*//\' | sort -u';
        }

        if (!command) {
            logger.warn('不支持的操作系统，返回默认字体列表');
            resolve(getDefaultFonts());
            return;
        }

        exec(command, { maxBuffer: 1024 * 1024 * 10, timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                logger.error('获取系统字体失败:', error.message);
                resolve(getDefaultFonts());
                return;
            }

            try {
                const fonts = parseFontList(stdout, platform);
                logger.info(`成功获取 ${fonts.length} 个系统字体`);
                resolve(fonts);
            } catch (parseError) {
                logger.error('解析字体列表失败:', parseError.message);
                resolve(getDefaultFonts());
            }
        });
    });
}

/**
 * 解析字体列表输出
 */
function parseFontList(output, platform) {
    const fonts = new Set();

    if (platform === 'win32') {
        // Windows PowerShell 输出: 每行一个字体名称
        const lines = output.split('\n');
        lines.forEach(line => {
            const fontName = line.trim();
            // 过滤掉空行和过长的名称
            if (fontName && fontName.length > 0 && fontName.length < 100) {
                fonts.add(fontName);
            }
        });
    } else if (platform === 'darwin') {
        // macOS 输出解析
        const lines = output.split('\n');
        lines.forEach(line => {
            const fontName = line.trim();
            if (fontName && fontName.length > 0 && fontName.length < 100) {
                fonts.add(fontName);
            }
        });
    } else if (platform === 'linux') {
        // Linux fc-list 输出解析
        const lines = output.split('\n');
        lines.forEach(line => {
            const fontName = line.trim();
            if (fontName && fontName.length > 0 && fontName.length < 100) {
                fonts.add(fontName);
            }
        });
    }

    const fontList = Array.from(fonts).sort();

    // 如果解析结果太少，返回默认列表
    if (fontList.length < 5) {
        logger.warn('解析的字体数量过少，使用默认列表');
        return getDefaultFonts();
    }

    return fontList;
}

/**
 * 获取默认字体列表
 */
function getDefaultFonts() {
    return [
        'Arial',
        'Arial Black',
        'Comic Sans MS',
        'Courier New',
        'Georgia',
        'Impact',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',
        // 中文字体
        '微软雅黑',
        'Microsoft YaHei',
        '黑体',
        'SimHei',
        '宋体',
        'SimSun',
        '楷体',
        'KaiTi',
        '仿宋',
        'FangSong'
    ];
}

module.exports = {
    getSystemFonts,
    getDefaultFonts
};
