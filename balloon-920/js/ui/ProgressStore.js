import * as Config from '../config.js';

/** ProgressStore */
export class ProgressStore {
    constructor(game) {
        this.game = game;
    }

    loadProgress() {
        const game = this.game;
            try {
                const raw = localStorage.getItem(Config.SAVE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (data && typeof data.levelIndex === 'number' && data.levelIndex >= 0) {
                    return data;
                }
            } catch (_) { /* ignore */ }
            return null;
    }

    saveProgress() {
        const game = this.game;
            if (game.testLevelId) return;
            try {
                localStorage.setItem(Config.SAVE_KEY, JSON.stringify({
                    levelIndex: game.levelIndex,
                    savedAt: Date.now()
                }));
            } catch (_) { /* ignore */ }
    }

    clearProgress() {
        const game = this.game;
            try {
                localStorage.removeItem(Config.SAVE_KEY);
            } catch (_) { /* ignore */ }
    }

}
