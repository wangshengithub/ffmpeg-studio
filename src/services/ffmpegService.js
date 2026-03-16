/**
 * FFmpeg服务模块
 * 使用 @ffmpeg-oneclick/core 封装FFmpeg操作
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');

// @ffmpeg-oneclick/core 模块
let ffmpegCore = null;
let presets = null;
let MetadataProcessor = null;
let detectBestHardwareAccel = null;
let ConcurrentQueue = null;
let setFFmpegPath = null;
let setFFprobePath = null;

// 硬件加速信息缓存
let hwAccelInfo = null;

/**
 * 初始化FFmpeg
 */
async function initFFmpeg() {
    try {
        // 动态导入 @ffmpeg-oneclick/bin 获取 FFmpeg 路径
        const bin = await import('@ffmpeg-oneclick/bin');

        // 检查是否已安装 FFmpeg，如果没有则下载
        const isInstalled = bin.isFFmpegInstalled();
        if (!isInstalled) {
            logger.info('FFmpeg 未安装，正在下载...');
            await bin.downloadFFmpeg();
            logger.info('FFmpeg 下载完成');
        }

        // 获取 FFmpeg 和 FFprobe 路径
        const ffmpegBinPath = await bin.getFFmpegPathAsync();
        const ffprobeBinPath = await bin.getFFprobePathAsync();

        logger.info(`FFmpeg 路径: ${ffmpegBinPath}`);
        logger.info(`FFprobe 路径: ${ffprobeBinPath}`);

        // 动态导入 @ffmpeg-oneclick/core
        const core = await import('@ffmpeg-oneclick/core');
        ffmpegCore = core.ffmpeg;
        presets = core.presets;
        MetadataProcessor = core.MetadataProcessor;
        detectBestHardwareAccel = core.detectBestHardwareAccel;
        ConcurrentQueue = core.ConcurrentQueue;
        setFFmpegPath = core.setFFmpegPath;
        setFFprobePath = core.setFFprobePath;

        // 配置 FFmpeg 路径
        if (setFFmpegPath && ffmpegBinPath) {
            setFFmpegPath(ffmpegBinPath);
            logger.info('已配置 FFmpeg 路径');
        }
        if (setFFprobePath && ffprobeBinPath) {
            setFFprobePath(ffprobeBinPath);
            logger.info('已配置 FFprobe 路径');
        }

        logger.info('@ffmpeg-oneclick/core 模块加载成功');

        // 检测硬件加速
        hwAccelInfo = await detectHardwareAcceleration();

        return {
            success: true,
            hwAccelInfo
        };
    } catch (error) {
        logger.error('加载 @ffmpeg-oneclick/core 失败:', error);
        throw error;
    }
}

/**
 * 检测硬件加速
 */
async function detectHardwareAcceleration() {
    try {
        const best = await detectBestHardwareAccel();
        const result = {
            available: best.available,
            type: best.type || 'cpu',
            encoder: best.encoder || 'libx264',
            decoder: best.decoder || '',
            recommended: best.type || 'cpu',
            all: []
        };

        // 获取所有可用的硬件加速类型
        if (best.available) {
            result.all.push(best.type);
        }

        logger.info(`硬件加速检测: ${result.available ? result.type : 'CPU'}`);
        if (result.available) {
            logger.info(`编码器: ${result.encoder}`);
        }

        return result;
    } catch (error) {
        logger.warn('硬件加速检测失败，使用CPU:', error.message);
        return {
            available: false,
            type: 'cpu',
            encoder: 'libx264',
            decoder: '',
            recommended: 'cpu',
            all: []
        };
    }
}

/**
 * 获取硬件加速信息
 * @returns {Object} 硬件加速信息
 */
function getHwAccelInfo() {
    return hwAccelInfo || {
        available: false,
        type: 'cpu',
        encoder: 'libx264',
        decoder: '',
        recommended: 'cpu',
        all: []
    };
}

