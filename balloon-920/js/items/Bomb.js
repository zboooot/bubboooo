import * as Config from '../config.js';
import { getBombDropTuning } from './bombDropTuning.js';
import { drawBombIcon, drawExplosionBurstIcon } from './BombIcon.js';

let _nextBombUid = 1;

/**
 * 炸弹：揭晓后从屏幕中央弧线坠落至随机落点，停留后范围爆破气球。
 */
export class Bomb {
    /**
     * @param {object} opts
     * @param {number} opts.targetX
     * @param {number} opts.targetY
     * @param {number} opts.radius 爆炸半径
     * @param {number} [opts.startX]
     * @param {number} [opts.startY]
     */
    constructor({ targetX, targetY, radius, startX, startY } = {}) {
        this.uid = _nextBombUid++;
        if (targetX == null || targetY == null) {
            throw new Error('Bomb requires a validated drop target');
        }
        this.targetX = targetX;
        this.targetY = targetY;
        this.startX = startX ?? Config.BOMB_REVEAL_CENTER_X;
        this.startY = startY ?? Config.BOMB_REVEAL_CENTER_Y;
        this.radius = radius ?? Config.BOMB_DEFAULT_EXPLOSION_RADIUS;
        this.x = this.startX;
        this.y = this.startY;
        /** @type {'dropping' | 'holding' | 'exploding' | 'done'} */
        this.phase = 'dropping';
        this.dropElapsed = 0;
        this.holdElapsed = 0;
        this.explodeElapsed = 0;
        this.explodePulsePhase = 0;
        this.alive = true;
        this.popped = false;
        this.wobble = Math.random() * Math.PI * 2;
        this.tilt = 0;
        this.prevX = this.x;
        this.prevY = this.y;

        const traj = Bomb._computeArcTrajectory(
            this.startX,
            this.startY,
            this.targetX,
            this.targetY
        );
        this._arcCtrlX = traj.ctrlX;
        this._arcCtrlY = traj.ctrlY;
        this._dropDuration = traj.duration;
    }

    static _computeArcTrajectory(startX, startY, targetX, targetY) {
        const tune = getBombDropTuning();
        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.hypot(dx, dy) || 1;

        let duration = dist / tune.dropSpeed;
        duration = Math.max(
            tune.minDurationSec,
            Math.min(tune.maxDurationSec, duration)
        );

        const ctrlX = (startX + targetX) * 0.5 + dx * tune.arcSway;
        const ctrlY = (startY + targetY) * 0.5 - tune.arcHeight;

        return { ctrlX, ctrlY, duration };
    }

    static _easeDropProgress(rawT, power) {
        const t = Math.max(0, Math.min(1, rawT));
        return t ** power;
    }

    static _bezierPoint(u, x0, y0, cx, cy, x2, y2) {
        const inv = 1 - u;
        return {
            x: inv * inv * x0 + 2 * inv * u * cx + u * u * x2,
            y: inv * inv * y0 + 2 * inv * u * cy + u * u * y2,
        };
    }

    static _bezierTangent(u, x0, y0, cx, cy, x2, y2) {
        const inv = 1 - u;
        return {
            x: 2 * inv * (cx - x0) + 2 * u * (x2 - cx),
            y: 2 * inv * (cy - y0) + 2 * u * (y2 - cy),
        };
    }

    get fuseLength() {
        if (this.phase === 'holding') {
            const holdSec = getBombDropTuning().landHoldSec;
            if (holdSec <= 0) return 0;
            return Math.max(0, 1 - this.holdElapsed / holdSec);
        }
        return 1;
    }

    /**
     * 在气球群包围盒内随机选落点，优先覆盖更多气球。
     * @param {object} game
     * @param {object} [opts]
     * @param {object} [opts.excludeBall]
     * @returns {{ x: number, y: number }|null}
     */
    static pickDropTarget(game, opts = {}) {
        const exclude = opts.excludeBall ?? null;
        const balls = game.balls.filter((b) => b !== exclude && b.air > 0);
        if (!balls.length) return null;

        for (const ball of balls) game.syncBallBounds(ball);

        const bounds = Bomb._clusterBounds(balls);
        const padX = Config.BALLOON_FIELD_PAD_X;
        const minX = Math.max(padX, bounds.left);
        const maxX = Math.min(Config.width - padX, bounds.right);
        const minY = Math.max(Config.BALLOON_FIELD_PAD_TOP, bounds.top);
        const maxY = Math.min(Config.GROUND_Y - 24, bounds.bottom);
        if (minX >= maxX || minY >= maxY) return null;

        const candidates = [];

        for (let i = 0; i < 16; i++) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            const hitCount = Bomb._countHitsAt(x, y, balls, opts.radius);
            if (hitCount > 0) candidates.push({ x, y, hitCount });
        }

        for (const ball of balls) {
            const hitCount = Bomb._countHitsAt(ball.cx, ball.cy, balls, opts.radius);
            if (hitCount > 0) candidates.push({ x: ball.cx, y: ball.cy, hitCount });
        }

        if (!candidates.length) {
            const fallback = balls[Math.floor(Math.random() * balls.length)];
            return { x: fallback.cx, y: fallback.cy };
        }

