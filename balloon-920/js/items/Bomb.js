import * as Config from '../config.js';
import { drawBombIcon } from './BombIcon.js';

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
        this.explodeRingT = 0;
        this.alive = true;
        this.popped = false;
        this.wobble = Math.random() * Math.PI * 2;
        this.tilt = 0;
        this.prevX = this.x;
        this.prevY = this.y;

        const duration = Config.BOMB_DROP_DURATION_SEC;
        const gravity = Config.BOMB_DROP_GRAVITY;
        this._dropVx = (this.targetX - this.startX) / duration;
        this._dropVy0 = (this.targetY - this.startY) / duration - 0.5 * gravity * duration;
        this._dropGravity = gravity;
    }

    get fuseLength() {
        if (this.phase === 'holding') {
            return Math.max(0, 1 - this.holdElapsed / Config.BOMB_LAND_HOLD_SEC);
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
            const tau = Math.min(this.dropElapsed, Config.BOMB_DROP_DURATION_SEC);
            const pos = Bomb._parabolicPosition(
                this.startX,
                this.startY,
                this._dropVx,
                this._dropVy0,
                this._dropGravity,
                tau
            );

            this.prevX = this.x;
            this.prevY = this.y;
            this.x = pos.x;
            this.y = pos.y;

            const vy = this._dropVy0 + this._dropGravity * tau;
            this.tilt = Math.atan2(vy, this._dropVx) * 0.28;

            if (this.dropElapsed >= Config.BOMB_DROP_DURATION_SEC) {
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
            if (this.holdElapsed >= Config.BOMB_LAND_HOLD_SEC) {
                this.phase = 'exploding';
                this.explodeElapsed = 0;
                this._popBallsInRadius(game);
            }
            return;
        }

        if (this.phase === 'exploding') {
            this.explodeElapsed += dt;
            this.explodeRingT = Math.min(
                1,
                this.explodeElapsed / Config.BOMB_EXPLODE_HOLD_SEC
            );
            if (this.explodeElapsed >= Config.BOMB_EXPLODE_HOLD_SEC) {
                this.phase = 'done';
                this.alive = false;
            }
        }
    }

    static _parabolicPosition(startX, startY, vx, vy0, gravity, tau) {
        return {
            x: startX + vx * tau,
            y: startY + vy0 * tau + 0.5 * gravity * tau * tau,
        };
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

        const size = Config.BOMB_VISUAL_SIZE;

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
        const ringR = this.radius * Config.BOMB_EXPLODE_RING_MAX_SCALE * this.explodeRingT;
        const alpha = 1 - this.explodeRingT * 0.65;

        ctx.save();
        ctx.translate(this.targetX, this.targetY);

        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR);
        glow.addColorStop(0, `rgba(251, 191, 36, ${0.55 * alpha})`);
        glow.addColorStop(0.35, `rgba(249, 115, 22, ${0.28 * alpha})`);
        glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(249, 115, 22, ${0.75 * alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(6, ringR * 0.12), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}