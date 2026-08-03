import { jmApi } from "../api/JmcomicApi.js";
import { ComicImageManager } from "../components/chapter/ComicImageManager.js";
import { CommentManager } from "../components/chapter/CommentManager.js";
import { HeadManager } from "../components/chapter/HeadManager.js";
import { RecommendationsComicManager } from "../components/chapter/RecommendedComicsManager.js";
import { ChapterListManager } from "../components/chapter/ChapterListManager.js";
import { ChapterActionManager } from "../components/chapter/ChapterActionManager.js";
import { NavManager } from "../components/general/NavManager.js";
import { setting } from "../components/general/Setting.js";
import { SwitchServerBtnManager } from "../components/general/SwitchServerBtnManager.js";

class ChapterPage {
    constructor() {
        this.id = null;
        this.comicImageManager = null;
        this.commentManager = null;
        this.headManager = null;
        this.recommendedComicsManager = null;
        this.navManager = null;
        this.switchServerBtnManager = null;
        this.chapterListManager = null;
        this.chapterActionManager = null;
    }
    
    async init() {
        var id = new URLSearchParams(location.search).get("id");
        if (typeof id !== "string" || isNaN(+id)) {
            throw new Error("ID is not true");
        }
        
        this.id = id;
        setting.init();
        await jmApi.init();
        
        var self = this;
        
        jmApi.getComicAlbum(this.id).then(function(album) {
            console.log(album);
            self.headManager = new HeadManager();
            self.headManager.init(album);
            
            self.commentManager = new CommentManager();
            self.commentManager.init(album);
            
            self.recommendedComicsManager = new RecommendationsComicManager();
            self.recommendedComicsManager.init(album);

            self.chapterActionManager = new ChapterActionManager();
            self.chapterActionManager.init(self.id);
        });
        
        jmApi.getComicChapter(this.id).then(function(chapter) {
            console.log(chapter);
            self.comicImageManager = new ComicImageManager();
            self.comicImageManager.init(chapter);
            
            self.chapterListManager = new ChapterListManager();
            self.chapterListManager.init(chapter.series, self.id);
        });
        
        this.navManager = new NavManager();
        this.switchServerBtnManager = new SwitchServerBtnManager();
        this.navManager.init();
        this.switchServerBtnManager.init();
    }
}

var app = new ChapterPage();
app.init();