        let best = 0;
        for (const c of candidates) best = Math.max(best, c.hitCount);
        const tier = candidates.filter((c) => c.hitCount === best);
        const pick = tier[Math.floor(Math.random() * tier.length)];
        return { x: pick.x, y: pick.y };
    }

    static _clusterBounds(balls) {
        let left = Infinity;
        let right = -Infinity;
        let top = Infinity;
        let bottom = -Infinity;
        for (const ball of balls) {
            left = Math.min(left, ball.cx - ball.boundsRadius);
            right = Math.max(right, ball.cx + ball.boundsRadius);
            top = Math.min(top, ball.cy - ball.boundsRadius);
            bottom = Math.max(bottom, ball.cy + ball.boundsRadius);
        }
        return { left, right, top, bottom };
    }

    static _countHitsAt(x, y, balls, radius) {
        const blastRadius = radius ?? Config.BOMB_DEFAULT_EXPLOSION_RADIUS;
        let count = 0;
        for (const ball of balls) {
            const dist = Math.hypot(x - ball.cx, y - ball.cy);
            if (dist <= blastRadius + ball.boundsRadius) count++;
        }
        return count;
    }

    /**
     * @param {number} dt
     * @param {object} game
     */
    update(dt, game) {
        if (!this.alive) return;

        this.wobble += dt * 9;

        if (this.phase === 'dropping') {
            this.dropElapsed += dt;
            const tune = getBombDropTuning();
            const rawT = Math.min(1, this.dropElapsed / this._dropDuration);
            const u = Bomb._easeDropProgress(rawT, tune.easePower);
            const pos = Bomb._bezierPoint(
                u,
                this.startX,
                this.startY,
                this._arcCtrlX,
                this._arcCtrlY,
                this.targetX,
                this.targetY
            );

            this.prevX = this.x;
            this.prevY = this.y;
            this.x = pos.x;
            this.y = pos.y;

            const tan = Bomb._bezierTangent(
                u,
                this.startX,
                this.startY,
                this._arcCtrlX,
                this._arcCtrlY,
                this.targetX,
                this.targetY
            );
            this.tilt = Math.atan2(tan.y, tan.x || 0.001) * tune.tiltFactor;

            if (this.dropElapsed >= this._dropDuration) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.tilt = 0;
                this.phase = 'holding';
                this.holdElapsed = 0;
            }
            return;
        }

        if (this.phase === 'holding') {
            this.x = this.targetX;
            this.y = this.targetY;
            this.tilt = Math.sin(this.wobble * 1.4) * 0.04;
            this.holdElapsed += dt;
            if (this.holdElapsed >= getBombDropTuning().landHoldSec) {
                this.phase = 'exploding';
                this.explodeElapsed = 0;
                this._popBallsInRadius(game);
            }
            return;
        }

        if (this.phase === 'exploding') {
            this.explodeElapsed += dt;
            this.explodePulsePhase += dt * Config.BOMB_EXPLODE_PULSE_HZ * Math.PI * 2;
            if (this.explodeElapsed >= Config.BOMB_EXPLODE_HOLD_SEC) {
                this.phase = 'done';
                this.alive = false;
            }
        }
    }

    get explodeProgress() {
        return Math.min(1, this.explodeElapsed / Config.BOMB_EXPLODE_HOLD_SEC);
    }

    get explodePulseScale() {
        const wave = 0.5 + 0.5 * Math.sin(this.explodePulsePhase);
        const min = Config.BOMB_EXPLODE_ICON_MIN_SCALE;
        const max = Config.BOMB_EXPLODE_ICON_MAX_SCALE;
        const envelope = 1 - this.explodeProgress * 0.35;
        return (min + (max - min) * wave) * envelope;
    }

    get explodeIconAlpha() {
        const fade = 1 - this.explodeProgress * 0.55;
        const flicker = 0.88 + 0.12 * Math.sin(this.explodePulsePhase * 1.6);
        return fade * flicker;
    }

    _popBallsInRadius(game) {
        if (this.popped) return;
        this.popped = true;

        for (let i = game.balls.length - 1; i >= 0; i--) {
            const ball = game.balls[i];
            game.syncBallBounds(ball);
            const dist = Math.hypot(this.targetX - ball.cx, this.targetY - ball.cy);
            if (dist > this.radius + ball.boundsRadius) continue;
            game.popBalloon(ball, false, { fromBomb: true });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.phase === 'exploding') {
            this._drawExplosion(ctx);
            return;
        }

        if (this.phase !== 'dropping' && this.phase !== 'holding') return;

        const size = Config.BOMB_VISUAL_SIZE * Config.BOMB_FIELD_SCALE;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        drawBombIcon(ctx, {
            size,
            accent: '#f97316',
            alpha: 1,
            fuseLength: this.fuseLength,
        });
        ctx.restore();
    }

    _drawExplosion(ctx) {
        const alpha = this.explodeIconAlpha;
        const pulseScale = this.explodePulseScale;
        const baseSize = Config.BOMB_EXPLODE_ICON_BASE_SIZE * Config.BOMB_FIELD_SCALE;
        const shockR = this.radius * (0.55 + pulseScale * 0.35) * (1 - this.explodeProgress * 0.25);

        ctx.save();
        ctx.translate(this.targetX, this.targetY);

        const shockAlpha = alpha * 0.42 * (1 - this.explodeProgress * 0.4);
        if (shockAlpha > 0.02) {
            const shock = ctx.createRadialGradient(0, 0, 0, 0, 0, shockR);
            shock.addColorStop(0, `rgba(251, 191, 36, ${shockAlpha})`);
            shock.addColorStop(0.45, `rgba(249, 115, 22, ${shockAlpha * 0.55})`);
            shock.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctx.fillStyle = shock;
            ctx.beginPath();
            ctx.arc(0, 0, shockR, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.scale(pulseScale, pulseScale);
        drawExplosionBurstIcon(ctx, {
            size: baseSize,
            accent: '#f97316',
            alpha,
            rotation: this.explodePulsePhase * 0.08,
        });

        ctx.restore();
    }
}