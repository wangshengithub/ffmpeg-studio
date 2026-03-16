/**
 * FFmpeg Studio - 主应用逻辑
 */

// 任务类型的文件需求配置
const TASK_FILE_REQUIREMENTS = {
    convert: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    compress: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    trim: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    concat: { count: -1, types: ['video'], description: '需要2个或更多视频文件（按顺序拼接）', minCount: 2, slots: [{ name: '视频文件', type: 'video', multiple: true }] },
    gif: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    audioExtract: { count: 1, types: ['video', 'audio'], description: '需要1个视频或音频文件', slots: [{ name: '媒体文件', type: 'video,audio' }] },
    audioMix: { count: 2, types: ['video', 'audio'], description: '需要1个视频文件 + 1个音频文件', slots: [{ name: '视频文件', type: 'video' }, { name: '音频文件', type: 'audio' }] },
    watermark: { count: 2, types: ['video', 'image'], description: '需要1个视频文件 + 1个图片水印', slots: [{ name: '视频文件', type: 'video' }, { name: '水印图片', type: 'image' }] },
    textWatermark: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    screenshot: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    hls: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] },
    dash: { count: 1, types: ['video'], description: '需要1个视频文件', slots: [{ name: '视频文件', type: 'video' }] }
};

// 全局状态
const AppState = {
    user: null,
    uploadedFiles: [],  // 改为数组支持多文件
    selectedTaskType: 'convert',
    selectedPreset: null,
    tasks: [],
    presets: []
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 检查登录状态
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        AppState.user = JSON.parse(userStr);
        updateUserInfo();
    }

    // 根据页面初始化
    const path = window.location.pathname;

    if (path === '/dashboard') {
        await initDashboard();
    } else if (path === '/admin') {
        await initAdmin();
    }

    // 绑定通用事件
    bindCommonEvents();
});

// ==================== 通用功能 ====================

function bindCommonEvents() {
    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await API.auth.logout();
            } catch (e) {
                // 忽略错误
            }
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
    }

    // 修改密码按钮
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            openModal('changePasswordModal');
        });
    }

    // 提交修改密码
    const submitChangePasswordBtn = document.getElementById('submitChangePasswordBtn');
    if (submitChangePasswordBtn) {
        submitChangePasswordBtn.addEventListener('click', handleChangePassword);
    }

    // 预设模板按钮
    const navPresets = document.getElementById('navPresets');
    if (navPresets) {
        navPresets.addEventListener('click', async (e) => {
            e.preventDefault();
            await openPresetModal();
        });
    }

    // 模态框关闭按钮
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // 点击背景关闭模态框
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// 修改密码处理
async function handleChangePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证输入
    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification('请填写所有字段', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('两次输入的新密码不一致', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showNotification('新密码长度至少为6位', 'error');
        return;
    }

    try {
        const result = await API.auth.changePassword(oldPassword, newPassword);

        if (result.success) {
            showNotification('密码修改成功，请重新登录', 'success');
            closeAllModals();

            // 清除表单
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            // 延迟跳转，让用户看到提示
            setTimeout(() => {
                // 退出登录
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }, 1500);
        }
    } catch (error) {
        showNotification(error.message || '密码修改失败', 'error');
    }
}

// 预设模态框
async function openPresetModal() {
    const modal = document.getElementById('presetModal');
    if (!modal) return;

    openModal('presetModal');
    await loadPresetList('builtin');
}

// 预设市场跳转
document.addEventListener('click', (e) => {
    if (e.target.id === 'navPresets' || e.target.closest('#navPresets')) {
        e.preventDefault();
        window.location.href = '/presets';
    }
});

async function loadPresetList(tab) {
    const container = document.getElementById('presetList');
    if (!container) return;

    // 如果点击预设市场标签，跳转到预设市场页面
    if (tab === 'market') {
        window.location.href = '/presets';
        return;
    }

    container.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let presets = [];

        if (tab === 'builtin') {
            const result = await API.presets.builtin();
            if (result.success) {
                presets = result.presets;
            }
        } else if (tab === 'my') {
            const result = await API.presets.list();
            if (result.success) {
                presets = result.presets.filter(p => !p.isBuiltin);
            }
        }

        if (presets.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无预设</p></div>';
            return;
        }

        container.innerHTML = presets.map(preset => `
            <div class="preset-item" data-preset-id="${preset.id}">
                <div class="preset-info">
                    <strong>${preset.name}</strong>
                    <small>${preset.description || getTaskTypeName(preset.type)}</small>
                </div>
                <div class="preset-actions">
                    <button class="btn btn-sm btn-primary use-preset-btn" data-preset-id="${preset.id}">使用</button>
                </div>
            </div>
        `).join('');

        // 绑定使用按钮事件
        container.querySelectorAll('.use-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetId = btn.dataset.presetId;
                usePreset(presetId);
                closeAllModals();
            });
        });
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
        console.error('加载预设失败:', error);
    }
}

function usePreset(presetId) {
    const select = document.getElementById('presetSelect');
    if (select) {
        select.value = presetId;
        AppState.selectedPreset = presetId;
        updateConfigPanel();
    }
    showNotification('已选择预设', 'success');
}

// 预设标签切换
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('preset-tab')) {
        const tabs = document.querySelectorAll('.preset-tab');
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        const tab = e.target.dataset.tab;
        loadPresetList(tab);
    }
});