/**
 * 获取推荐的硬件加速类型
 * @param {string} preferred - 首选类型
 * @returns {string} 硬件加速类型
 */
function getRecommendedHwAccel(preferred = 'auto') {
    const info = getHwAccelInfo();

    if (preferred === 'auto') {
        return info.recommended;
    }

    if (preferred !== 'cpu' && info.all.includes(preferred)) {
        return preferred;
    }

    return info.recommended;
}

/**
 * 获取视频信息
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<Object>} 视频信息
 */
async function getVideoInfo(filePath) {
    try {
        const processor = new MetadataProcessor();
        const metadata = await processor.getMetadata(filePath);

        const result = {
            duration: metadata.format?.duration || 0,
            format: metadata.format?.format_name || '',
            size: metadata.format?.size || 0,
            bitrate: metadata.format?.bit_rate || 0,
            video: null,
            audio: null
        };

        // 获取视频流信息
        const videoStream = await processor.getVideoStream(filePath);
        if (videoStream) {
            result.video = {
                width: videoStream.width,
                height: videoStream.height,
                codec: videoStream.codec_name,
                fps: videoStream.fps || videoStream.r_frame_rate,
                bitrate: videoStream.bit_rate || 0
            };
        }

        // 获取音频流信息
        const audioStream = await processor.getAudioStream(filePath);
        if (audioStream) {
            result.audio = {
                codec: audioStream.codec_name,
                sampleRate: audioStream.sample_rate,
                channels: audioStream.channels,
                bitrate: audioStream.bit_rate || 0
            };
        }

        return result;
    } catch (error) {
        logger.error('获取视频信息失败:', error);
        throw error;
    }
}

/**
 * 位置映射 - 将前端位置转换为库支持的位置
 */
const positionMap = {
    'top-left': 'topLeft',
    'top-right': 'topRight',
    'bottom-left': 'bottomLeft',
    'bottom-right': 'bottomRight',
    'center': 'center'
};

/**
 * 分辨率映射
 */
const resolutionMap = {
    '480p': '854x480',
    '720p': '1280x720',
    '1080p': '1920x1080',
    '2k': '2560x1440',
    '4k': '3840x2160'
};

/**
 * 执行FFmpeg任务
 * @param {string} type - 任务类型
 * @param {Object} options - 配置选项
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 执行结果
 */
