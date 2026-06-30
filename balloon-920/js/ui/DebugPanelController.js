import { DEFAULT_TEST_LAB } from '../level/testLabLevel.js';

/** 右侧参数面板 + 测试关卡 */
export class DebugPanelController {
    constructor(game) {
        this.game = game;
        this.params = { ...DEFAULT_TEST_LAB };
        this._bindDom();
        this._syncInputsFromParams();
    }

    _bindDom() {
        const d = this.game.dom;
        const btn = d.btnOpenTestLab;
        if (btn) {
            btn.addEventListener('click', () => this.openTestLevel());
        }
        if (d.btnRestartNormalGame) {
            d.btnRestartNormalGame.addEventListener('click', () => this.startNormalGame());
        }
        const fields = [
            ['testBalloonCount', 'balloonCount', 'number'],
            ['testClownCount', 'clownCount', 'number'],
            ['testCopyMin', 'clownCopyMin', 'number'],
            ['testCopyMax', 'clownCopyMax', 'number'],
            ['testTeamCount', 'teamCount', 'number'],
            ['testTetrisCount', 'tetrisWallCount', 'number'],
            ['testRainbowCount', 'rainbowCount', 'number'],
            ['testItemMode', 'itemMode', 'string'],
        ];
        for (const [id, key, type] of fields) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener('change', () => {
                if (type === 'number') {
                    this.params[key] = Math.max(0, Number(el.value) || 0);
                } else {
                    this.params[key] = el.value;
                }
            });
        }
    }

    _syncInputsFromParams() {
        const map = {
            testBalloonCount: this.params.balloonCount,
            testClownCount: this.params.clownCount,
            testCopyMin: this.params.clownCopyMin,
            testCopyMax: this.params.clownCopyMax,
            testTeamCount: this.params.teamCount,
            testTetrisCount: this.params.tetrisWallCount,
            testRainbowCount: this.params.rainbowCount,
            testItemMode: this.params.itemMode,
        };
        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.value = String(val);
        }
    }

    readParamsFromDom() {
        const ids = {
            testBalloonCount: 'balloonCount',
            testClownCount: 'clownCount',
            testCopyMin: 'clownCopyMin',
            testCopyMax: 'clownCopyMax',
            testTeamCount: 'teamCount',
            testTetrisCount: 'tetrisWallCount',
            testRainbowCount: 'rainbowCount',
            testItemMode: 'itemMode',
        };
        for (const [id, key] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (key === 'itemMode') this.params[key] = el.value;
            else this.params[key] = Math.max(0, Number(el.value) || 0);
        }
        if (this.params.clownCopyMax < this.params.clownCopyMin) {
            this.params.clownCopyMax = this.params.clownCopyMin;
        }
        return { ...this.params };
    }

    openTestLevel() {
        const params = this.readParamsFromDom();
        this.game.lastTestLabParams = params;
        this.game.appScreen = 'game';
        if (this.game.dom.startScreenEl) {
            this.game.dom.startScreenEl.classList.add('hidden');
        }
        this.game.loadTestLabLevel(params);
        this.game.sfx.resume();
        this.game.sfx.autoplayBgm();
    }

    startNormalGame() {
        this.game.lastTestLabParams = null;
        this.game.appScreen = 'game';
        if (this.game.dom.startScreenEl) {
            this.game.dom.startScreenEl.classList.add('hidden');
        }
        this.game.restartFromPause();
    }
}