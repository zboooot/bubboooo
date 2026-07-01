import * as Config from '../config.js';

export const FIELD_ITEM_HINT_TEXT = {
    clown: '会复制很多气球',
    rainbow: '可以与任意颜色气球连爆',
    wall: '纯障碍物',
};

/** 点击底部气筒区（无玩法，仅说明） */
export const PUMP_DOCK_HINT_TEXT = '按住泡泡撑爆他';

/** 第一关进入时默认说明 */
export const LEVEL_ONE_BALLOON_HINT_TEXT = '泡泡数字表示还需要多少会爆';

const HOLD_SEC = 2.4;
const FADE_SEC = 1.1;
const POP_SEC = 0.24;
const SETTLE_SEC = 0.38;
const BASE_FONT_PX = 26;
const PEAK_SCALE = 1.28;
const START_SCALE = 0.72;
const FLOAT_PX_PER_SEC = 36;
const ANCHOR_Y_RATIO = 0.26;
/** 进入第 1 关后延迟再播提示 */
const LEVEL_ONE_INTRO_DELAY_SEC = 2;

/** 场地特殊道具 / 气筒区点击说明（居中偏上，无玩法效果） */
export class FieldItemHintController {
    constructor(game) {
        this.game = game;
        /** @type {{ text: string, age: number, duration: number } | null} */
        this.hint = null;
        /** @type {number | null} 第 1 关引导倒计时（秒） */
        this.levelOneIntroDelay = null;
    }

    showFieldItemHint(text) {
        if (!text) return;
        this.hint = {
            text,
            age: 0,
            duration: HOLD_SEC + FADE_SEC,
        };
    }

    _canScheduleLevelOneIntro() {
        const game = this.game;
        return !game.testLevelId
            && game.levelIndex === 0
            && game.appScreen === 'game'
            && game.gameOutcome === 'playing';
    }

    cancelLevelOneIntroSchedule() {
        this.levelOneIntroDelay = null;
    }

    /** 主线第 1 关：延迟后自动提示气球数字含义 */
    showLevelOneIntroHintIfNeeded() {
        this.cancelLevelOneIntroSchedule();
        if (!this._canScheduleLevelOneIntro()) return;
        this.levelOneIntroDelay = LEVEL_ONE_INTRO_DELAY_SEC;
    }

    clearFieldItemHint() {
        this.hint = null;
        this.cancelLevelOneIntroSchedule();
    }

    updateFieldItemHint(dt) {
        if (this.levelOneIntroDelay != null) {
            if (!this._canScheduleLevelOneIntro()) {
                this.cancelLevelOneIntroSchedule();
            } else {
                this.levelOneIntroDelay -= dt;
                if (this.levelOneIntroDelay <= 0) {
                    this.levelOneIntroDelay = null;
                    this.showFieldItemHint(LEVEL_ONE_BALLOON_HINT_TEXT);
                }
            }
        }

        if (!this.hint) return;
        this.hint.age += dt;
        if (this.hint.age >= this.hint.duration) this.hint = null;
    }

    _hintScale(age) {
        if (age <= POP_SEC) {
            const u = age / POP_SEC;
            const ease = 1 - (1 - u) ** 3;
            return START_SCALE + (PEAK_SCALE - START_SCALE) * ease;
        }
        const settleT = Math.min(1, (age - POP_SEC) / SETTLE_SEC);
        const ease = 1 - (1 - settleT) ** 2;
        return PEAK_SCALE + (1 - PEAK_SCALE) * ease;
    }

    _hintAlpha(age, duration) {
        const fadeStart = duration - FADE_SEC;
        if (age < fadeStart) return 1;
        return Math.max(0, 1 - (age - fadeStart) / FADE_SEC);
    }

    drawFieldItemHint(ctx) {
        if (!this.hint) return;
        const { text, age, duration } = this.hint;
        const alpha = this._hintAlpha(age, duration);
        if (alpha <= 0.001) return;

        const x = Config.width * 0.5;
        const baseY = Config.height * ANCHOR_Y_RATIO;
        const y = baseY - age * FLOAT_PX_PER_SEC;
        const scale = this._hintScale(age);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${BASE_FONT_PX}px "ZCOOL KuaiLe", system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * alpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.38 * alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(0, 0, 0, ${0.5 * alpha})`;
        ctx.shadowBlur = 8;
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
}