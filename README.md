# FFmpeg Studio

<div align="center">

![FFmpeg Studio](https://img.shields.io/badge/FFmpeg-Studio-blue?style=for-the-badge&logo=ffmpeg)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen?style=flat-square)

**基于 Web 的音视频处理平台**

[在线演示](#) | [快速开始](#快速开始) | [功能特性](#功能特性) | [文档](#api-文档)

</div>

---

## 📖 项目简介

FFmpeg Studio 是一个基于 FFmpeg 的现代化 Web 平台，提供友好的用户界面来处理音视频文件。无需命令行操作，通过浏览器即可完成复杂的音视频处理任务。

### 核心依赖

- **FFmpeg 引擎**: [@ffmpeg-oneclick/core](https://github.com/wangshengithub/ffmpeg-oneclick)
- **FFmpeg 二进制**: [@ffmpeg-oneclick/bin](https://github.com/wangshengithub/ffmpeg-oneclick)

## ✨ 功能特性

### 🎬 视频处理

- 🎥 **视频转换** - 支持多种视频格式转换（MP4, WebM, AVI, MKV等）
- 📦 **视频压缩** - 智能压缩，保持画质，支持多种压缩质量
- ✂️ **视频裁剪** - 精确裁剪视频片段，支持快速无重编码模式
- 🔗 **视频拼接** - 多视频文件合并，支持不同分辨率
- 📺 **流媒体输出** - HLS/DASH 流媒体格式输出

### 🎵 音频处理

- 🎵 **音频提取** - 从视频提取音频（MP3, AAC, WAV, FLAC等）
- 🎶 **音频混合** - 多音轨混合，支持音量调节
- 🔊 **音量调整** - 精确控制音频音量

### 🎨 特效与水印

- 💧 **图片水印** - 添加图片水印，支持位置、透明度调整
- 📝 **文字水印** - 添加文字水印，支持字体、颜色、描边、阴影
- 🎞️ **GIF制作** - 视频转GIF动图，支持尺寸、帧率调整
- 📸 **截图提取** - 视频截图，支持批量截图

### 🔧 高级功能

- ⚡ **硬件加速** - 自动检测并使用 NVENC/QSV/VCE/VideoToolbox
- 📋 **预设模板** - 内置常用预设，支持自定义预设
- 👥 **用户管理** - 用户注册、审核、权限管理
- 🔄 **实时进度** - WebSocket 实时显示处理进度
- 📊 **任务队列** - 支持多任务并发处理

## 🛠️ 技术栈

### 前端

- **原生技术**: HTML5 + CSS3 + JavaScript (ES6+)
- **实时通信**: WebSocket
- **UI组件**: 自定义响应式组件库

### 后端

- **运行时**: Node.js >= 14.0.0
- **框架**: Express.js
- **认证**: JWT + bcryptjs
- **文件上传**: Multer
- **实时通信**: ws (WebSocket)

### 核心

- **FFmpeg**: 音视频处理引擎
- **数据存储**: JSON 文件系统

## 🚀 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm 或 yarn

### 安装

```bash
# 克隆仓库
git clone https://github.com/wangshengithub/ffmpeg-studio.git

# 进入目录
cd ffmpeg-studio

# 安装依赖
npm install

# 启动服务器
npm start
```

服务器将在 http://localhost:3000 启动。

### CLI 工具

```bash
# 查看帮助
node bin/cli.js --help

# 创建管理员
node bin/cli.js user create --admin

# 查看配置
node bin/cli.js config list

# 检测硬件加速
node bin/cli.js hardware
```

## 📦 默认账户

首次启动时会自动创建默认管理员账户：

- **用户名**: `admin`
- **密码**: `admin123`

⚠️ **请登录后立即修改密码！**

## 📁 目录结构

```
ffmpeg-studio/
├── package.json              # 项目配置
├── README.md                 # 项目文档
├── LICENSE                   # 许可证
├── bin/                      # CLI工具
│   └── cli.js
├── src/                      # 源代码
│   ├── server.js            # 服务器入口
│   ├── index.js             # 启动脚本
│   ├── config/              # 配置管理
│   ├── routes/              # API路由
│   │   ├── auth.js         # 认证路由
│   │   ├── task.js         # 任务路由
│   │   ├── preset.js       # 预设路由
│   │   ├── admin.js        # 管理路由
│   │   └── upload.js       # 上传路由
│   ├── services/            # 业务逻辑
│   │   ├── userService.js  # 用户服务
│   │   ├── taskService.js  # 任务服务
│   │   ├── presetService.js# 预设服务
│   │   ├── ffmpegService.js# FFmpeg服务
│   │   └── queueService.js # 队列服务
│   ├── middleware/          # 中间件
│   │   ├── auth.js         # 认证中间件
│   │   └── errorHandler.js # 错误处理
│   └── utils/               # 工具函数
│       ├── logger.js       # 日志工具
│       └── validator.js    # 验证工具
├── public/                  # 静态文件
│   ├── index.html          # 首页
│   ├── login.html          # 登录页
│   ├── dashboard.html      # 工作台
│   ├── admin.html          # 管理面板
│   ├── preset-market.html  # 预设市场
│   ├── css/                # 样式文件
│   │   └── style.css
│   └── js/                 # 脚本文件
│       ├── api.js          # API封装
│       ├── app.js          # 主应用
│       ├── admin.js        # 管理面板
│       └── websocket.js    # WebSocket客户端
├── data/                    # 数据存储
│   ├── users.json          # 用户数据
│   ├── tasks.json          # 任务数据
│   ├── presets.json        # 预设数据
│   ├── config.json         # 系统配置
│   └── queue_state.json    # 队列状态
├── temp/                    # 临时文件
│   ├── uploads/            # 上传目录
│   └── outputs/            # 输出目录
└── logs/                    # 日志文件
    └── app.log
```

## 📚 API 文档

### 认证接口

| 方法   | 路径                 | 说明     |
| ---- | ------------------ | ------ |
| POST | /api/auth/register | 用户注册   |
| POST | /api/auth/login    | 用户登录   |
| POST | /api/auth/logout   | 用户登出   |
| GET  | /api/auth/me       | 获取当前用户 |
| PUT  | /api/auth/password | 修改密码   |

### 任务接口

| 方法     | 路径                       | 说明     |
| ------ | ------------------------ | ------ |
| POST   | /api/tasks               | 创建任务   |
| GET    | /api/tasks               | 获取任务列表 |
| GET    | /api/tasks/:id           | 获取任务详情 |
| POST   | /api/tasks/:id/cancel    | 取消任务   |
| DELETE | /api/tasks/:id           | 删除任务   |
| GET    | /api/tasks/:id/download  | 下载输出文件 |
| GET    | /api/tasks/stats/summary | 获取任务统计 |

### 预设接口

| 方法     | 路径                   | 说明     |
| ------ | -------------------- | ------ |
| GET    | /api/presets         | 获取预设列表 |
| GET    | /api/presets/builtin | 获取内置预设 |
| GET    | /api/presets/market  | 获取预设市场 |
| POST   | /api/presets         | 创建预设   |
| PUT    | /api/presets/:id     | 更新预设   |
| DELETE | /api/presets/:id     | 删除预设   |

### 上传接口

| 方法     | 路径                    | 说明     |
| ------ | --------------------- | ------ |
| POST   | /api/upload           | 上传单个文件 |
| POST   | /api/upload/multiple  | 上传多个文件 |
| DELETE | /api/upload/:filename | 删除文件   |
| GET    | /api/upload/info      | 获取上传配置 |

### 管理员接口

| 方法     | 路径                           | 说明     |
| ------ | ---------------------------- | ------ |
| GET    | /api/admin/users             | 获取用户列表 |
| POST   | /api/admin/users             | 创建用户   |
| PUT    | /api/admin/users/:id/approve | 审核通过   |
| PUT    | /api/admin/users/:id/reject  | 审核拒绝   |
| PUT    | /api/admin/users/:id/disable | 禁用用户   |
| PUT    | /api/admin/users/:id/enable  | 启用用户   |
| DELETE | /api/admin/users/:id         | 删除用户   |
| POST   | /api/admin/users/import      | 批量导入用户 |
| GET    | /api/admin/stats             | 获取系统统计 |
| GET    | /api/admin/queue             | 获取队列状态 |

## 👥 用户管理

### 用户注册流程

1. 用户在前台注册
2. 状态为 `pending`（待审核）
3. 管理员审核通过后状态变为 `approved`
4. 用户可以正常登录使用

### 用户状态

- `pending` - 待审核
- `approved` - 已通过
- `rejected` - 已拒绝
- `disabled` - 已禁用

### 用户角色

- `user` - 普通用户
- `admin` - 管理员

## ⚡ 硬件加速

系统自动检测以下硬件加速：

1. **NVIDIA NVENC** - NVIDIA GPU 硬件编码
2. **Intel QSV** - Intel Quick Sync Video
3. **AMD VCE** - AMD Video Coding Engine
4. **Apple VideoToolbox** - macOS 硬件加速
5. **CPU** - 后备方案

## 🔒 安全特性

- ✅ JWT Token 认证
- ✅ bcryptjs 密码加密
- ✅ WebSocket 认证
- ✅ 文件上传安全检查
- ✅ 路径安全验证
- ✅ XSS 防护
- ✅ CSRF 保护

## 📊 队列管理

- ✅ 任务队列持久化
- ✅ 服务重启恢复
- ✅ 并发任务控制
- ✅ 实时进度推送
- ✅ 自动重试机制

## 🤝 贡献指南

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 JavaScript Standard Style
- 编写清晰的注释
- 更新相关文档

## 📝 更新日志

### v1.0.0 (2026-03-16)

#### 新功能

- ✨ 完整的音视频处理功能
- ✨ 用户认证与管理系统
- ✨ 预设模板系统
- ✨ WebSocket 实时通信
- ✨ 任务队列管理
- ✨ 硬件加速支持

#### 安全性

- 🔒 JWT Token 认证
- 🔒 WebSocket 认证
- 🔒 密码加密存储
- 🔒 文件上传安全验证
- 🔒 无效令牌自动登出

#### 性能优化

- ⚡ 队列持久化与恢复
- ⚡ 文件自动清理
- ⚡ HLS/DASH 分片清理

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

```
MIT License

Copyright (c) 2026 wangshengithub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🔗 相关链接

- **项目主页**: [https://github.com/wangshengithub/ffmpeg-studio](https://github.com/wangshengithub/ffmpeg-studio)
- **FFmpeg 库**: [https://github.com/wangshengithub/ffmpeg-oneclick](https://github.com/wangshengithub/ffmpeg-oneclick)
- **问题反馈**: [Issues](https://github.com/wangshengithub/ffmpeg-studio/issues)
- **功能请求**: [Feature Request](https://github.com/wangshengithub/ffmpeg-studio/issues/new)

## 💬 联系方式

- **作者**: wangshengithub
- **GitHub**: [@wangshengithub](https://github.com/wangshengithub)

## 🙏 致谢

感谢以下开源项目：

- [FFmpeg](https://ffmpeg.org/) - 强大的音视频处理框架
- [Express.js](https://expressjs.com/) - Node.js Web 框架
- [Node.js](https://nodejs.org/) - JavaScript 运行时

---

<div align="center">

**如果这个项目对您有帮助，请给一个 ⭐️ Star！**

Made with ❤️ by wangshengithub

</div>
