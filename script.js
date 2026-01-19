const app = {
    data: {
        templates: [],
        currentTemplateId: null,
        paramValues: {}
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
        
        // 编辑页
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveTemplate());
        document.getElementById('insertParamBtn').addEventListener('click', () => this.insertParam());
        
        // 生成页
        document.getElementById('copyResultBtn').addEventListener('click', () => this.copyResult());

        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-btn')) {
                document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.remove('show'));
            }
        });
    },

    // --- 视图切换 ---
    switchView(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    },

    showList() {
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
    renderList() {
        const listEl = document.getElementById('templateList');
        listEl.innerHTML = '';

        this.data.templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.onclick = (e) => {
                // 如果点击的是菜单按钮或菜单项，不跳转
                if (e.target.closest('.menu-btn') || e.target.closest('.menu-dropdown')) return;
                this.showGenerate(t.id);
            };

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-title">${this.escapeHtml(t.name)}</span>
                    <div style="position: relative;">
                        <button class="menu-btn" onclick="app.toggleMenu(event, '${t.id}')">⋮</button>
                        <div id="menu-${t.id}" class="menu-dropdown">
                            <button class="menu-item" onclick="app.showEdit('${t.id}')">修改</button>
                            <button class="menu-item delete" onclick="app.deleteTemplate('${t.id}')">删除</button>
                        </div>
                    </div>
                </div>
                <div class="card-desc">${this.escapeHtml(t.desc)}</div>
            `;
            listEl.appendChild(card);
        });
    },

    toggleMenu(e, id) {
        e.stopPropagation();
        // 关闭其他菜单
        document.querySelectorAll('.menu-dropdown').forEach(el => {
            if (el.id !== `menu-${id}`) el.classList.remove('show');
        });
        const menu = document.getElementById(`menu-${id}`);
        menu.classList.toggle('show');
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
            input.placeholder = `输入 ${param} 的内容...`;
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
            // 修正：通常生成时如果没填，应该显示为空或者保留。为了用户体验，如果没填，保留占位符提示用户。
            // 但如果用户真的想留空呢？
            // 让我们改成：如果没填，就显示为空字符串，这样预览就是最终结果。
            // 不，PRD说“依次输入所有参数内容-> 预览”。
            // 还是替换成 value 吧。如果 value 是空串，就替换成空串。
            // 但是为了让用户看到哪里变了，如果 value 是空，我还是保留 [key] 比较好，或者高亮显示。
            // 简单起见：直接替换。
             result = result.replace(regex, value);
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
    }
};

// 启动应用
app.init();
