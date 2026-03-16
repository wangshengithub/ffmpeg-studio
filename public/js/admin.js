/**
 * FFmpeg Studio - 管理员面板脚本
 * 此文件包含管理员面板的额外功能
 */

// 模态框管理
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.initModals();
    }

    initModals() {
        // 关闭按钮
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAll();
            });
        });

        // 点击背景关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAll();
                }
            });
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeAll();
            }
        });
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;
        }
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            if (this.activeModal === modal) {
                this.activeModal = null;
            }
        }
    }

    closeAll() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        this.activeModal = null;
    }
}

const modalManager = new ModalManager();

// 创建用户
document.addEventListener('click', async (e) => {
    if (e.target.id !== 'createUserBtn') return;

    modalManager.open('userModal');
    document.getElementById('userModalTitle').textContent = '创建用户';
    document.getElementById('userForm').reset();
    document.getElementById('userPassword').placeholder = '留空则自动生成';
});

// 用户表单提交
document.addEventListener('click', async (e) => {
    if (e.target.id !== 'userFormSubmit') return;

    const form = document.getElementById('userForm');
    const formData = new FormData(form);

    const userData = {
        username: formData.get('username'),
        password: formData.get('password') || null,
        role: formData.get('role')
    };

    try {
        const result = await API.admin.users.create(userData);
        if (result.success) {
            modalManager.close('userModal');
            await loadAdminUsers();
            showNotification('用户创建成功', 'success');
        } else {
            showNotification(result.message || '创建失败', 'error');
        }
    } catch (error) {
        showNotification('创建失败: ' + error.message, 'error');
    }
});

// 导入用户
document.addEventListener('click', (e) => {
    if (e.target.id !== 'importUsersBtn') return;

    modalManager.open('importModal');
    document.getElementById('importFile').value = '';
});

document.addEventListener('click', async (e) => {
    if (e.target.id !== 'importSubmit') return;

    const fileInput = document.getElementById('importFile');
    if (!fileInput.files.length) {
        showNotification('请选择文件', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            const result = await API.admin.users.import(data);

            if (result.success) {
                modalManager.close('importModal');
                await loadAdminUsers();
                showNotification(`导入成功: ${result.imported} 个用户`, 'success');

                if (result.failed.length > 0) {
                    console.log('导入失败的用户:', result.failed);
                }
            } else {
                showNotification(result.message || '导入失败', 'error');
            }
        } catch (error) {
            showNotification('文件格式错误', 'error');
        }
    };

    reader.readAsText(file);
});

// 预设管理
async function loadAdminPresets() {
    try {
        const result = await API.admin.presets.list();
        if (result.success) {
            renderPresetsTable(result.presets);
        }
    } catch (error) {
        console.error('加载预设失败:', error);
    }
}

function renderPresetsTable(presets) {
    const tbody = document.getElementById('presetsTableBody');
    if (!tbody) return;

    tbody.innerHTML = presets.map(preset => `
        <tr>
            <td>${preset.name}</td>
            <td>${preset.type}</td>
            <td>${preset.isBuiltin ? '系统内置' : (preset.userId || '用户')}</td>
            <td>${preset.isPublic ? '是' : '否'}</td>
            <td>${preset.usageCount || 0}</td>
            <td>
                ${!preset.isBuiltin ? `
                    <button class="btn btn-sm btn-danger delete-preset-btn" data-preset-id="${preset.id}">删除</button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    // 绑定删除事件
    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const presetId = btn.dataset.presetId;
            if (await showConfirm('确定要删除这个预设吗？此操作不可恢复！', '删除预设')) {
                try {
                    await API.admin.presets.delete(presetId);
                    await loadAdminPresets();
                    showNotification('预设已删除', 'success');
                } catch (error) {
                    showNotification('删除失败: ' + error.message, 'error');
                }
            }
        });
    });
}

// 任务管理
async function loadAdminTasks() {
    try {
        const status = document.getElementById('taskStatusFilter')?.value || '';
        const type = document.getElementById('taskTypeFilter')?.value || '';

        const result = await API.admin.tasks.list({ status, type });
        if (result.success) {
            renderAdminTasksTable(result.tasks);
        }
    } catch (error) {
        console.error('加载任务失败:', error);
    }
}

function renderAdminTasksTable(tasks) {
    const tbody = document.getElementById('tasksTableBody');
    if (!tbody) return;

    tbody.innerHTML = tasks.map(task => `
        <tr>
            <td><small>${task.id.substring(0, 8)}...</small></td>
            <td>${task.userId ? task.userId.substring(0, 8) : '-'}</td>
            <td>${getTaskTypeName(task.type)}</td>
            <td><span class="task-status ${task.status}">${getTaskStatusName(task.status)}</span></td>
            <td><small>${formatDate(task.createdAt)}</small></td>
            <td>
                <button class="btn btn-sm btn-outline view-task-btn" data-task-id="${task.id}">查看</button>
            </td>
        </tr>
    `).join('');

    // 绑定查看事件
    document.querySelectorAll('.view-task-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const taskId = btn.dataset.taskId;
            try {
                const result = await API.admin.tasks.get(taskId);
                if (result.success) {
                    showTaskDetail(result);
                }
            } catch (error) {
                showNotification('获取任务详情失败', 'error');
            }
        });
    });
}