function updateUserInfo() {
    const userInfoEl = document.getElementById('userInfo');
    const adminInfoEl = document.getElementById('adminInfo');

    if (userInfoEl && AppState.user) {
        userInfoEl.textContent = AppState.user.username;
    }

    if (adminInfoEl && AppState.user) {
        adminInfoEl.textContent = AppState.user.username;
    }
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
    `;

    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // 关闭按钮
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });

    // 自动关闭
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// 自定义确认框
function showConfirm(message, title = '确认') {
    return new Promise((resolve) => {
        // 先移除之前可能存在的确认框
        const existingOverlay = document.querySelector('.confirm-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // 创建确认框
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.cssText = `
            background: var(--bg-secondary, #1e1e1e);
            border-radius: 12px;
            padding: 24px;
            min-width: 320px;
            max-width: 480px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            animation: scaleIn 0.2s ease;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary, #fff); font-size: 18px;">${title}</h3>
            <p style="margin: 0 0 24px 0; color: var(--text-secondary, #a0a0a0); line-height: 1.6;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-outline confirm-cancel" style="padding: 8px 20px; border-radius: 6px; border: 1px solid var(--border-color, #333); background: transparent; color: var(--text-primary, #fff); cursor: pointer;">取消</button>
                <button class="btn btn-primary confirm-ok" autofocus style="padding: 8px 20px; border-radius: 6px; border: none; background: var(--primary-color, #667eea); color: white; cursor: pointer;">确定</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 关闭函数
        const close = (result) => {
            document.removeEventListener('keydown', handleKeydown, true);
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        // 绑定事件（阻止冒泡）
        dialog.querySelector('.confirm-cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            close(false);
        });

        dialog.querySelector('.confirm-ok').addEventListener('click', (e) => {
            e.stopPropagation();
            close(true);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });

        // 键盘事件处理（捕获阶段，优先级最高）
        const handleKeydown = (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (e.key === 'Enter') {
                close(true);
            } else if (e.key === 'Escape') {
                close(false);
            }
        };

        document.addEventListener('keydown', handleKeydown, true);

        // 自动聚焦到确认按钮
        const confirmBtn = dialog.querySelector('.confirm-ok');
        setTimeout(() => confirmBtn.focus(), 50);
    });
}

// ==================== 工作台功能 ====================

async function initDashboard() {
    if (!AppState.user) {
        window.location.href = '/login';
        return;
    }

    // 显示管理员链接（仅管理员可见）
    const adminLink = document.getElementById('adminLink');
    if (adminLink && AppState.user.role === 'admin') {
        adminLink.style.display = 'inline';
    }

    // 初始化文件上传
    initFileUpload();

    // 加载预设
    await loadPresets();

    // 加载任务列表
    await loadTasks();

    // 初始化任务类型选择
    initTaskTypeSelector();

    // 初始化WebSocket事件
    initWebSocketEvents();

    // 更新配置面板
    updateConfigPanel();

    // 检查 URL 参数，自动应用预设
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('preset');
    if (presetId) {
        await applyPresetFromUrl(presetId);
    }
}

// 从 URL 参数应用预设
async function applyPresetFromUrl(presetId) {
    try {
        // 从预设列表中查找
        const preset = AppState.presets.find(p => p.id === presetId);

        if (!preset) {
            console.warn('未找到预设:', presetId);
            return;
        }

        console.log('自动应用预设:', preset.name);

        // 切换到对应的任务类型
        const taskTypeBtn = document.querySelector(`.task-type-btn[data-type="${preset.type}"]`);
        if (taskTypeBtn) {
            // 移除所有按钮的 active 状态
            document.querySelectorAll('.task-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // 激活对应的任务类型按钮
            taskTypeBtn.classList.add('active');
            AppState.selectedTaskType = preset.type;
            // 切换任务类型时清空已上传的文件
            AppState.uploadedFiles = [];
            updateFileDisplay();
            updateConfigPanel();
        }

        // 设置预设选择框的值
        const presetSelect = document.getElementById('presetSelect');
        if (presetSelect) {
            presetSelect.value = presetId;
            AppState.selectedPreset = presetId;
            updateConfigPanel();
        }

        // 清除 URL 参数，避免刷新时重复应用
        window.history.replaceState({}, document.title, window.location.pathname);

        // 显示简单提示
        showNotification(`已应用预设: ${preset.name}`, 'success');
    } catch (error) {
        console.error('应用预设失败:', error);
    }
}

// 显示通知提示
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    // 添加到页面
    document.body.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 文件上传
function initFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');

    if (!uploadArea || !fileInput) return;

    // 显示当前任务类型的文件需求
    updateFileRequirement();

    // 点击选择文件
    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // 支持多文件拖拽
            for (const file of files) {
                await handleFileUpload(file);
            }
        }
    });

    // 文件选择
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            // 支持多文件选择
            for (const file of e.target.files) {
                await handleFileUpload(file);
            }
            // 清空 input 以便再次选择相同文件
            fileInput.value = '';
        }
    });
}

// 显示文件需求提示
function updateFileRequirement() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;

    const requirement = TASK_FILE_REQUIREMENTS[AppState.selectedTaskType];
    if (requirement) {
        const existingTip = uploadArea.querySelector('.file-requirement-tip');
        if (existingTip) {
            existingTip.remove();
        }

        const tip = document.createElement('p');
        tip.className = 'file-requirement-tip';
        tip.style.cssText = 'color: #667eea; font-size: 13px; margin-top: 8px;';
        tip.textContent = `📌 ${requirement.description}`;
        uploadArea.appendChild(tip);
    }
}

