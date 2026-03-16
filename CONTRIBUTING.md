# 贡献指南

感谢您有兴趣为 FFmpeg Studio 做出贡献！

## 🌟 如何贡献

### 报告 Bug

如果您发现了 bug，请通过 [GitHub Issues](https://github.com/wangshengithub/ffmpeg-studio/issues) 提交报告。

在提交 bug 报告时，请包含：

1. **清晰的标题和描述**
2. **复现步骤** - 详细说明如何复现问题
3. **预期行为** - 您期望发生什么
4. **实际行为** - 实际发生了什么
5. **环境信息**:
   - 操作系统（Windows/Linux/macOS）
   - Node.js 版本
   - FFmpeg Studio 版本
6. **日志输出** - 如果有相关的错误日志
7. **截图** - 如果适用

### 提出新功能

我们很乐意听取您的新功能建议！请通过 [GitHub Issues](https://github.com/wangshengithub/ffmpeg-studio/issues) 提交功能请求。

请包含：

1. **功能描述** - 详细说明您希望的功能
2. **使用场景** - 为什么需要这个功能
3. **可能的实现** - 如果您有想法的话

### 提交代码

#### 开发环境设置

```bash
# 1. Fork 仓库到您的 GitHub 账号

# 2. Clone 您的 fork
git clone https://github.com/YOUR_USERNAME/ffmpeg-studio.git

# 3. 进入项目目录
cd ffmpeg-studio

# 4. 安装依赖
npm install

# 5. 创建特性分支
git checkout -b feature/AmazingFeature

# 6. 启动开发服务器
npm run dev
```

#### 代码规范

- **JavaScript**: 遵循 JavaScript Standard Style
- **命名**: 使用有意义的变量和函数名
- **注释**: 为复杂逻辑添加清晰的注释
- **文档**: 更新相关文档

#### 提交规范

使用清晰的提交信息：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）:

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

示例：

```
feat(video): 添加视频裁剪功能

- 支持精确到帧的裁剪
- 支持快速无重编码模式
- 添加裁剪预览

Closes #123
```

#### Pull Request 流程

1. **确保代码质量**
   
   - 代码能正常运行
   - 没有明显的 bug
   - 遵循项目代码规范

2. **测试您的更改**
   
   - 手动测试相关功能
   - 测试边界情况
   - 确保没有破坏现有功能

3. **更新文档**
   
   - 更新 README.md（如果需要）
   - 更新 API 文档（如果需要）
   - 添加必要的注释

4. **提交 Pull Request**
   
   - 清晰描述您的更改
   - 引用相关的 issue
   - 等待代码审查

### 代码审查

所有 PR 都需要经过代码审查。我们会：

- 检查代码质量
- 测试功能
- 提出改进建议
- 最终合并或请求修改

## 📋 开发指南

### 项目结构

```
ffmpeg-studio/
├── src/                # 源代码
│   ├── server.js       # 服务器入口
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   ├── middleware/     # 中间件
│   └── utils/          # 工具函数
├── public/             # 前端文件
│   ├── css/            # 样式文件
│   ├── js/             # JavaScript 文件
│   └── *.html          # HTML 页面
├── data/               # 数据存储
├── temp/               # 临时文件
└── logs/               # 日志文件
```

### API 端点

主要的 API 端点：

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `GET /api/presets` - 获取预设列表

详细 API 文档请查看 README.md。

### 添加新功能

1. **后端**:
   
   - 在 `src/services/` 添加业务逻辑
   - 在 `src/routes/` 添加路由
   - 更新必要的中间件

2. **前端**:
   
   - 在 `public/js/api.js` 添加 API 调用
   - 在 `public/js/app.js` 添加 UI 逻辑
   - 在 `public/css/style.css` 添加样式

### 调试

启用调试模式：

```bash
# 启动开发服务器（带热重载）
npm run dev

# 查看日志
tail -f logs/combined.log
```

## 🤝 行为准则

- 尊重所有贡献者
- 保持建设性的讨论
- 欢迎不同的观点
- 专注于对项目最有利的事情

## 📞 需要帮助？

如果您在贡献过程中遇到任何问题，可以：

- 在 [Issues](https://github.com/wangshengithub/ffmpeg-studio/issues) 提问
- 查看 [Wiki](https://github.com/wangshengithub/ffmpeg-studio/wiki)
- 联系维护者

---

再次感谢您的贡献！🎉