function showTaskDetail(data) {
    const modal = document.getElementById('taskDetailModal');
    const body = document.getElementById('taskDetailBody');

    if (!modal || !body) return;

    const task = data.task;
    const user = data.user;

    body.innerHTML = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <p><strong>任务ID:</strong> ${task.id}</p>
            <p><strong>类型:</strong> ${getTaskTypeName(task.type)}</p>
            <p><strong>状态:</strong> ${getTaskStatusName(task.status)}</p>
            ${user ? `<p><strong>用户:</strong> ${user.username}</p>` : ''}
        </div>
        <div class="detail-section">
            <h4>文件信息</h4>
            <p><strong>输入文件:</strong> ${task.inputFile.name}</p>
            <p><strong>文件大小:</strong> ${formatBytes(task.inputFile.size)}</p>
            ${task.outputFile ? `<p><strong>输出文件:</strong> ${task.outputFile.name}</p>` : ''}
        </div>
        <div class="detail-section">
            <h4>时间信息</h4>
            <p><strong>创建时间:</strong> ${formatDate(task.createdAt)}</p>
            ${task.startedAt ? `<p><strong>开始时间:</strong> ${formatDate(task.startedAt)}</p>` : ''}
            ${task.completedAt ? `<p><strong>完成时间:</strong> ${formatDate(task.completedAt)}</p>` : ''}
        </div>
        ${task.progress ? `
            <div class="detail-section">
                <h4>进度信息</h4>
                <p><strong>进度:</strong> ${task.progress.percent.toFixed(1)}%</p>
                <p><strong>速度:</strong> ${task.progress.speed}</p>
            </div>
        ` : ''}
        ${task.error ? `
            <div class="detail-section error">
                <h4>错误信息</h4>
                <pre>${task.error}</pre>
            </div>
        ` : ''}
    `;

    modalManager.open('taskDetailModal');
}

// 任务筛选
document.addEventListener('change', (e) => {
    if (e.target.id === 'taskStatusFilter' || e.target.id === 'taskTypeFilter') {
        loadAdminTasks();
    }
});

// 初始化任务类型筛选选项
async function initTaskTypeFilter() {
    const select = document.getElementById('taskTypeFilter');
    if (!select) return;

    const types = [
        'convert', 'compress', 'trim', 'concat', 'gif',
        'audioExtract', 'audioMix', 'watermark', 'textWatermark',
        'screenshot', 'hls', 'dash'
    ];

    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = getTaskTypeName(type);
        select.appendChild(option);
    });
}

// 定时刷新数据
let refreshInterval = null;

function startAutoRefresh() {
    // 每30秒刷新一次概览数据
    refreshInterval = setInterval(async () => {
        const activeSection = document.querySelector('.admin-section.active');
        if (activeSection?.id === 'overview') {
            await loadAdminOverview();
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// 页面可见性变化时刷新
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        loadSectionData(document.querySelector('.admin-section.active')?.id);
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTaskTypeFilter();
    startAutoRefresh();
});

// WebSocket事件处理
wsClient.on('task:started', (data) => {
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection?.id === 'overview' || activeSection?.id === 'tasks') {
        loadSectionData(activeSection.id);
    }
});

wsClient.on('task:progress', (data) => {
    // 更新任务列表中的进度
});

wsClient.on('task:completed', (data) => {
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection?.id === 'overview' || activeSection?.id === 'tasks') {
        loadSectionData(activeSection.id);
    }
});

wsClient.on('task:failed', (data) => {
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection?.id === 'overview' || activeSection?.id === 'tasks') {
        loadSectionData(activeSection.id);
    }
});

// 通知函数（如果未在app.js中定义）
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close" style="margin-left: 12px; background: none; border: none; color: white; cursor: pointer; font-size: 18px;">&times;</button>
        `;

        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    };
}

// 确认框函数（如果未在app.js中定义）
if (typeof showConfirm === 'undefined') {
    window.showConfirm = function(message, title = '确认') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;

            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                max-width: 400px;
                width: 90%;
            `;

            dialog.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px;">${title}</h3>
                <p style="margin: 0 0 24px 0; color: #666;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">取消</button>
                    <button class="btn-confirm" style="padding: 8px 16px; border: none; background: #667eea; color: white; border-radius: 6px; cursor: pointer;">确认</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            dialog.querySelector('.btn-cancel').addEventListener('click', () => close(false));
            dialog.querySelector('.btn-confirm').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });

            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEsc);
                    close(false);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    };
}
