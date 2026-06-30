import * as Config from '../config.js';
import { getItemDef } from './itemTypes.js';

/**
 * 爆炸类道具揭晓：爆破点停留 → 暗屏 + 飞镖移至中央 → 淡出 → 触发效果
 */
export class ItemRevealPresentation {
    /**
     * @param {object} opts
     * @param {string} opts.itemId
     * @param {number} opts.anchorX 爆破点 X
     * @param {number} opts.anchorY 爆破点 Y
     * @param {object} opts.pendingOpts 揭晓结束后传给效果逻辑
     */
    constructor({ itemId, anchorX, anchorY, pendingOpts = {} }) {
        this.itemId = itemId;
        this.anchorX = anchorX;
        this.anchorY = anchorY;
        this.pendingOpts = pendingOpts;
        this.def = getItemDef(itemId);
        this.centerX = Config.width * 0.5;
        this.centerY = Config.GROUND_Y * 0.44;
        /** @type {'anchor_hold' | 'hold' | 'fade'} */
        this.phase = 'anchor_hold';
        this.anchorHoldRemaining = Config.ITEM_REVEAL_ANCHOR_HOLD_SEC;
        this.holdRemaining = Config.ITEM_REVEAL_HOLD_SEC;
        this.fadeRemaining = Config.ITEM_REVEAL_FADE_SEC;
        this.moveElapsed = 0;
        this.spin = Math.random() * Math.PI * 2;
        this.pulse = 0;
    }

    /**
     * @param {number} dt
     * @returns {'complete'|null}
     */
    update(dt) {
        this.spin += dt * 5.5;
        this.pulse += dt * 6;

        if (this.phase === 'anchor_hold') {
            this.anchorHoldRemaining -= dt;
            if (this.anchorHoldRemaining <= 0) {
                this.phase = 'hold';
                this.moveElapsed = 0;
            }
            return null;
        }

        this.moveElapsed = Math.min(
            Config.ITEM_REVEAL_MOVE_SEC,
            this.moveElapsed + dt
        );

        if (this.phase === 'hold') {
            this.holdRemaining -= dt;
            if (this.holdRemaining <= 0) this.phase = 'fade';
            return null;
        }

        this.fadeRemaining -= dt;
        return this.fadeRemaining <= 0 ? 'complete' : null;
    }

    get overlayAlpha() {
        if (this.phase === 'anchor_hold') return 0;
        if (this.phase === 'hold') return 1;
        return Math.max(0, this.fadeRemaining / Config.ITEM_REVEAL_FADE_SEC);
    }

    get moveT() {
        if (this.phase === 'anchor_hold') return 0;
        const raw = this.moveElapsed / Config.ITEM_REVEAL_MOVE_SEC;
        return ItemRevealPresentation._easeOutCubic(Math.min(1, raw));
    }

    get iconX() {
        return this.anchorX + (this.centerX - this.anchorX) * this.moveT;
    }

    get iconY() {
        return this.anchorY + (this.centerY - this.anchorY) * this.moveT;
    }

    get anchorHoldT() {
        const total = Config.ITEM_REVEAL_ANCHOR_HOLD_SEC;
        if (total <= 0) return 1;
        return 1 - Math.max(0, this.anchorHoldRemaining) / total;
    }

    get iconScale() {
        const breathe = 1 + Math.sin(this.pulse) * 0.06;
        if (this.phase === 'anchor_hold') {
            const popIn = ItemRevealPresentation._easeOutBack(Math.min(1, this.anchorHoldT * 1.35));
            return breathe * (0.72 + popIn * 0.38);
        }
        const travelScale = 0.42 + this.moveT * 0.58;
        if (this.phase === 'hold') return breathe * travelScale;
        const t = 1 - this.overlayAlpha;
        return breathe * (1 + t * 0.12);
    }

