const app = {
    data: {
        templates: [],
        currentTemplateId: null,
        paramValues: {},
        dragSrcIndex: null,
        isManualMode: false
    },

    init() {
        this.loadTemplates();
        this.bindEvents();
        this.handleRoute(); // 初始化路由
        
        // 监听浏览器后退/前进
        window.addEventListener('popstate', () => this.handleRoute());
    },

    loadTemplates() {
        const stored = localStorage.getItem('promptTemplates');
        if (stored) {
            this.data.templates = JSON.parse(stored);
        } else {
            this.loadDefaultTemplates(false);
        }
    },

    loadDefaultTemplates(confirmRequired = true) {
        if (confirmRequired && !confirm("警告：这将清空您当前的所有模板并恢复为默认设置。此操作不可撤销！\n\n确定要继续吗？")) {
            return;
        }

        fetch('default_template.json')
            .then(response => response.json())
            .then(data => {
                this.data.templates = data;
                this.saveTemplates();
                this.renderList();
                if (confirmRequired) {
                    alert("已成功恢复默认模板");
                }
            })
            .catch(err => {
                console.error('加载默认模板失败:', err);
                if (confirmRequired) alert('加载默认模板失败，请检查网络或文件');
            });
    },

    saveTemplates() {
        localStorage.setItem('promptTemplates', JSON.stringify(this.data.templates));
    },

    bindEvents() {
        // 通用返回
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.navigate('list'));
        });

        // 首页事件
        document.getElementById('addTemplateBtn').addEventListener('click', () => this.navigate('edit'));
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));
        
        // 导入导出
        document.getElementById('exportBtn').addEventListener('click', () => this.exportTemplates());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importTemplates(e));
        document.getElementById('importDefaultBtn').addEventListener('click', () => this.loadDefaultTemplates(true));

        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-btn') && !e.target.closest('.menu-dropdown')) {
                document.getElementById('globalMenu').classList.remove('show');
            }
        });

        // 拖拽逻辑
        const listEl = document.getElementById('templateList');
        listEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingCard = document.querySelector('.dragging');
            if (!draggingCard) return;
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
                this.renderList();
                return;
            }
            this.saveNewOrder();
        });

        // 编辑页事件
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveTemplate());
        document.getElementById('insertParamBtn').addEventListener('click', () => this.insertParam());

        // 生成页事件
        document.getElementById('copyResultBtn').addEventListener('click', () => this.copyResult());
        document.getElementById('toggleEditBtn').addEventListener('click', () => this.toggleEditMode());
    },

    // --- 路由逻辑 ---
    navigate(page, id = null) {
        const url = id ? `?page=${page}&id=${id}` : `?page=${page}`;
        window.history.pushState({}, '', url);
        this.handleRoute();
    },

    handleRoute() {
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page') || 'list';
        const id = params.get('id');

        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        if (page === 'list') {
            this.showList();
        } else if (page === 'edit') {
            this.showEdit(id);
        } else if (page === 'generate') {
            this.showGenerate(id);
        }
    },

    // --- 视图切换 ---
    showList() {
        document.getElementById('searchInput').value = '';
        this.renderList();
        document.getElementById('listView').classList.add('active');
        // 滚动回顶部（可选，如果需要记忆位置则不加）
        // document.getElementById('listView').scrollTop = 0;
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
        document.getElementById('editView').classList.add('active');
    },

    showGenerate(id) {
        const template = this.data.templates.find(t => t.id === id);
        if (!template) {
            alert('模板不存在');
            this.navigate('list');
            return;
        }

        this.data.currentTemplateId = id;
        // 重置为自动模式
        this.data.isManualMode = false;
        const previewEl = document.getElementById('resultPreview');
        const btnEl = document.getElementById('toggleEditBtn');
        
        previewEl.readOnly = true;
        btnEl.textContent = '手动修改';

        document.getElementById('genPageTitle').textContent = template.name;
        document.getElementById('genTemplateDesc').textContent = template.desc;
        
        this.renderParams(template.content);
        document.getElementById('generateView').classList.add('active');
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
            card.draggable = false;
            card.dataset.index = index;
            card.dataset.id = t.id;

            card.addEventListener('dragstart', () => card.classList.add('dragging'));
            card.addEventListener('dragend', () => card.classList.remove('dragging'));

            card.onclick = (e) => {
                if (e.target.closest('.menu-btn') || 
                    e.target.closest('.menu-dropdown') || 
                    e.target.closest('.drag-btn')) return;
                this.navigate('generate', t.id);
            };

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

            const dragBtn = card.querySelector('.drag-btn');
            dragBtn.addEventListener('mousedown', () => card.draggable = true);
            dragBtn.addEventListener('mouseup', () => card.draggable = false);
            dragBtn.addEventListener('mouseleave', () => card.draggable = false);
        });
    },

    toggleMenu(e, id) {
        e.stopPropagation();
        const menu = document.getElementById('globalMenu');
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();

        menu.innerHTML = `
            <button class="menu-item" onclick="app.navigate('edit', '${id}')">修改</button>
            <button class="menu-item delete" onclick="app.deleteTemplate('${id}')">删除</button>
        `;

        menu.classList.add('show');
        
        let top = rect.bottom + 5;
        let left = rect.right - menu.offsetWidth;

        if (top + menu.offsetHeight > window.innerHeight) {
            top = rect.top - menu.offsetHeight - 5;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    },

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.template-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
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
        newOrderIds.forEach(id => {
            const t = this.data.templates.find(item => item.id === id);
            if (t) newTemplates.push(t);
        });
        if (newTemplates.length === this.data.templates.length) {
            this.data.templates = newTemplates;
            this.saveTemplates();
        } else {
            this.renderList();
        }
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
            const scrollTop = textarea.scrollTop;
            
            textarea.value = text.substring(0, start) + insertText + text.substring(end);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
            textarea.scrollTop = scrollTop;
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
            const index = this.data.templates.findIndex(t => t.id === this.data.currentTemplateId);
            if (index !== -1) {
                this.data.templates[index] = { ...this.data.templates[index], name, desc, content };
            }
        } else {
            const newTemplate = {
                id: Date.now().toString(),
                name,
                desc,
                content
            };
            this.data.templates.unshift(newTemplate);
        }

        this.saveTemplates();
        this.navigate('list');
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

        const regex = /\[(.*?)\]/g;
        const matches = [...content.matchAll(regex)];
        const uniqueParams = [...new Set(matches.map(m => m[1]))];

        if (uniqueParams.length === 0) {
            paramContainer.innerHTML = '<div style="color: var(--text-sub);">此模板没有参数，直接复制结果即可。</div>';
        }

        uniqueParams.forEach(param => {
            this.data.paramValues[param] = '';

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
        if (this.data.isManualMode) return;

        let result = originalContent;
        for (const [key, value] of Object.entries(this.data.paramValues)) {
            const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[${safeKey}\\]`, 'g');
            result = result.replace(regex, value || `[${key}]`); // 如果没值，保留占位符或者变空？PRD没说，保留占位符比较直观，或者变空。这里保留占位符让用户知道还没填。

        }
        document.getElementById('resultPreview').value = result;
    },

    toggleEditMode() {
        const previewEl = document.getElementById('resultPreview');
        const btnEl = document.getElementById('toggleEditBtn');

        if (!this.data.isManualMode) {
            this.data.isManualMode = true;
            previewEl.readOnly = false;
            previewEl.focus();
            btnEl.textContent = '重新生成';
        } else {
            if (confirm("重新生成将覆盖您的手动修改，确定吗？")) {
                this.data.isManualMode = false;
                previewEl.readOnly = true;
                btnEl.textContent = '手动修改';
                
                const template = this.data.templates.find(t => t.id === this.data.currentTemplateId);
                if (template) {
                    this.updatePreview(template.content);
                }
            }
        }
    },

    copyResult() {
        const text = document.getElementById('resultPreview').value;
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
                    if (!newItem.id || !newItem.name || !newItem.content) return;
                    const exists = this.data.templates.some(t => t.id === newItem.id);
                    if (!exists) {
                        this.data.templates.push(newItem);
                        addedCount++;
                    } else {
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
            event.target.value = '';
        };
        reader.readAsText(file);
    }
};

app.init();