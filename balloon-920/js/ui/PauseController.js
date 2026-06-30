/** 暂停界面：继续 / 重新开始（非启动页） */
export class PauseController {
    constructor(game) {
        this.game = game;
    }

    showPauseScreen() {
        const game = this.game;
        game.appScreen = 'pause';
        if (game.dom.startScreenEl) game.dom.startScreenEl.classList.remove('hidden');
        if (game.dom.btnStartPrimary) game.dom.btnStartPrimary.textContent = '继续';
        game.pointerDown = false;
        game.activeInflateBall = null;
        game.dragNode = null;
        game.pendingDragParticle = null;
    }

    hidePauseScreen() {
        const game = this.game;
        game.appScreen = 'game';
        if (game.dom.startScreenEl) game.dom.startScreenEl.classList.add('hidden');
    }

    /** 从暂停恢复，不重新加载关卡 */
    resumeGame() {
        const game = this.game;
        game.hidePauseScreen();
        game.sfx.resume();
    }

    /** 首次进入或刷新：直接进游戏，不显示暂停层 */
    bootstrapGame(levelIndex) {
        const game = this.game;
        game.hidePauseScreen();
        game.sfx.resume();
        game.loadLevelImmediate(Math.max(0, levelIndex));
        game.saveProgress();
        game.sfx.autoplayBgm();
    }

    restartFromPause() {
        const game = this.game;
        game.clearProgress();
        game.hidePauseScreen();
        game.sfx.resume();
        game.loadLevelImmediate(0);
        game.saveProgress();
        game.sfx.autoplayBgm();
    }

    togglePause() {
        const game = this.game;
        if (game.appScreen === 'pause') {
            game.resumeGame();
            return;
        }
        if (game.appScreen !== 'game') return;
        if (game.gameOutcome !== 'playing') return;
        game.showPauseScreen();
    }
}