async function executeTask(type, options, onProgress) {
    const inputFiles = Array.isArray(options.input) ? options.input : [options.input];
    const outputFile = options.output;
    const hwAccel = getRecommendedHwAccel(options.hardwareAccel);

    let instance = null;
    let result = null;

    try {
        switch (type) {
            case 'convert':
                instance = await buildConvertTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            case 'compress':
                instance = await buildCompressTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            case 'trim':
                instance = await buildTrimTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            case 'concat':
                instance = await buildConcatTask(inputFiles, outputFile, options, hwAccel);
                break;
            case 'gif':
                instance = await buildGifTask(inputFiles[0], outputFile, options);
                break;
            case 'audioExtract':
                instance = await buildAudioExtractTask(inputFiles[0], outputFile, options);
                break;
            case 'audioMix':
                instance = await buildAudioMixTask(inputFiles, outputFile, options, hwAccel);
                break;
            case 'watermark':
                instance = await buildWatermarkTask(inputFiles, outputFile, options, hwAccel);
                break;
            case 'textWatermark':
                instance = await buildTextWatermarkTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            case 'screenshot':
                instance = await buildScreenshotTask(inputFiles[0], outputFile, options);
                break;
            case 'hls':
                instance = await buildHlsTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            case 'dash':
                instance = await buildDashTask(inputFiles[0], outputFile, options, hwAccel);
                break;
            default:
                throw new Error(`未知的任务类型: ${type}`);
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 检查 instance 是否是链式实例（有 .on 和 .run 方法）
        // 还是预设直接返回的结果
        if (instance && typeof instance.on === 'function' && typeof instance.run === 'function') {
            // 链式 API
            if (onProgress) {
                instance.on('progress', (progress) => {
                    onProgress({
                        percent: progress.percent || 0,
                        currentTime: formatTime(progress.time || 0),
                        totalTime: formatTime(progress.duration || 0),
                        speed: progress.fps ? `${progress.fps.toFixed(1)}x` : '0x',
                        eta: progress.eta || 0,
                        frames: progress.frames || 0,
                        bitrate: progress.bitrate || 0
                    });
                });
            }

            // 执行任务
            result = await instance.run();
        } else if (instance && typeof instance.then === 'function') {
            // 预设直接返回 Promise
            result = await instance;
        } else if (instance && typeof instance === 'object') {
            // 预设已经执行完成，返回的是结果对象
            result = instance;
        } else {
            throw new Error('无效的任务实例');
        }

        logger.info(`任务执行完成: ${outputFile}`);

        return {
            success: true,
            output: result?.output || outputFile,
            duration: result?.duration || 0,
            size: result?.size || 0
        };
    } catch (error) {
        logger.error(`任务执行失败 [${type}]:`, error);
        throw error;
    }
}

/**
 * 构建视频转换任务
 */
async function buildConvertTask(inputFile, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFile).output(outputFile);

    // 硬件加速
    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    // 分辨率
    if (options.resolution) {
        const size = resolutionMap[options.resolution.toLowerCase()] || options.resolution;
        instance = instance.size(size);
    }

    // 帧率
    if (options.fps) {
        instance = instance.fps(options.fps);
    }

    // 视频比特率
    if (options.videoBitrate) {
        instance = instance.videoBitrate(options.videoBitrate);
    }

    // 音频比特率
    if (options.audioBitrate) {
        instance = instance.audioBitrate(options.audioBitrate);
    } else {
        instance = instance.audioBitrate('128k');
    }

    // 输出格式
    if (options.format) {
        instance = instance.format(options.format);
    }

    return instance;
}

/**
 * 构建视频压缩任务
 */
async function buildCompressTask(inputFile, outputFile, options, hwAccel) {
    // 使用内置压缩预设
    const quality = options.quality || 'medium';

    if (options.usePreset !== false) {
        // 使用预设压缩
        const instance = await presets.compressVideo(inputFile, outputFile, quality);

        // 额外选项
        if (options.resolution) {
            const size = resolutionMap[options.resolution.toLowerCase()];
            if (size) {
                instance.size(size);
            }
        }

        if (hwAccel !== 'cpu') {
            instance.hardwareAccelerate(hwAccel);
        }

        return instance;
    }

    // 手动压缩配置
    let instance = ffmpegCore(inputFile).output(outputFile);

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    // CRF 值
    const qualityCrf = {
        high: 28,
        medium: 23,
        low: 18
    };
    const crf = options.crf || qualityCrf[quality] || 23;

    // 使用 outputOption 设置 CRF
    instance = instance.outputOption('-crf', crf.toString());
    instance = instance.outputOption('-preset', options.preset || 'medium');

    // 分辨率
    if (options.resolution) {
        const size = resolutionMap[options.resolution.toLowerCase()];
        if (size) {
            instance = instance.size(size);
        }
    }

    // 音频比特率
    instance = instance.audioBitrate(options.audioBitrate || '128k');

    return instance;
}

/**
 * 构建视频裁剪任务
 */
async function buildTrimTask(inputFile, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFile).output(outputFile);

    // 起始时间
    if (options.startTime !== undefined) {
        instance = instance.startTime(options.startTime);
    }

    // 持续时间
    if (options.duration !== undefined) {
        instance = instance.duration(options.duration);
    } else if (options.endTime !== undefined) {
        // 使用 trim 方法
        instance = instance.trim(options.startTime || 0, options.endTime);
    }

    // 快速复制（不重新编码）
    if (options.fastCopy) {
        instance = instance.outputOption('-c', 'copy');
    } else {
        if (hwAccel !== 'cpu') {
            instance = instance.hardwareAccelerate(hwAccel);
        }
    }

    return instance;
}

