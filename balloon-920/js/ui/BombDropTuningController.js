import {
    BOMB_DROP_TUNING_DEFAULTS,
    applyBombDropTuning,
    downloadBombDropTuningJson,
    getBombDropTuning,
    loadBombDropTuningFromJson,
    resetBombDropTuning,
    setBombDropTuning,
} from '../items/bombDropTuning.js';

/** 炸弹坠落轨迹/速度调试面板 */
export class BombDropTuningController {
    /**
     * @param {object} game
     */
    constructor(game) {
        this.game = game;
        this._fields = [
            { id: 'bombArcHeight', key: 'arcHeight', decimals: 0 },
            { id: 'bombArcSway', key: 'arcSway', decimals: 2 },
            { id: 'bombDropSpeed', key: 'dropSpeed', decimals: 0 },
            { id: 'bombMinDuration', key: 'minDurationSec', decimals: 2 },
            { id: 'bombMaxDuration', key: 'maxDurationSec', decimals: 2 },
            { id: 'bombEasePower', key: 'easePower', decimals: 1 },
            { id: 'bombTiltFactor', key: 'tiltFactor', decimals: 2 },
            { id: 'bombLandHold', key: 'landHoldSec', decimals: 2 },
        ];
        this._bindDom();
        this._syncUiFromTuning();
    }

    static async create(game) {
        await loadBombDropTuningFromJson();
        return new BombDropTuningController(game);
    }

    _bindDom() {
        for (const field of this._fields) {
            const input = document.getElementById(field.id);
            if (!input) continue;

            const onInput = () => {
                const val = Number(input.value);
                setBombDropTuning({ [field.key]: val });
                const tuned = getBombDropTuning()[field.key];
                if (String(input.value) !== String(tuned)) {
                    input.value = String(tuned);
                }
                this._setLabel(field.id, tuned, field.decimals);
            };

            input.addEventListener('input', onInput);
            input.addEventListener('change', onInput);
        }

        const resetBtn = document.getElementById('btnBombTuningReset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetBombDropTuning();
                this._syncUiFromTuning();
            });
        }

        const saveBtn = document.getElementById('btnBombTuningSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                downloadBombDropTuningJson('bombDropTuning.json');
            });
        }

        const reloadBtn = document.getElementById('btnBombTuningReload');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', async () => {
                await loadBombDropTuningFromJson();
                this._syncUiFromTuning();
            });
        }

        const importBtn = document.getElementById('btnBombTuningImport');
        const importInput = document.getElementById('bombTuningFileInput');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
        }
        if (importInput) {
            importInput.addEventListener('change', async () => {
                const file = importInput.files?.[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    applyBombDropTuning(JSON.parse(text));
                    this._syncUiFromTuning();
                } catch (err) {
                    console.warn('[bombDropTuning] 导入 JSON 失败', err);
                }
                importInput.value = '';
            });
        }
    }

    _syncUiFromTuning() {
        const tuning = getBombDropTuning();
        for (const field of this._fields) {
            const input = document.getElementById(field.id);
            if (!input) continue;
            const val = tuning[field.key];
            input.value = String(val);
            this._setLabel(field.id, val, field.decimals);
        }
    }

    /**
     * @param {string} inputId
     * @param {number} value
     * @param {number} decimals
     */
    _setLabel(inputId, value, decimals) {
        const label = document.getElementById(`${inputId}Val`);
        if (!label) return;
        const text = Number(value).toFixed(decimals);
        label.textContent = text;
    }

    static formatDefaultsHint() {
        const d = BOMB_DROP_TUNING_DEFAULTS;
        return `默认 弧高${d.arcHeight} 侧偏${d.arcSway}`;
    }
}