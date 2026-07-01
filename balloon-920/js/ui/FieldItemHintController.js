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

const POP_SEC = 0.16;
const SETTLE_SEC = 0.14;
const HOLD_STILL_SEC = 3;
const FLOAT_FADE_SEC = 1.05;
const BASE_FONT_PX = 26;
const PEAK_SCALE = 1.1;
const START_SCALE = 0.9;
const FLOAT_PX_PER_SEC = 40;
const ANCHOR_Y_RATIO = 0.26;

function hintTotalDuration() {
    return POP_SEC + SETTLE_SEC + HOLD_STILL_SEC + FLOAT_FADE_SEC;
}

function hintMoveStartAge() {
    return POP_SEC + SETTLE_SEC + HOLD_STILL_SEC;
}
/** 进入第 1 关后延迟再播提示 */
const LEVEL_ONE_INTRO_DELAY_SEC = 3;

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
            duration: hintTotalDuration(),
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
            const ease = 1 - (1 - u) ** 2;
            return START_SCALE + (PEAK_SCALE - START_SCALE) * ease;
        }
        if (age <= POP_SEC + SETTLE_SEC) {
            const settleT = (age - POP_SEC) / SETTLE_SEC;
            const ease = settleT ** 2;
            return PEAK_SCALE + (1 - PEAK_SCALE) * ease;
        }
        return 1;
    }

    _hintAlpha(age) {
        const moveStart = hintMoveStartAge();
        if (age < moveStart) return 1;
        const moveAge = age - moveStart;
        return Math.max(0, 1 - moveAge / FLOAT_FADE_SEC);
    }

    _hintY(baseY, age) {
        const moveStart = hintMoveStartAge();
        if (age < moveStart) return baseY;
        const moveAge = age - moveStart;
        return baseY - moveAge * FLOAT_PX_PER_SEC;
    }

    drawFieldItemHint(ctx) {
        if (!this.hint) return;
        const { text, age } = this.hint;
        const alpha = this._hintAlpha(age);
        if (alpha <= 0.001) return;

        const x = Config.width * 0.5;
        const baseY = Config.height * ANCHOR_Y_RATIO;
        const y = this._hintY(baseY, age);
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