/**
 * 构建视频拼接任务
 */
async function buildConcatTask(inputFiles, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFiles[0]).output(outputFile);

    // 使用 concat 方法
    instance = instance.concat(inputFiles);

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    // 视频比特率
    if (options.videoBitrate) {
        instance = instance.videoBitrate(options.videoBitrate);
    }

    // 音频比特率
    instance = instance.audioBitrate(options.audioBitrate || '128k');

    return instance;
}

/**
 * 构建GIF生成任务
 */
async function buildGifTask(inputFile, outputFile, options) {
    // 获取视频信息以计算正确的尺寸
    let width = options.width || 480;
    let height = options.height;

    // 如果只指定了宽度，按16:9比例计算高度（确保是偶数）
    if (width && !height) {
        height = Math.round(width * 9 / 16 / 2) * 2; // 确保是偶数
    }

    // 使用预设生成 GIF
    const gifOptions = {
        startTime: options.startTime || 0,
        duration: options.duration || 5,
        fps: options.fps || 15,
        size: `${width}x${height || 270}`
    };

    const instance = await presets.toGif(inputFile, outputFile, gifOptions);

    return instance;
}

/**
 * 构建音频提取任务
 */
async function buildAudioExtractTask(inputFile, outputFile, options) {
    const bitrate = options.bitrate || '192k';
    const format = options.format || 'mp3';

    const instance = await presets.extractAudio(inputFile, outputFile, bitrate);

    // 采样率
    if (options.sampleRate) {
        instance.audioFrequency(options.sampleRate);
    }

    // 声道数
    if (options.channels) {
        instance.audioChannels(options.channels);
    }

    return instance;
}

/**
 * 构建音频混合任务
 */
async function buildAudioMixTask(inputFiles, outputFile, options, hwAccel) {
    const videoFile = inputFiles[0];
    let instance = ffmpegCore(videoFile).output(outputFile);

    // 构建音频混合输入
    const audioInputs = [
        { input: videoFile, volume: 1.0 }
    ];

    // 添加额外的音频文件
    for (let i = 1; i < inputFiles.length; i++) {
        audioInputs.push({
            input: inputFiles[i],
            volume: options.audioVolumes?.[i] || 0.5,
            startTime: options.audioStartTimes?.[i] || 0
        });
    }

    instance = instance.mix(audioInputs, {
        codec: 'aac',
        bitrate: options.audioBitrate || '128k'
    });

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    return instance;
}

/**
 * 构建图片水印任务
 */
async function buildWatermarkTask(inputFiles, outputFile, options, hwAccel) {
    const videoFile = inputFiles[0];
    const watermarkFile = inputFiles[1];

    // 水印位置
    const position = positionMap[options.position] || 'bottomRight';

    // 使用预设添加水印
    const instance = await presets.addWatermark(videoFile, outputFile, watermarkFile, {
        position: position,
        opacity: options.opacity || 0.8,
        scale: parseFloat(options.scale) || 0.2
    });

    if (hwAccel !== 'cpu') {
        instance.hardwareAccelerate(hwAccel);
    }

    return instance;
}

/**
 * 构建文字水印任务
 */
async function buildTextWatermarkTask(inputFile, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFile).output(outputFile);

    // 水印位置
    const position = positionMap[options.position] || 'bottomRight';

    // 构建文字水印配置（使用默认字体以避免乱码问题）
    const watermarkOptions = {
        fontSize: options.fontSize || 24,
        fontColor: options.fontColor || 'white',
        position: position,
        opacity: options.opacity || 0.8,
        borderColor: options.borderColor || 'black',
        borderWidth: options.borderWidth !== undefined ? options.borderWidth : 1,
        shadowColor: options.shadowColor || 'black',
        shadowOffset: options.shadowOffset !== undefined ? options.shadowOffset : 1
    };

    logger.info(`文字水印配置: 字体大小=${watermarkOptions.fontSize}, 颜色=${watermarkOptions.fontColor}, 位置=${position}`);

    instance = instance.textWatermark(options.text || 'Watermark', watermarkOptions);

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    return instance;
}