    get centerRevealT() {
        return ItemRevealPresentation._easeOutCubic(
            Math.max(0, (this.moveT - 0.45) / 0.55)
        );
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} game
     */
    draw(ctx, game) {
        void game;
        const accent = this.def?.accentColor ?? '#38bdf8';
        const name = this.def?.name ?? '道具';

        if (this.phase === 'anchor_hold') {
            this._drawAnchorHold(ctx, accent);
            return;
        }

        const alpha = this.overlayAlpha;
        if (alpha <= 0.001) return;

        const centerGlow = this.centerRevealT;

        ctx.save();

        ctx.fillStyle = `rgba(4, 6, 16, ${0.86 * alpha})`;
        ctx.fillRect(0, 0, Config.width, Config.height);

        if (centerGlow > 0.01) {
            const glowPulse = 0.82 + Math.sin(this.pulse * 1.4) * 0.18;
            const glowR = 118 * this.iconScale * glowPulse;
            const glow = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, glowR
            );
            glow.addColorStop(0, ItemRevealPresentation._hexToRgba(accent, 0.55 * alpha * centerGlow));
            glow.addColorStop(0.35, ItemRevealPresentation._hexToRgba(accent, 0.22 * alpha * centerGlow));
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, glowR, 0, Math.PI * 2);
            ctx.fill();

            const ringR = 54 * this.iconScale;
            ctx.strokeStyle = ItemRevealPresentation._hexToRgba(accent, 0.35 * alpha * centerGlow);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.iconX, this.iconY);
        ctx.rotate(this.spin);
        ctx.scale(this.iconScale, this.iconScale);
        ItemRevealPresentation._drawShurikenIcon(ctx, 28, accent, alpha);
        ctx.restore();

        if (centerGlow > 0.2) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 24px "ZCOOL KuaiLe", system-ui, sans-serif';
            ctx.fillStyle = `rgba(255, 255, 255, ${0.96 * alpha * centerGlow})`;
            ctx.fillText(name, this.centerX, this.centerY + 78);
        }

        ctx.restore();
    }

    _drawAnchorHold(ctx, accent) {
        const holdT = this.anchorHoldT;
        const pulse = 0.82 + Math.sin(this.pulse * 1.6) * 0.18;
        const vignetteA = 0.18 + holdT * 0.28;

        ctx.save();

        const vignette = ctx.createRadialGradient(
            this.anchorX, this.anchorY, 12,
            this.anchorX, this.anchorY, Config.width * 0.72
        );
        vignette.addColorStop(0, `rgba(4, 6, 16, ${vignetteA * 0.35})`);
        vignette.addColorStop(0.42, `rgba(4, 6, 16, ${vignetteA * 0.72})`);
        vignette.addColorStop(1, `rgba(4, 6, 16, ${vignetteA})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, Config.width, Config.height);

        for (let i = 0; i < 3; i++) {
            const wave = (holdT * 1.15 + i * 0.28) % 1;
            const ringA = (1 - wave) * 0.55 * pulse;
            if (ringA <= 0.02) continue;
            const ringR = 18 + wave * 92;
            ctx.strokeStyle = ItemRevealPresentation._hexToRgba(accent, ringA);
            ctx.lineWidth = 2.5 - i * 0.5;
            ctx.beginPath();
            ctx.arc(this.anchorX, this.anchorY, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        const glowR = (52 + holdT * 28) * pulse;
        const glow = ctx.createRadialGradient(
            this.anchorX, this.anchorY, 0,
            this.anchorX, this.anchorY, glowR
        );
        glow.addColorStop(0, ItemRevealPresentation._hexToRgba(accent, 0.72 * pulse));
        glow.addColorStop(0.45, ItemRevealPresentation._hexToRgba(accent, 0.28 * pulse));
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.anchorX, this.anchorY, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(this.anchorX, this.anchorY);
        ctx.rotate(this.spin);
        ctx.scale(this.iconScale, this.iconScale);
        ItemRevealPresentation._drawShurikenIcon(ctx, 34, accent, 1);
        ctx.restore();
    }

    static _easeOutCubic(t) {
        return 1 - (1 - t) ** 3;
    }

    static _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }

    static _hexToRgba(hex, a) {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    static _drawShurikenIcon(ctx, size, accent, alpha) {
        ctx.shadowColor = ItemRevealPresentation._hexToRgba(accent, 0.75 * alpha);
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = ItemRevealPresentation._hexToRgba(accent, 0.95 * alpha);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const bx = Math.cos(a) * size * 0.35;
            const by = Math.sin(a) * size * 0.35;
            const tipX = Math.cos(a) * size;
            const tipY = Math.sin(a) * size;
            const wing = size * 0.42;
            const wingA1 = a + Math.PI * 0.42;
            const wingA2 = a - Math.PI * 0.42;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(bx + Math.cos(wingA1) * wing, by + Math.sin(wingA1) * wing);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + Math.cos(wingA2) * wing, by + Math.sin(wingA2) * wing);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = ItemRevealPresentation._hexToRgba(accent, 0.9 * alpha);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2);
        ctx.fill();
    }
}