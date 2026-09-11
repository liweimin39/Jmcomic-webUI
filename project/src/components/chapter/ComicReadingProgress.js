export class ComicReadingProgress {
    progressCrDom;
    progressDom;
    progressInnerDom;
    jmnianHotImage;
    maxIndex;
    comicImageCr;

    // 拖拽状态（用实例属性，避免每次 addMouseEvent 闭包残留）
    #isDragging = false;
    #dragIndex = 0;
    // 绑定的 move/up 处理器引用，便于动态挂载与移除
    #boundTouchMove = null;

    constructor() {
        this.progressCrDom = document.querySelector(".progress-cr");
        this.progressDom = this.progressCrDom.querySelector(".progress");
        this.progressInnerDom =
            this.progressCrDom.querySelector(".progress-inner");
        this.jmnianHotImage = this.progressCrDom.querySelector(".jmnian-hot");
        this.comicImageCr = document.querySelector(".comic-img-cr");
    }

    init(maxIndex) {
        this.maxIndex = maxIndex;
        this.addMouseEvent();
    }

    /**
     * 统一：根据客户端 Y 坐标计算对应的图片索引
     * 使用 getBoundingClientRect 保证在 fixed 定位、页面滚动时都正确
     */
    #getIndexFromClientY(clientY) {
        if (!this.progressDom || this.maxIndex <= 0) return 0;
        const rect = this.progressDom.getBoundingClientRect();
        if (rect.height === 0) return 0;
        let idx = Math.floor(
            ((clientY - rect.top) / rect.height) * this.maxIndex,
        );
        if (idx < 0) idx = 0;
        if (idx > this.maxIndex) idx = this.maxIndex;
        return idx;
    }

    addMouseEvent() {
        // ============ 桌面端：鼠标 ============
        this.progressDom.addEventListener("mousedown", (e) => {
            this.#isDragging = true;
            this.#dragIndex = this.#getIndexFromClientY(e.clientY);
            this.setProgress(this.#dragIndex);
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (!this.#isDragging) return;
            this.#dragIndex = this.#getIndexFromClientY(e.clientY);
            this.setProgress(this.#dragIndex);
        });

        window.addEventListener("mouseup", () => {
            if (!this.#isDragging) return;
            this.jumpTo(this.#dragIndex);
            this.#isDragging = false;
        });

        // ============ 移动端：触摸 ============
        // touchmove 挂在 window 上，手指滑出进度条范围也不中断；
        // 但仅在 touchstart 期间挂载，touchend 时立即移除，
        // 避免长驻 window 的 passive:false 监听器阻止整页滚动。
        this.#boundTouchMove = (e) => {
            if (!this.#isDragging) return;
            const touch = e.touches[0];
            if (!touch) return;
            this.#dragIndex = this.#getIndexFromClientY(touch.clientY);
            this.setProgress(this.#dragIndex);
            e.preventDefault();
        };

        this.progressDom.addEventListener(
            "touchstart",
            (e) => {
                const touch = e.touches[0];
                if (!touch) return;
                this.#isDragging = true;
                this.#dragIndex = this.#getIndexFromClientY(touch.clientY);
                this.setProgress(this.#dragIndex);
                e.preventDefault();

                window.addEventListener(
                    "touchmove",
                    this.#boundTouchMove,
                    { passive: false },
                );
                window.addEventListener(
                    "touchend",
                    this.#onTouchEnd,
                    { passive: true },
                );
                window.addEventListener(
                    "touchcancel",
                    this.#onTouchEnd,
                    { passive: true },
                );
            },
            { passive: false },
        );
    }

    /**
     * touchend / touchcancel 统一处理
     * 用箭头函数绑定为实例属性，保证 addEventListener / removeEventListener 引用一致
     */
    #onTouchEnd = () => {
        if (!this.#isDragging) return;
        this.jumpTo(this.#dragIndex);
        this.#isDragging = false;
        window.removeEventListener("touchmove", this.#boundTouchMove);
        window.removeEventListener("touchend", this.#onTouchEnd);
        window.removeEventListener("touchcancel", this.#onTouchEnd);
    };

    setProgress(index) {
        if (this.maxIndex <= 0) return;
        this.progressInnerDom.style.height =
            index * (this.progressDom.offsetHeight / this.maxIndex) + "px";
        if (this.progressInnerDom.children[0]) {
            this.progressInnerDom.children[0].textContent = `←${index + 1}`;
        }
        let opacity = index / this.maxIndex;
        if (this.jmnianHotImage) {
            this.jmnianHotImage.style.opacity = opacity;
        }
    }

    jumpTo(index) {
        const target = this.comicImageCr.children[index];
        if (target) {
            target.scrollIntoView();
        }
    }
}