async function handleFileUpload(file) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // 检查文件数量限制
    const requirement = TASK_FILE_REQUIREMENTS[AppState.selectedTaskType];
    if (requirement && requirement.count > 0 && AppState.uploadedFiles.length >= requirement.count) {
        showNotification(`该任务类型最多只能上传 ${requirement.count} 个文件`, 'warning');
        return;
    }

    // 显示进度条
    if (uploadProgress) {
        uploadProgress.style.display = 'flex';
    }
    if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.style.transition = 'none'; // 移除transition确保实时更新
    }
    if (progressText) {
        progressText.textContent = '0%';
    }

    console.log('开始上传文件:', file.name);

    try {
        const result = await API.upload.single(file, (progress) => {
            console.log('上传进度回调:', progress + '%');

            // 直接更新进度条和文本
            if (progressFill) {
                progressFill.style.width = progress + '%';
            }
            if (progressText) {
                progressText.textContent = progress + '%';
            }
        });

        console.log('上传结果:', result);

        if (result.success) {
            // 添加到文件列表
            AppState.uploadedFiles.push(result.file);

            // 确保显示100%
            if (progressFill) {
                progressFill.style.width = '100%';
            }
            if (progressText) {
                progressText.textContent = '100%';
            }

            // 延迟隐藏进度条，让用户看到100%
            setTimeout(() => {
                if (uploadProgress) uploadProgress.style.display = 'none';
            }, 500);

            updateFileDisplay();
            updateStartButton();
            showNotification(`上传成功！(${AppState.uploadedFiles.length} 个文件)`, 'success');
        } else {
            showNotification('上传失败: ' + result.message, 'error');
            if (uploadProgress) uploadProgress.style.display = 'none';
        }
    } catch (error) {
        console.error('上传错误:', error);
        showNotification('上传失败: ' + error.message, 'error');
        if (uploadProgress) uploadProgress.style.display = 'none';
    }
}

