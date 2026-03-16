/**
 * FFmpeg Studio 启动入口
 * 设置环境变量后启动主服务
 */

// 禁用SSL验证（用于下载FFmpeg二进制文件）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 启动主服务
require('./server.js');
