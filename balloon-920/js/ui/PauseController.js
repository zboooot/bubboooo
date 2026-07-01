/** 启动页与暂停层（共用 #startScreen） */
export class PauseController {
    constructor(game) {
        this.game = game;
    }

    updateStartMenuUI() {
        const game = this.game;
        if (!game.dom.btnStartPrimary) return;
        game.dom.btnStartPrimary.textContent = game.loadProgress() ? '继续' : '开始游戏';
    }

    showStartScreen() {
        const game = this.game;
        game.appScreen = 'start';
        if (game.dom.startScreenEl) game.dom.startScreenEl.classList.remove('hidden');
        this.updateStartMenuUI();
        game.pointerDown = false;
        game.activeInflateBall = null;
        game.dragNode = null;
        game.pendingDragParticle = null;
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

    /** 从启动页进入游戏 */
    enterGame(levelIndex) {
        const game = this.game;
        game.hidePauseScreen();
        game.sfx.resume();
        game.loadLevelImmediate(Math.max(0, levelIndex));
        game.saveProgress();
        game.sfx.autoplayBgm();
    }

    /** URL 指定关卡等：跳过启动页直接进关 */
    bootstrapGame(levelIndex) {
        this.enterGame(levelIndex);
    }

    /** 独立测试关入口，不读写主线存档 */
    bootstrapTestLevel(testLevelId) {
        const game = this.game;
        game.testLevelId = testLevelId;
        game.hidePauseScreen();
        game.sfx.resume();
        game.loadTestLevel(testLevelId);
        game.sfx.autoplayBgm();
    }

    restartFromPause() {
        const game = this.game;
        game.hidePauseScreen();
        game.sfx.resume();
        if (game.testLevelId) {
            game.loadTestLevel(game.testLevelId);
            return;
        }
        game.clearProgress();
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