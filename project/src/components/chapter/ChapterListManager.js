/**
 * 章节列表管理器
 * 负责渲染和交互：显示同一系列的所有章节，高亮当前章节，点击跳转
 */
export class ChapterListManager {
    constructor() {
        this.container = document.querySelector('.chapter-list-cr');
        if (this.container) {
            this.inner = this.container.querySelector('.chapter-list-inner');
            this.title = this.container.querySelector('.cl-title');
        } else {
            this.inner = null;
            this.title = null;
        }
        this.series = [];
        this.currentId = null;
    }

    /**
     * 初始化章节列表
     * @param {Array} series - 章节数组 [{ id, name }, ...]
     * @param {string|number} currentId - 当前章节ID
     */
    init(series, currentId) {
        if (!this.container || !this.inner) {
            return;
        }
        this.series = series || [];
        this.currentId = currentId;
        this.render();
        this.addEvents();
    }

    /**
     * 渲染章节列表
     * - 如果 series 为空或只有1个章节，隐藏列表
     * - 否则渲染所有章节，高亮当前章节
     */
    render() {
        if (!this.series || this.series.length <= 1) {
            this.container.style.display = 'none';
            return;
        }
        this.container.style.display = 'block';
        this.inner.innerHTML = this.series
            .map((item, index) => {
                const isActive = String(item.id) === String(this.currentId);
                const label = item.name || `第${index + 1}章`;
                return `<div class="cl-item${isActive ? ' active' : ''}" data-id="${item.id}">${label}</div>`;
            })
            .join('');
    }

    /**
     * 添加点击事件：点击章节项跳转到对应章节
     */
    addEvents() {
        this.inner.addEventListener('click', (e) => {
            const item = e.target.closest('.cl-item');
            if (!item) {
                return;
            }
            const id = item.dataset.id;
            if (id && String(id) !== String(this.currentId)) {
                window.open(`./chapter.html?id=${id}`, '_self');
            }
        });
    }
}