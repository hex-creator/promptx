const app = {
    data: {
        templates: [],
        currentTemplateId: null,
        paramValues: {},
        dragSrcIndex: null
    },

    init() {
        this.loadTemplates();
        this.bindEvents();
        this.renderList();
    },

    loadTemplates() {
        const stored = localStorage.getItem('promptTemplates');
        if (stored) {
            this.data.templates = JSON.parse(stored);
        }
    },

    saveTemplates() {
        localStorage.setItem('promptTemplates', JSON.stringify(this.data.templates));
    },

    bindEvents() {
        // 导航
        document.getElementById('addTemplateBtn').addEventListener('click', () => this.showEdit());
        
        // 搜索
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));

        // 编辑页
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveTemplate());
        document.getElementById('insertParamBtn').addEventListener('click', () => this.insertParam());
        
        // 生成页
        document.getElementById('copyResultBtn').addEventListener('click', () => this.copyResult());

        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-btn') && !e.target.closest('.menu-dropdown')) {
                document.getElementById('globalMenu').classList.remove('show');
            }
        });

        // 导入导出
        document.getElementById('exportBtn').addEventListener('click', () => this.exportTemplates());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importTemplates(e));

        // --- 拖拽排序逻辑 (容器级) ---
        const listEl = document.getElementById('templateList');
        
        listEl.addEventListener('dragover', (e) => {
            e.preventDefault(); // 允许 drop
            const draggingCard = document.querySelector('.dragging');
            if (!draggingCard) return;

            // 如果正在搜索，禁止排序视觉效果
            if (document.getElementById('searchInput').value.trim() !== '') return;

            const afterElement = this.getDragAfterElement(listEl, e.clientY);
            if (afterElement == null) {
                listEl.appendChild(draggingCard);
            } else {
                listEl.insertBefore(draggingCard, afterElement);
            }
        });

        listEl.addEventListener('drop', (e) => {
            e.preventDefault();
            if (document.getElementById('searchInput').value.trim() !== '') {
                alert("搜索状态下无法排序，请清空搜索框");
                this.renderList(); // 恢复原状
                return;
            }
            this.saveNewOrder();
        });
    },

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.template-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2; // 计算鼠标距离元素中心的垂直距离
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    saveNewOrder() {
        const newOrderIds = Array.from(document.querySelectorAll('.template-card')).map(el => el.dataset.id);
        const newTemplates = [];
        
        // 根据 DOM ID 顺序重组数据
        newOrderIds.forEach(id => {
            const t = this.data.templates.find(item => item.id === id);
            if (t) newTemplates.push(t);
        });
        
        // 只有当顺序真的改变且数据完整时才保存
        if (newTemplates.length === this.data.templates.length) {
            this.data.templates = newTemplates;
            this.saveTemplates();
        } else {
            // 异常情况，重新渲染恢复
            this.renderList();
        }
    },

    // --- 视图切换 ---
    switchView(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    },

    showList() {
        // 清空搜索框
        document.getElementById('searchInput').value = '';
        this.renderList();
        this.switchView('listView');
    },

    showEdit(id = null) {
        this.data.currentTemplateId = id;
        const titleEl = document.getElementById('editPageTitle');
        const nameEl = document.getElementById('templateName');
        const descEl = document.getElementById('templateDesc');
        const contentEl = document.getElementById('templateContent');

        if (id) {
            const template = this.data.templates.find(t => t.id === id);
            if (template) {
                titleEl.textContent = '修改模板';
                nameEl.value = template.name;
                descEl.value = template.desc;
                contentEl.value = template.content;
            }
        } else {
            titleEl.textContent = '添加模板';
            nameEl.value = '';
            descEl.value = '';
            contentEl.value = '';
        }
        this.switchView('editView');
    },

    showGenerate(id) {
        const template = this.data.templates.find(t => t.id === id);
        if (!template) return;

        this.data.currentTemplateId = id;
        document.getElementById('genPageTitle').textContent = template.name;
        document.getElementById('genTemplateDesc').textContent = template.desc;
        
        // 解析参数
        this.renderParams(template.content);
        this.switchView('generateView');
    },

    // --- 列表逻辑 ---
    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            this.renderList();
            return;
        }
        const filtered = this.data.templates.filter(t => 
            t.name.toLowerCase().includes(query) || 
            t.desc.toLowerCase().includes(query)
        );
        this.renderList(filtered);
    },

    renderList(templates = this.data.templates) {
        const listEl = document.getElementById('templateList');
        listEl.innerHTML = '';

        if (templates.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; color:var(--text-sub); padding: 20px;">没有找到模板</div>';
            return;
        }

        templates.forEach((t, index) => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.draggable = false; // 默认不可拖拽
            card.dataset.index = index; // 存储索引
            card.dataset.id = t.id;

            // 绑定拖拽事件 (仅负责样式切换)
            card.addEventListener('dragstart', () => {
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });

            card.onclick = (e) => {
                // 如果点击的是菜单按钮、菜单项或拖动按钮，不跳转
                if (e.target.closest('.menu-btn') || 
                    e.target.closest('.menu-dropdown') || 
                    e.target.closest('.drag-btn')) return;
                this.showGenerate(t.id);
            };

            // 拖动按钮事件绑定
            // 注意：这里我们通过 HTML 字符串生成元素，所以需要在 appendChild 后绑定事件
            // 或者直接在 HTML 中使用 onclick (不推荐用于复杂逻辑)
            // 这里我们先生成 HTML，然后查找按钮绑定事件
            
            const descHtml = t.desc ? `<div class="card-desc">${this.escapeHtml(t.desc)}</div>` : '';
            const previewHtml = t.content ? `<div class="card-preview">${this.escapeHtml(t.content)}</div>` : '';
            
            card.innerHTML = `
                <div class="card-content">
                    <div class="card-title">${this.escapeHtml(t.name)}</div>
                    ${descHtml}
                    ${previewHtml}
                </div>
                <div class="card-actions">
                    <button class="drag-btn" title="长按拖动排序">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </button>
                    <button class="menu-btn" onclick="app.toggleMenu(event, '${t.id}')">⋮</button>
                </div>
            `;
            listEl.appendChild(card);

            // 绑定拖动按钮的 mousedown 事件
            const dragBtn = card.querySelector('.drag-btn');
            dragBtn.addEventListener('mousedown', () => {
                card.draggable = true;
            });
            dragBtn.addEventListener('mouseup', () => {
                card.draggable = false;
            });
            dragBtn.addEventListener('mouseleave', () => {
                card.draggable = false;
            });
        });
    },

    toggleMenu(e, id) {
        e.stopPropagation();
        const menu = document.getElementById('globalMenu');
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();

        // 设置菜单内容
        menu.innerHTML = `
            <button class="menu-item" onclick="app.showEdit('${id}')">修改</button>
            <button class="menu-item delete" onclick="app.deleteTemplate('${id}')">删除</button>
        `;

        // 显示菜单以获取尺寸
        menu.classList.add('show');
        
        // 计算位置：优先显示在按钮左下方，如果靠右则向左偏移
        let top = rect.bottom + 5;
        let left = rect.right - menu.offsetWidth;

        // 边界检查（防止超出底部）
        if (top + menu.offsetHeight > window.innerHeight) {
            top = rect.top - menu.offsetHeight - 5; // 向上弹出
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    },

    // --- 编辑逻辑 ---
    insertParam() {
        const name = prompt("请输入参数名称 (例如: 角色):");
        if (name) {
            const textarea = document.getElementById('templateContent');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const insertText = `[${name}]`;
            
            textarea.value = text.substring(0, start) + insertText + text.substring(end);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }
    },

    saveTemplate() {
        const name = document.getElementById('templateName').value.trim();
        const desc = document.getElementById('templateDesc').value.trim();
        const content = document.getElementById('templateContent').value;

        if (!name || !content) {
            alert("模板名称和内容不能为空");
            return;
        }

        if (this.data.currentTemplateId) {
            // 更新
            const index = this.data.templates.findIndex(t => t.id === this.data.currentTemplateId);
            if (index !== -1) {
                this.data.templates[index] = { ...this.data.templates[index], name, desc, content };
            }
        } else {
            // 新增
            const newTemplate = {
                id: Date.now().toString(),
                name,
                desc,
                content
            };
            this.data.templates.unshift(newTemplate);
        }

        this.saveTemplates();
        this.showList();
    },

    deleteTemplate(id) {
        if (confirm("确定要删除这个模板吗？")) {
            this.data.templates = this.data.templates.filter(t => t.id !== id);
            this.saveTemplates();
            this.renderList();
        }
    },

    // --- 生成逻辑 ---
    renderParams(content) {
        const paramContainer = document.getElementById('paramInputs');
        paramContainer.innerHTML = '';
        this.data.paramValues = {};

        // 正则匹配 [xxx]
        const regex = /\[(.*?)\]/g;
        const matches = [...content.matchAll(regex)];
        
        // 去重参数名
        const uniqueParams = [...new Set(matches.map(m => m[1]))];

        if (uniqueParams.length === 0) {
            paramContainer.innerHTML = '<div style="color: var(--text-sub);">此模板没有参数，直接复制结果即可。</div>';
        }

        uniqueParams.forEach(param => {
            this.data.paramValues[param] = ''; // 初始化

            const group = document.createElement('div');
            group.className = 'form-group';
            
            const label = document.createElement('label');
            label.textContent = param;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `${param}`;
            input.oninput = (e) => {
                this.data.paramValues[param] = e.target.value;
                this.updatePreview(content);
            };

            group.appendChild(label);
            group.appendChild(input);
            paramContainer.appendChild(group);
        });

        this.updatePreview(content);
    },

    updatePreview(originalContent) {
        let result = originalContent;
        for (const [key, value] of Object.entries(this.data.paramValues)) {
            // 全局替换 [key]
            // 使用 split join 或者 replaceAll (注意转义)
            // 这里简单处理，假设 key 不包含特殊正则字符，如果包含需要转义
            const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[${safeKey}\\]`, 'g');
            result = result.replace(regex, value || `[${key}]`); // 如果没值，保留占位符或者变空？PRD没说，保留占位符比较直观，或者变空。这里保留占位符让用户知道还没填。

        }
        document.getElementById('resultPreview').textContent = result;
    },

    copyResult() {
        const text = document.getElementById('resultPreview').textContent;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copyResultBtn');
            const originalText = btn.textContent;
            btn.textContent = '已复制!';
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    },

    escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    },

    // --- 导入导出 ---
    exportTemplates() {
        const dataStr = JSON.stringify(this.data.templates, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "我的提示词.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importTemplates(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    alert("文件格式错误：必须是 JSON 数组");
                    return;
                }

                let addedCount = 0;
                imported.forEach(newItem => {
                    // 简单校验
                    if (!newItem.id || !newItem.name || !newItem.content) return;

                    // 检查是否存在同 ID
                    const exists = this.data.templates.some(t => t.id === newItem.id);
                    if (!exists) {
                        this.data.templates.push(newItem);
                        addedCount++;
                    } else {
                        // 可选：如果 ID 相同，是否覆盖？这里选择跳过或更新。
                        // 简单起见，如果 ID 相同，我们生成新 ID 并添加（视为复制），或者直接跳过。
                        // 为了避免冲突，这里策略是：如果 ID 相同，视为已存在，不处理。
                        // 或者：生成新 ID 强制导入。
                        // 让我们采用：如果 ID 相同，询问用户或者直接生成新 ID 导入。
                        // 鉴于这是备份恢复，通常希望恢复旧数据。
                        // 简单策略：追加，如果有重复 ID，生成新 ID。
                        const newItemWithNewId = { ...newItem, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) };
                        this.data.templates.push(newItemWithNewId);
                        addedCount++;
                    }
                });

                this.saveTemplates();
                this.renderList();
                alert(`成功导入 ${addedCount} 个模板`);
            } catch (err) {
                alert("导入失败：文件解析错误");
                console.error(err);
            }
            // 清空 input，允许再次选择同名文件
            event.target.value = '';
        };
        reader.readAsText(file);
    }
};

// 启动应用
app.init();