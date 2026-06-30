import * as Config from '../config.js';

export const FIELD_ITEM_HINT_TEXT = {
    clown: '会复制很多气球',
    rainbow: '可以与任意颜色气球连爆',
    wall: '纯障碍物',
};

const HOLD_SEC = 3;
const FADE_SEC = 0.9;

/** 场地特殊道具点击说明（居中偏上，无玩法效果） */
export class FieldItemHintController {
    constructor(game) {
        this.game = game;
        /** @type {{ text: string, remaining: number } | null} */
        this.hint = null;
    }

    showFieldItemHint(text) {
        if (!text) return;
        this.hint = { text, remaining: HOLD_SEC + FADE_SEC };
    }

    clearFieldItemHint() {
        this.hint = null;
    }

    updateFieldItemHint(dt) {
        if (!this.hint) return;
        this.hint.remaining -= dt;
        if (this.hint.remaining <= 0) this.hint = null;
    }

    getAlpha() {
        if (!this.hint) return 0;
        if (this.hint.remaining > FADE_SEC) return 1;
        return Math.max(0, this.hint.remaining / FADE_SEC);
    }

    drawFieldItemHint(ctx) {
        const alpha = this.getAlpha();
        if (!this.hint || alpha <= 0.001) return;

        const x = Config.width * 0.5;
        const y = Config.height * 0.26;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '18px "ZCOOL KuaiLe", system-ui, sans-serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.96 * alpha})`;
        ctx.shadowColor = `rgba(0, 0, 0, ${0.45 * alpha})`;
        ctx.shadowBlur = 6;
        ctx.fillText(this.hint.text, x, y);
        ctx.restore();
    }
}