/**
 * 构建截图任务
 */
async function buildScreenshotTask(inputFile, outputFile, options) {
    if (options.count && options.count > 1) {
        // 批量截图 - 使用 thumbnails
        const instance = ffmpegCore(inputFile).thumbnails({
            count: options.count,
            filenameTemplate: path.basename(outputFile).replace(path.extname(outputFile), '_%d' + path.extname(outputFile)),
            outputDir: path.dirname(outputFile),
            format: path.extname(outputFile).substring(1) || 'jpg',
            width: options.width
        });

        return instance;
    } else {
        // 单张截图
        const time = options.time || 1;
        const instance = ffmpegCore(inputFile).screenshot(time, outputFile);

        // 尺寸
        if (options.width || options.height) {
            instance.videoFilters({
                scale: `${options.width || -1}:${options.height || -1}`
            });
        }

        return instance;
    }
}

/**
 * 构建HLS流媒体任务
 */
async function buildHlsTask(inputFile, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFile);

    // 使用 HLS 方法
    instance = instance.toHLS(outputFile, {
        segmentDuration: options.segmentDuration || 10,
        playlistName: path.basename(outputFile),
        listSize: 0 // 保留所有分片
    });

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    // 视频比特率
    if (options.videoBitrate) {
        instance = instance.videoBitrate(options.videoBitrate);
    } else {
        instance = instance.videoBitrate('2M');
    }

    // 音频比特率
    instance = instance.audioBitrate(options.audioBitrate || '128k');

    return instance;
}

/**
 * 构建DASH流媒体任务
 */
async function buildDashTask(inputFile, outputFile, options, hwAccel) {
    let instance = ffmpegCore(inputFile);

    // 使用 DASH 方法
    instance = instance.toDASH(outputFile, {
        segmentDuration: options.segmentDuration || 10,
        manifestName: path.basename(outputFile)
    });

    if (hwAccel !== 'cpu') {
        instance = instance.hardwareAccelerate(hwAccel);
    }

    // 视频比特率
    if (options.videoBitrate) {
        instance = instance.videoBitrate(options.videoBitrate);
    } else {
        instance = instance.videoBitrate('2M');
    }

    // 音频比特率
    instance = instance.audioBitrate(options.audioBitrate || '128k');

    return instance;
}

/**
 * 格式化时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间字符串
 */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

/**
 * 构建FFmpeg命令参数（兼容旧接口）
 * @param {string} type - 任务类型
 * @param {Object} options - 配置选项
 * @returns {Object} 包含 args 和 hwAccel 的对象
 */
function buildFFmpegArgs(type, options) {
    // 返回标记对象，表示需要使用新接口
    return {
        args: [],
        hwAccel: getRecommendedHwAccel(options.hardwareAccel),
        useNewApi: true
    };
}

/**
 * 执行FFmpeg命令（兼容旧接口）
 * @param {Array} args - 命令参数
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 执行结果
 */
function executeFFmpeg(args, onProgress) {
    // 此方法已废弃，使用 executeTask 替代
    logger.warn('executeFFmpeg 方法已废弃，请使用 executeTask');
    return Promise.reject(new Error('请使用 executeTask 方法'));
}

// 导出模块
module.exports = {
    initFFmpeg,
    getHwAccelInfo,
    getRecommendedHwAccel,
    getVideoInfo,
    executeTask,
    buildFFmpegArgs,
    executeFFmpeg,
    // 兼容旧接口
    getFFmpegPath: () => '@ffmpeg-oneclick/core',
    getFFprobePath: () => 'ffprobe'
};