function updateFileDisplay() {
    const fileInfo = document.getElementById('fileInfo');
    const uploadArea = document.getElementById('uploadArea');
    const requirement = TASK_FILE_REQUIREMENTS[AppState.selectedTaskType];

    if (AppState.uploadedFiles.length > 0) {
        uploadArea.style.display = 'block';
        fileInfo.style.display = 'block';

        // 检查是否需要槽位选择
        const needsSlotSelection = requirement && requirement.slots && requirement.slots.length > 1;

        // 生成文件列表 HTML
        let html = '';

        // 如果需要槽位选择，先显示槽位列表
        if (needsSlotSelection) {
            html += '<div class="file-slots-info">';
            requirement.slots.forEach((slot, idx) => {
                const assignedFile = AppState.uploadedFiles.find(f => f.slot === idx);
                html += `
                    <div class="file-slot ${assignedFile ? 'filled' : ''}">
                        <span class="slot-icon">${getSlotIcon(slot.type)}</span>
                        <span class="slot-name">${slot.name}</span>
                        <span class="slot-status">${assignedFile ? `✓ ${assignedFile.name}` : '未选择'}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // 显示已上传的文件
        html += '<div class="uploaded-files-list">';
        AppState.uploadedFiles.forEach((file, index) => {
            html += `
                <div class="file-preview" data-index="${index}">
                    <span class="file-icon">📄</span>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${formatBytes(file.size)}</span>
                    </div>
                    ${needsSlotSelection ? `
                        <select class="file-slot-select" data-index="${index}">
                            <option value="">选择用途</option>
                            ${requirement.slots.map((slot, idx) => {
                                const typeMatch = isFileTypeMatch(file, slot.type);
                                return `<option value="${idx}" ${file.slot === idx ? 'selected' : ''} ${!typeMatch ? 'disabled' : ''}>
                                    ${slot.name}${!typeMatch ? ' (类型不匹配)' : ''}
                                </option>`;
                            }).join('')}
                        </select>
                    ` : ''}
                    <button class="btn btn-sm btn-danger remove-file-btn" data-index="${index}">移除</button>
                </div>
            `;
        });
        html += '</div>';

        fileInfo.innerHTML = html;

        // 绑定移除按钮事件
        fileInfo.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const index = parseInt(e.target.dataset.index);
                const file = AppState.uploadedFiles[index];

                // 调用后端API删除文件
                try {
                    await API.upload.delete(file.path);
                    console.log('文件已从服务器删除:', file.name);
                } catch (error) {
                    console.error('删除文件失败:', error);
                    // 即使删除失败，也从列表中移除
                }

                // 从列表中移除
                AppState.uploadedFiles.splice(index, 1);
                updateFileDisplay();
                updateStartButton();
            });
        });

        // 绑定槽位选择事件
        fileInfo.querySelectorAll('.file-slot-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const slotIndex = e.target.value === '' ? null : parseInt(e.target.value);

                // 清除其他文件的相同槽位
                if (slotIndex !== null) {
                    AppState.uploadedFiles.forEach((f, i) => {
                        if (i !== index && f.slot === slotIndex) {
                            f.slot = null;
                        }
                    });
                }

                AppState.uploadedFiles[index].slot = slotIndex;
                updateFileDisplay();
                updateStartButton();
            });
        });

        // 更新上传区域的提示文字
        const uploadText = uploadArea.querySelector('.upload-text');
        if (uploadText) {
            if (needsSlotSelection) {
                const filledSlots = AppState.uploadedFiles.filter(f => f.slot !== null && f.slot !== undefined).length;
                uploadText.textContent = `已上传 ${AppState.uploadedFiles.length} 个文件，已分配 ${filledSlots}/${requirement.slots.length} 个槽位`;
            } else if (requirement) {
                const remaining = requirement.count > 0 ? requirement.count - AppState.uploadedFiles.length : '无限制';
                uploadText.textContent = `已上传 ${AppState.uploadedFiles.length} 个文件，还可上传 ${remaining} 个`;
            }
        }
    } else {
        uploadArea.style.display = 'block';
        fileInfo.style.display = 'none';

        // 恢复原始提示文字
        const uploadText = uploadArea.querySelector('.upload-text');
        if (uploadText) {
            uploadText.textContent = '拖拽文件到此处，或点击选择文件';
        }
    }
}

// 获取槽位图标
function getSlotIcon(type) {
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('image')) return '🖼️';
    return '📄';
}

// 检查文件类型是否匹配
function isFileTypeMatch(file, allowedTypes) {
    const mimeType = (file.mimeType || '').toLowerCase();
    const types = allowedTypes.split(',');

    for (const type of types) {
        const trimmedType = type.trim();
        if (trimmedType === 'video' && mimeType.startsWith('video/')) return true;
        if (trimmedType === 'audio' && mimeType.startsWith('audio/')) return true;
        if (trimmedType === 'image' && mimeType.startsWith('image/')) return true;
    }
    return false;
}

// 预设加载
async function loadPresets() {
    try {
        const result = await API.presets.list();
        if (result.success) {
            AppState.presets = result.presets;
            updatePresetSelect();
        }
    } catch (error) {
        console.error('加载预设失败:', error);
    }
}

function updatePresetSelect() {
    const select = document.getElementById('presetSelect');
    if (!select) return;

    select.innerHTML = '<option value="">不使用预设</option>';

    AppState.presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = `${preset.name} (${preset.type})`;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        AppState.selectedPreset = e.target.value || null;
        updateConfigPanel();
    });
}

// 任务类型选择
function initTaskTypeSelector() {
    const buttons = document.querySelectorAll('.task-type-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.selectedTaskType = btn.dataset.type;
            // 切换任务类型时清空已上传的文件
            AppState.uploadedFiles = [];
            updateFileDisplay();
            updateFileRequirement();
            updateStartButton();
            updateConfigPanel();
        });
    });
}

// 配置面板
function updateConfigPanel() {
    const panel = document.getElementById('configPanel');
    if (!panel) return;

    const configs = {
        convert: `
            <div class="task-description">
                <p>📋 <strong>视频转换</strong>：将视频转换为不同格式，支持调整分辨率和码率。</p>
                <p class="task-tip">💡 建议使用 MP4 格式以获得最佳兼容性。</p>
            </div>
            <div class="form-group">
                <label>输出格式</label>
                <select name="format" class="form-control">
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                    <option value="avi">AVI</option>
                    <option value="mkv">MKV</option>
                </select>
            </div>
            <div class="form-group">
                <label>分辨率</label>
                <select name="resolution" class="form-control">
                    <option value="">保持原始</option>
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                </select>
            </div>
            <div class="form-group">
                <label>视频码率</label>
                <input type="text" name="videoBitrate" class="form-control" placeholder="如: 2M, 4M">
            </div>
        `,
        compress: `
            <div class="task-description">
                <p>📋 <strong>视频压缩</strong>：减小视频文件大小，同时尽量保持画质。</p>
                <p class="task-tip">💡 高压缩会显著减小文件，但可能损失画质。建议选择"平衡"模式。</p>
            </div>
            <div class="form-group">
                <label>压缩质量</label>
                <select name="quality" class="form-control">
                    <option value="high">高压缩（文件更小）</option>
                    <option value="medium" selected>平衡</option>
                    <option value="low">高质量（文件较大）</option>
                </select>
            </div>
            <div class="form-group">
                <label>分辨率</label>
                <select name="resolution" class="form-control">
                    <option value="">保持原始</option>
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                </select>
            </div>
        `,
        trim: `
            <div class="task-description">
                <p>📋 <strong>视频裁剪</strong>：截取视频的指定片段。</p>
                <p class="task-tip">💡 时间格式支持"秒数"或"时:分:秒"（如 90 或 00:01:30）。</p>
            </div>
            <div class="form-group">
                <label>开始时间</label>
                <input type="text" name="startTime" class="form-control" placeholder="00:00:00">
            </div>
            <div class="form-group">
                <label>结束时间或时长</label>
                <input type="text" name="duration" class="form-control" placeholder="时长（秒）或 00:01:30">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="fastCopy"> 快速裁剪（无重编码）
                </label>
                <p class="form-hint">勾选后处理更快，但只能精确到关键帧</p>
            </div>
        `,
        concat: `
            <div class="task-description">
                <p>📋 <strong>视频拼接</strong>：将多个视频文件合并为一个。</p>
                <p class="task-tip">💡 请上传多个视频文件，它们将按上传顺序拼接。建议所有视频具有相同的分辨率和编码格式。</p>
            </div>
            <div class="form-group">
                <label>输出格式</label>
                <select name="format" class="form-control">
                    <option value="mp4">MP4</option>
                    <option value="mkv">MKV</option>
                    <option value="mov">MOV</option>
                </select>
            </div>
            <div class="form-group">
                <label>视频码率</label>
                <input type="text" name="videoBitrate" class="form-control" placeholder="如: 2M, 4M">
            </div>
        `,
        gif: `
            <div class="task-description">
                <p>📋 <strong>GIF制作</strong>：将视频片段转换为动态GIF图片。</p>
                <p class="task-tip">💡 GIF时长建议不超过10秒，否则文件会很大。帧率越高越流畅，但文件也越大。</p>
            </div>
            <div class="form-group">
                <label>开始时间</label>
                <input type="text" name="startTime" class="form-control" placeholder="00:00:00">
            </div>
            <div class="form-group">
                <label>时长（秒）</label>
                <input type="number" name="duration" class="form-control" value="5" min="1" max="30">
            </div>
            <div class="form-group">
                <label>帧率</label>
                <select name="fps" class="form-control">
                    <option value="10">10 FPS</option>
                    <option value="15" selected>15 FPS</option>
                    <option value="20">20 FPS</option>
                </select>
            </div>
            <div class="form-group">
                <label>宽度</label>
                <select name="width" class="form-control">
                    <option value="320">320px</option>
                    <option value="480" selected>480px</option>
                    <option value="640">640px</option>
                    <option value="720">720px</option>
                </select>
            </div>
        `,
        audioExtract: `
            <div class="task-description">
                <p>📋 <strong>音频提取</strong>：从视频中提取音频轨道。</p>
                <p class="task-tip">💡 MP3 格式兼容性最好，FLAC 无损但文件较大。</p>
            </div>
            <div class="form-group">
                <label>输出格式</label>
                <select name="format" class="form-control">
                    <option value="mp3">MP3</option>
                    <option value="aac">AAC</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                </select>
            </div>
            <div class="form-group">
                <label>码率</label>
                <select name="bitrate" class="form-control">
                    <option value="128k">128 kbps</option>
                    <option value="192k" selected>192 kbps</option>
                    <option value="256k">256 kbps</option>
                    <option value="320k">320 kbps</option>
                </select>
            </div>
        `,
        audioMix: `
            <div class="task-description">
                <p>📋 <strong>音频混合</strong>：将背景音乐或音效与原视频音频混合。</p>
                <p class="task-tip">💡 请先上传视频文件，再上传音频文件。系统会自动混合两个音轨。</p>
            </div>
            <div class="form-group">
                <label>原视频音量</label>
                <input type="range" name="videoVolume" class="form-control" min="0" max="2" step="0.1" value="1">
                <span class="form-hint">1.0 = 原始音量</span>
            </div>
            <div class="form-group">
                <label>背景音乐音量</label>
                <input type="range" name="audioVolume" class="form-control" min="0" max="2" step="0.1" value="0.5">
                <span class="form-hint">0.5 = 50%音量</span>
            </div>
            <div class="form-group">
                <label>输出音频码率</label>
                <select name="audioBitrate" class="form-control">
                    <option value="128k">128 kbps</option>
                    <option value="192k" selected>192 kbps</option>
                    <option value="256k">256 kbps</option>
                </select>
            </div>
        `,
        watermark: `
            <div class="task-description">
                <p>📋 <strong>图片水印</strong>：在视频上添加图片水印（如Logo）。</p>
                <p class="task-tip">💡 请先上传视频文件，再上传水印图片（建议使用PNG透明背景）。</p>
            </div>
            <div class="form-group">
                <label>水印位置</label>
                <select name="position" class="form-control">
                    <option value="top-left">左上角</option>
                    <option value="top-right">右上角</option>
                    <option value="bottom-left">左下角</option>
                    <option value="bottom-right" selected>右下角</option>
                    <option value="center">居中</option>
                </select>
            </div>
            <div class="form-group">
                <label>透明度</label>
                <input type="range" name="opacity" class="form-control" min="0" max="1" step="0.1" value="0.8">
                <span class="form-hint">1.0 = 完全不透明</span>
            </div>
            <div class="form-group">
                <label>水印大小</label>
                <select name="scale" class="form-control">
                    <option value="0.1">10%</option>
                    <option value="0.15" selected>15%</option>
                    <option value="0.2">20%</option>
                    <option value="0.3">30%</option>
                </select>
            </div>
        `,
        textWatermark: `
            <div class="task-description">
                <p>📋 <strong>文字水印</strong>：在视频上添加文字水印。</p>
                <p class="task-tip">💡 建议使用描边和阴影提高可读性。</p>
            </div>
            <div class="form-group">
                <label>水印文字 *</label>
                <input type="text" name="text" class="form-control" placeholder="请输入水印文字" required>
            </div>
            <div class="form-group">
                <label>字体大小</label>
                <input type="number" name="fontSize" class="form-control" value="24" min="8" max="120">
            </div>
            <div class="form-group">
                <label>字体颜色</label>
                <input type="color" name="fontColor" class="form-control" value="#ffffff">
            </div>
            <div class="form-group">
                <label>水印位置</label>
                <select name="position" class="form-control">
                    <option value="top-left">左上角</option>
                    <option value="top-right">右上角</option>
                    <option value="bottom-left">左下角</option>
                    <option value="bottom-right" selected>右下角</option>
                    <option value="center">居中</option>
                </select>
            </div>
            <div class="form-group">
                <label>透明度</label>
                <input type="range" name="opacity" class="form-control" min="0" max="1" step="0.1" value="0.8">
                <span class="form-hint">0 = 完全透明，1 = 完全不透明</span>
            </div>
            <div class="form-group">
                <label>描边颜色</label>
                <input type="color" name="borderColor" class="form-control" value="#000000">
                <span class="form-hint">描边可以提高文字对比度</span>
            </div>
            <div class="form-group">
                <label>描边宽度</label>
                <input type="number" name="borderWidth" class="form-control" value="1" min="0" max="10" step="0.5">
                <span class="form-hint">0 = 无描边</span>
            </div>
            <div class="form-group">
                <label>阴影颜色</label>
                <input type="color" name="shadowColor" class="form-control" value="#000000">
                <span class="form-hint">阴影可以增强立体感</span>
            </div>
            <div class="form-group">
                <label>阴影偏移</label>
                <input type="number" name="shadowOffset" class="form-control" value="1" min="0" max="10" step="0.5">
                <span class="form-hint">0 = 无阴影</span>
            </div>
        `,
        screenshot: `
            <div class="task-description">
                <p>📋 <strong>截图提取</strong>：从视频中截取指定时间点的画面。</p>
                <p class="task-tip">💡 时间格式支持"秒数"或"时:分:秒"。PNG格式无损但文件较大。</p>
            </div>
            <div class="form-group">
                <label>截图时间 *</label>
                <input type="text" name="time" class="form-control" placeholder="00:00:01" value="00:00:01">
            </div>
            <div class="form-group">
                <label>输出格式</label>
                <select name="format" class="form-control">
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                </select>
            </div>
        `,
        hls: `
            <div class="task-description">
                <p>📋 <strong>HLS流</strong>：将视频转换为HLS（HTTP Live Streaming）格式，用于网页播放。</p>
                <p class="task-tip">💡 HLS是Apple开发的流媒体协议，广泛用于在线视频。输出为m3u8播放列表和ts分片文件。</p>
            </div>
            <div class="form-group">
                <label>分片时长（秒）</label>
                <input type="number" name="segmentDuration" class="form-control" value="10" min="1" max="30">
                <span class="form-hint">每个分片的时长，建议6-10秒</span>
            </div>
            <div class="form-group">
                <label>视频码率</label>
                <input type="text" name="videoBitrate" class="form-control" value="2M" placeholder="如: 2M">
            </div>
        `,
        dash: `
            <div class="task-description">
                <p>📋 <strong>DASH流</strong>：将视频转换为DASH（Dynamic Adaptive Streaming over HTTP）格式。</p>
                <p class="task-tip">💡 DASH是国际标准的流媒体协议，支持自适应码率。输出为mpd播放列表和m4s分片文件。</p>
            </div>
            <div class="form-group">
                <label>分片时长（秒）</label>
                <input type="number" name="segmentDuration" class="form-control" value="10" min="1" max="30">
                <span class="form-hint">每个分片的时长，建议6-10秒</span>
            </div>
            <div class="form-group">
                <label>视频码率</label>
                <input type="text" name="videoBitrate" class="form-control" value="2M" placeholder="如: 2M">
            </div>
        `
    };

    panel.innerHTML = configs[AppState.selectedTaskType] || '<p class="task-description">请选择任务类型</p>';

    // 绑定表单事件
    panel.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', updateStartButton);
    });

    // 如果有选中的预设，填充配置值
    if (AppState.selectedPreset) {
        const preset = AppState.presets.find(p => p.id === AppState.selectedPreset);
        if (preset && preset.config) {
            fillPresetConfig(preset.config);
        }
    }
}

// 填充预设配置到表单
function fillPresetConfig(config) {
    const panel = document.getElementById('configPanel');
    if (!panel || !config) return;

    // 遍历配置对象的所有属性
    Object.keys(config).forEach(key => {
        const element = panel.querySelector(`[name="${key}"]`);
        if (!element) return;

        const value = config[key];

        // 根据元素类型设置值
        if (element.type === 'checkbox') {
            element.checked = Boolean(value);
        } else if (element.type === 'radio') {
            const radio = panel.querySelector(`[name="${key}"][value="${value}"]`);
            if (radio) radio.checked = true;
        } else {
            element.value = value;
        }

        // 触发 change 事件，以便其他监听器能够响应
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

// 更新开始按钮状态
function updateStartButton() {
    const btn = document.getElementById('startTaskBtn');
    if (!btn) return;

    const requirement = TASK_FILE_REQUIREMENTS[AppState.selectedTaskType];
    const fileCount = AppState.uploadedFiles.length;

    let isValid = false;

    if (requirement) {
        // 检查是否需要槽位选择
        if (requirement.slots && requirement.slots.length > 1) {
            // 多槽位任务：检查所有槽位是否都已分配
            const assignedSlots = new Set(
                AppState.uploadedFiles
                    .filter(f => f.slot !== null && f.slot !== undefined)
                    .map(f => f.slot)
            );
            isValid = assignedSlots.size === requirement.slots.length;
        } else if (requirement.count === -1) {
            // -1 表示需要多个文件（至少 minCount 个）
            const minCount = requirement.minCount || 2;
            isValid = fileCount >= minCount;
        } else {
            // 单文件任务：检查文件数量
            isValid = fileCount === requirement.count;
        }
    }

    btn.disabled = !isValid;
}

// 开始任务
document.addEventListener('click', async (e) => {
    if (e.target.id !== 'startTaskBtn') return;

    const btn = e.target;
    if (btn.disabled) return;

    btn.disabled = true;
    btn.textContent = '创建任务中...';

    try {
        // 收集配置
        const configPanel = document.getElementById('configPanel');
        const config = {};

        configPanel.querySelectorAll('input, select').forEach(el => {
            const name = el.name;
            let value = el.value;

            if (el.type === 'checkbox') {
                value = el.checked;
            } else if (el.type === 'number' || el.type === 'range') {
                value = parseFloat(value);
            }

            if (name && value !== '') {
                config[name] = value;
            }
        });

        // 按槽位顺序排列文件
        const requirement = TASK_FILE_REQUIREMENTS[AppState.selectedTaskType];
        let orderedFiles = [];

        if (requirement && requirement.slots && requirement.slots.length > 1) {
            // 多槽位任务：按槽位顺序排列
            for (let i = 0; i < requirement.slots.length; i++) {
                const file = AppState.uploadedFiles.find(f => f.slot === i);
                if (file) {
                    orderedFiles.push(file);
                }
            }
        } else if (requirement && requirement.count === -1) {
            // 视频拼接：保持上传顺序
            orderedFiles = [...AppState.uploadedFiles];
        } else {
            // 单文件任务
            orderedFiles = AppState.uploadedFiles;
        }

        // 创建任务 - 支持多文件
        const taskData = {
            type: AppState.selectedTaskType,
            inputFiles: orderedFiles,  // 按顺序排列的多文件数组
            presetId: AppState.selectedPreset,
            config
        };

        const result = await API.tasks.create(taskData);

        if (result.success) {
            showNotification('任务创建成功！', 'success');

            // 重置状态
            AppState.uploadedFiles = [];
            updateFileDisplay();
            updateStartButton();

            // 刷新任务列表
            await loadTasks();
        } else {
            showNotification('创建失败: ' + result.message, 'error');
        }
    } catch (error) {
        showNotification('创建失败: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '开始处理';
    }
});

// 任务列表
async function loadTasks() {
    try {
        const result = await API.tasks.list();
        if (result.success) {
            AppState.tasks = result.tasks;
            renderTaskList();
        }
    } catch (error) {
        console.error('加载任务失败:', error);
    }
}

function renderTaskList() {
    const container = document.getElementById('taskList');
    if (!container) return;

    const filter = document.getElementById('taskFilter')?.value || '';

    let tasks = AppState.tasks;
    if (filter) {
        tasks = tasks.filter(t => t.status === filter);
    }

    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无任务</p></div>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        // 获取文件名显示（支持多文件）
        let fileNameDisplay = '未知文件';
        if (task.inputFiles && task.inputFiles.length > 0) {
            if (task.inputFiles.length === 1) {
                fileNameDisplay = task.inputFiles[0].name;
            } else {
                fileNameDisplay = `${task.inputFiles.length} 个文件: ${task.inputFiles.map(f => f.name).join(', ')}`;
            }
        } else if (task.inputFile && task.inputFile.name) {
            fileNameDisplay = task.inputFile.name;
        }

        return `
        <div class="task-item ${task.status}" data-task-id="${task.id}">
            <div class="task-item-header">
                <span class="task-type">${getTaskTypeName(task.type)}</span>
                <span class="task-status ${task.status}">${getTaskStatusName(task.status)}</span>
            </div>
            <div class="task-filename">${fileNameDisplay}</div>
            ${task.status === 'processing' ? `
                <div class="task-progress">
                    <div class="task-progress-bar" style="width: ${task.progress.percent}%"></div>
                </div>
                <div class="task-info">
                    进度: ${task.progress.percent.toFixed(1)}% | 速度: ${task.progress.speed}
                </div>
            ` : ''}
            <div class="task-info">
                ${formatDate(task.createdAt)}
            </div>
            <div class="task-actions">
                ${task.status === 'completed' ? `
                    <button class="btn btn-sm btn-primary download-btn" data-task-id="${task.id}">下载</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-task-id="${task.id}">删除</button>
                ` : ''}
                ${task.status === 'failed' || task.status === 'cancelled' ? `
                    <button class="btn btn-sm btn-danger delete-btn" data-task-id="${task.id}">删除</button>
                ` : ''}
                ${task.status === 'pending' || task.status === 'processing' ? `
                    <button class="btn btn-sm btn-danger cancel-btn" data-task-id="${task.id}">取消</button>
                ` : ''}
            </div>
        </div>
    `}).join('');

    // 绑定事件
    container.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.dataset.taskId;
            window.location.href = API.tasks.getDownloadUrl(taskId);
        });
    });

    container.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.taskId;
            if (await showConfirm('确定要取消这个任务吗？')) {
                try {
                    await API.tasks.cancel(taskId);
                    await loadTasks();
                } catch (error) {
                    showNotification('取消失败: ' + error.message, 'error');
                }
            }
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.taskId;
            if (await showConfirm('确定要删除这个任务吗？')) {
                try {
                    await API.tasks.delete(taskId);
                    await loadTasks();
                    showNotification('任务已删除', 'success');
                } catch (error) {
                    showNotification('删除失败: ' + error.message, 'error');
                }
            }
        });
    });
}

// WebSocket事件
function initWebSocketEvents() {
    wsClient.on('task:started', (data) => {
        console.log('任务开始:', data);
        loadTasks();
    });

    wsClient.on('task:progress', (data) => {
        const task = AppState.tasks.find(t => t.id === data.taskId);
        if (task) {
            task.progress = data.progress;
            task.status = 'processing';
            renderTaskList();
        }
    });

    wsClient.on('task:completed', (data) => {
        console.log('任务完成:', data);
        loadTasks();
        showNotification('任务处理完成！', 'success');
    });

    wsClient.on('task:failed', (data) => {
        console.log('任务失败:', data);
        loadTasks();
        showNotification('任务处理失败', 'error');
    });
}

// 辅助函数
function getTaskTypeName(type) {
    const names = {
        convert: '视频转换',
        compress: '视频压缩',
        trim: '视频裁剪',
        concat: '视频拼接',
        gif: 'GIF制作',
        audioExtract: '音频提取',
        audioMix: '音频混合',
        watermark: '图片水印',
        textWatermark: '文字水印',
        screenshot: '截图提取',
        hls: 'HLS流',
        dash: 'DASH流'
    };
    return names[type] || type;
}

function getTaskStatusName(status) {
    const names = {
        pending: '等待中',
        processing: '处理中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
    };
    return names[status] || status;
}

// 任务筛选
document.addEventListener('change', (e) => {
    if (e.target.id === 'taskFilter') {
        renderTaskList();
    }
});

// ==================== 管理面板功能 ====================

async function initAdmin() {
    if (!AppState.user || AppState.user.role !== 'admin') {
        window.location.href = '/login';
        return;
    }

    // 初始化侧边栏导航
    initAdminNavigation();

    // 加载初始数据
    await loadAdminOverview();
}

function initAdminNavigation() {
    const menuItems = document.querySelectorAll('.admin-menu-item');
    const sections = document.querySelectorAll('.admin-section');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const sectionId = item.dataset.section;

            // 更新菜单激活状态
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');

            // 显示对应区域
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId)?.classList.add('active');

            // 加载对应数据
            loadSectionData(sectionId);
        });
    });
}

async function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'overview':
            await loadAdminOverview();
            break;
        case 'users':
            await loadAdminUsers();
            break;
        case 'tasks':
            await loadAdminTasks();
            break;
        case 'presets':
            await loadAdminPresets();
            break;
        case 'config':
            await loadAdminConfig();
            break;
        case 'logs':
            await loadAdminLogs();
            break;
    }
}

async function loadAdminOverview() {
    try {
        const result = await API.admin.stats();
        if (result.success) {
            const stats = result.stats;

            // 更新统计卡片
            document.getElementById('statTotalUsers').textContent = stats.users.total;
            document.getElementById('statActiveUsers').textContent = stats.users.approved;
            document.getElementById('statPendingUsers').textContent = stats.users.pending;
            document.getElementById('statTotalTasks').textContent = stats.tasks.total;
            document.getElementById('statProcessingTasks').textContent = stats.tasks.processing;
            document.getElementById('statCompletedTasks').textContent = stats.tasks.completed;

            // 更新待审核徽章
            const badge = document.getElementById('pendingBadge');
            if (stats.users.pending > 0) {
                badge.textContent = stats.users.pending;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }

            // 更新系统资源
            const resources = stats.resources;
            document.getElementById('systemResources').innerHTML = `
                <div class="resource-item">
                    <span class="resource-label">CPU</span>
                    <span class="resource-value">${resources.cpuModel}</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">CPU核心</span>
                    <span class="resource-value">${resources.cpuCores}</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">CPU使用率</span>
                    <span class="resource-value">${resources.cpuUsage}</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">内存</span>
                    <span class="resource-value">${resources.usedMemory} / ${resources.totalMemory}</span>
                </div>
            `;

            // 更新队列状态
            document.getElementById('queueStatus').innerHTML = `
                <div class="queue-item">
                    <div class="queue-value">${stats.queue.processingCount}</div>
                    <div class="queue-label">处理中</div>
                </div>
                <div class="queue-item">
                    <div class="queue-value">${stats.queue.queueLength}</div>
                    <div class="queue-label">等待中</div>
                </div>
                <div class="queue-item">
                    <div class="queue-value">${stats.queue.maxConcurrent}</div>
                    <div class="queue-label">最大并发</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载概览失败:', error);
    }
}

async function loadAdminUsers() {
    try {
        const status = document.getElementById('userStatusFilter')?.value || '';
        const search = document.getElementById('userSearchInput')?.value || '';

        const result = await API.admin.users.list({ status, search });
        if (result.success) {
            renderUsersTable(result.users);
        }
    } catch (error) {
        console.error('加载用户失败:', error);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.role === 'admin' ? '管理员' : '普通用户'}</td>
            <td><span class="task-status ${user.status}">${getUserStatusName(user.status)}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                ${user.status === 'pending' ? `
                    <button class="btn btn-sm btn-primary approve-btn" data-user-id="${user.id}">通过</button>
                    <button class="btn btn-sm btn-danger reject-btn" data-user-id="${user.id}">拒绝</button>
                ` : ''}
                ${user.status === 'approved' ? `
                    <button class="btn btn-sm btn-danger disable-btn" data-user-id="${user.id}">禁用</button>
                ` : ''}
                ${user.status === 'disabled' ? `
                    <button class="btn btn-sm btn-primary enable-btn" data-user-id="${user.id}">启用</button>
                ` : ''}
                <button class="btn btn-sm btn-outline reset-pwd-btn" data-user-id="${user.id}">重置密码</button>
                ${user.role !== 'admin' || users.filter(u => u.role === 'admin').length > 1 ? `
                    <button class="btn btn-sm btn-danger delete-btn" data-user-id="${user.id}">删除</button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    // 绑定按钮事件
    bindUserTableEvents();
}

function bindUserTableEvents() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (await showConfirm('确定要通过审核吗？')) {
                await API.admin.users.approve(userId);
                loadAdminUsers();
            }
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (await showConfirm('确定要拒绝吗？')) {
                await API.admin.users.reject(userId);
                loadAdminUsers();
            }
        });
    });

    document.querySelectorAll('.disable-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (await showConfirm('确定要禁用吗？')) {
                await API.admin.users.disable(userId);
                loadAdminUsers();
            }
        });
    });

    document.querySelectorAll('.enable-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            await API.admin.users.enable(userId);
            loadAdminUsers();
        });
    });

    document.querySelectorAll('.reset-pwd-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (await showConfirm('确定要重置密码吗？')) {
                const result = await API.admin.users.resetPassword(userId);
                if (result.success) {
                    showNotification('新密码: ' + result.newPassword, 'success');
                }
            }
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (await showConfirm('确定要删除吗？此操作不可恢复！', '危险操作')) {
                await API.admin.users.delete(userId);
                loadAdminUsers();
            }
        });
    });
}

function getUserStatusName(status) {
    const names = {
        pending: '待审核',
        approved: '已通过',
        rejected: '已拒绝',
        disabled: '已禁用'
    };
    return names[status] || status;
}

async function loadAdminTasks() {
    // 类似实现...
}

async function loadAdminPresets() {
    // 类似实现...
}

async function loadAdminConfig() {
    try {
        const result = await API.admin.config.get();
        if (result.success) {
            const form = document.getElementById('configForm');
            const config = result.config;

            form.maxConcurrent.value = config.system.maxConcurrent;
            form.maxFileSize.value = config.system.maxFileSize / (1024 * 1024);
            form.tokenExpire.value = config.system.tokenExpire / 3600;
            form.autoCleanup.checked = config.storage.autoCleanup;
            form.cleanupAfter.value = config.storage.cleanupAfter / 60;
            form.hardwareAccel.value = config.ffmpeg.hardwareAccel;
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

async function loadAdminLogs() {
    try {
        const result = await API.admin.logs.get(200);
        if (result.success) {
            document.getElementById('logContent').textContent = result.content;
        }
    } catch (error) {
        console.error('加载日志失败:', error);
    }
}

// 配置表单提交
document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'configForm') return;

    e.preventDefault();
    const form = e.target;

    const configData = {
        'system.maxConcurrent': parseInt(form.maxConcurrent.value),
        'system.maxFileSize': parseInt(form.maxFileSize.value) * 1024 * 1024,
        'system.tokenExpire': parseInt(form.tokenExpire.value) * 3600,
        'storage.autoCleanup': form.autoCleanup.checked,
        'storage.cleanupAfter': parseInt(form.cleanupAfter.value) * 60,
        'ffmpeg.hardwareAccel': form.hardwareAccel.value
    };

    try {
        const result = await API.admin.config.update(configData);
        if (result.success) {
            showNotification('配置保存成功', 'success');
        } else {
            showNotification('保存失败', 'error');
        }
    } catch (error) {
        showNotification('保存失败: ' + error.message, 'error');
    }
});

// 用户筛选事件
document.addEventListener('change', (e) => {
    if (e.target.id === 'userStatusFilter') {
        loadAdminUsers();
    }
});

document.addEventListener('input', (e) => {
    if (e.target.id === 'userSearchInput') {
        loadAdminUsers();
    }
});

// 刷新日志
document.addEventListener('click', (e) => {
    if (e.target.id === 'refreshLogsBtn') {
        loadAdminLogs();
    }
});
