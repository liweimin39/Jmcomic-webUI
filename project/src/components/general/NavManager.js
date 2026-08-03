export class NavManager {
    mobileNavDom
    navDom
    pageListBtn
    mobNavInner
    searchForm
    searchInput
    constructor() {
        this.navDom = document.querySelector(".nav")
        this.mobileNavDom = document.querySelector(".mob-nav")
        this.pageListBtn = this.navDom.querySelector(".page-list-btn")
        this.mobNavInner = this.mobileNavDom.children[0]
        this.searchForm = this.navDom.querySelector(".search form")
        this.searchInput = this.searchForm.children[0]
    }
    init() {
        this.#addEvent()
        this.#updateUserNav() // 更新用户导航文字
    }
    #addEvent() {
        this.pageListBtn.addEventListener("click", () => {
            this.mobileNavDom.style.display = 'block'
            this.mobileNavDom.getBoundingClientRect()
            this.mobileNavDom.classList.add("show")
            this.mobileNavDom.ontransitionend = null
        })
        this.mobileNavDom.addEventListener("click", (e) => {
            if (e.target === this.mobileNavDom) {
                this.mobileNavDom.classList.remove("show")
                this.mobileNavDom.ontransitionend = () => this.mobileNavDom.style.display = 'none'
            }
        })
        this.searchForm.addEventListener("submit", (e) => {
            e.preventDefault()
            let value = this.searchInput.value
            if (value.trim() === "") return
            open(`./search.html?sq=${value}`, "search_page")
        })
    }
    // 新增：根据登录状态更新导航中的用户链接文字
    #updateUserNav() {
        const userLinks = document.querySelectorAll('.user-nav-link');
        const userInfo = localStorage.getItem('userInfo');
        const username = userInfo ? JSON.parse(userInfo).username : '登录';
        userLinks.forEach(link => {
            const span = link.querySelector('span');
            if (span) span.textContent = username;
        });
    }
}