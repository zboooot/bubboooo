import * as Config from '../config.js';

let _nextDartUid = 1;

/** @readonly */
export const NinjaDartPathMode = {
    LEFT_APEX: 'left_apex',
    RIGHT_APEX: 'right_apex',
};

/**
 * 忍者飞镖：严格沿预设 V 形折线飞行（随机左顶点 / 右顶点）。
 */
export class NinjaDart {
    /**
     * @param {object} opts
     * @param {object} opts.path
     */
    constructor({ path }) {
        if (!path) throw new Error('NinjaDart requires a validated flight path');
        this.uid = _nextDartUid++;
        this.pathMode = path.pathMode;
        this.entryX = path.entryX;
        this.entryY = path.entryY;
        this.apexX = path.apexX;
        this.apexY = path.apexY;
        this.exitX = path.exitX;
        this.exitY = path.exitY;
        this.dx1 = path.dx1;
        this.dy1 = path.dy1;
        this.dx2 = path.dx2;
        this.dy2 = path.dy2;
        this.leg1Len = path.leg1Len;
        this.leg2Len = path.leg2Len;
        this.speed = path.speed ?? Config.NINJA_DART_SPEED;
        /** @type {1 | 2} */
        this.leg = 1;
        this.travel = 0;
        this.x = this.entryX;
        this.y = this.entryY;
        this.prevX = this.x;
        this.prevY = this.y;
        this.spin = 0;
        this.alive = true;
        this.hitBalls = new Set();
    }

    /**
     * 随机选一条固定 V 路线；场上仍有气球即可发射。
     * @param {object} game
     * @param {object} [opts]
     * @param {object} [opts.excludeBall]
     * @returns {object|null}
     */
    static pickFlightPath(game, opts = {}) {
        const exclude = opts.excludeBall ?? null;
        const balls = game.balls.filter((b) => b !== exclude && b.air > 0);
        if (!balls.length) return null;

        const mode = Math.random() < 0.5
            ? NinjaDartPathMode.LEFT_APEX
            : NinjaDartPathMode.RIGHT_APEX;

        return NinjaDart._buildVPath(mode);
    }

    static _buildVPath(mode) {
        const off = Config.NINJA_DART_OFFSCREEN;
        const entryY = Config.NINJA_DART_ENTRY_Y;
        const apexY = Config.NINJA_DART_APEX_Y;
        const exitY = Config.NINJA_DART_EXIT_Y;

        let entryX;
        let apexX;
        let exitX;
        if (mode === NinjaDartPathMode.LEFT_APEX) {
            entryX = Config.width + off;
            apexX = Config.NINJA_DART_LEFT_APEX_X;
            exitX = Config.width + off;
        } else {
            entryX = -off;
            apexX = Config.NINJA_DART_RIGHT_APEX_X;
            exitX = -off;
        }

        const leg1Dx = apexX - entryX;
        const leg1Dy = apexY - entryY;
        const leg2Dx = exitX - apexX;
        const leg2Dy = exitY - apexY;
        const leg1Len = Math.hypot(leg1Dx, leg1Dy);
        const leg2Len = Math.hypot(leg2Dx, leg2Dy);
        const dir1 = NinjaDart._normalize(leg1Dx, leg1Dy);
        const dir2 = NinjaDart._normalize(leg2Dx, leg2Dy);

        return {
            pathMode: mode,
            entryX,
            entryY,
            apexX,
            apexY,
            exitX,
            exitY,
            dx1: dir1.dx,
            dy1: dir1.dy,
            dx2: dir2.dx,
            dy2: dir2.dy,
            leg1Len,
            leg2Len,
        };
    }

    static _normalize(dx, dy) {
        const len = Math.hypot(dx, dy) || 1;
        return { dx: dx / len, dy: dy / len };
    }

    get _dx() {
        return this.leg === 1 ? this.dx1 : this.dx2;
    }

    get _dy() {
        return this.leg === 1 ? this.dy1 : this.dy2;
    }

    get _legLen() {
        return this.leg === 1 ? this.leg1Len : this.leg2Len;
    }

    _positionOnLeg(leg, distance) {
        if (leg === 1) {
            return {
                x: this.entryX + this.dx1 * distance,
                y: this.entryY + this.dy1 * distance,
            };
        }
        return {
            x: this.apexX + this.dx2 * distance,
            y: this.apexY + this.dy2 * distance,
        };
    }

    /**
     * @param {number} dt
     * @param {object} game
     */
    update(dt, game) {
        if (!this.alive) return;

        let remaining = this.speed * dt;

        while (remaining > 0 && this.alive) {
            const legLen = this._legLen;
            const room = Math.max(0, legLen - this.travel);
            const step = Math.min(remaining, room);

            const prevPos = this._positionOnLeg(this.leg, this.travel);
            this.prevX = prevPos.x;
            this.prevY = prevPos.y;
            this.travel += step;

            const pos = this._positionOnLeg(this.leg, this.travel);
            this.x = pos.x;
            this.y = pos.y;
            this._checkBalloonHits(game);
            remaining -= step;

            if (this.travel < legLen - 1e-4) break;

            if (this.leg === 1) {
                this.leg = 2;
                this.travel = 0;
                this.x = this.apexX;
                this.y = this.apexY;
                this.prevX = this.apexX;
                this.prevY = this.apexY;
            } else {
                this.travel = legLen;
                this.x = this.exitX;
                this.y = this.exitY;
                this.alive = false;
            }
        }

        this.spin += Config.NINJA_DART_SPIN_SPEED * dt;
    }

    _checkBalloonHits(game) {
        const ax = this.prevX;
        const ay = this.prevY;
        const bx = this.x;
        const by = this.y;

        for (let i = game.balls.length - 1; i >= 0; i--) {
            const ball = game.balls[i];
            if (this.hitBalls.has(ball)) continue;
            if (!NinjaDart._motionSegmentHitsBall(ax, ay, bx, by, ball, game)) continue;

            this.hitBalls.add(ball);
            game.popBalloon(ball, false, { fromDart: true });
        }
    }

    static _motionSegmentHitsBall(ax, ay, bx, by, ball, game) {
        game.syncBallBounds(ball);
        const reach = ball.boundsRadius + Config.NINJA_DART_HIT_RADIUS;
        const segDx = bx - ax;
        const segDy = by - ay;
        const segLenSq = segDx * segDx + segDy * segDy;
        if (segLenSq < 1e-6) {
            return Math.hypot(ball.cx - bx, ball.cy - by) <= reach;
        }
        const t = Math.max(0, Math.min(1,
            ((ball.cx - ax) * segDx + (ball.cy - ay) * segDy) / segLenSq
        ));
        const cx = ax + segDx * t;
        const cy = ay + segDy * t;
        return Math.hypot(ball.cx - cx, ball.cy - cy) <= reach;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const size = Config.NINJA_DART_VISUAL_SIZE;
        const face = Math.atan2(this._dy, this._dx);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(face + this.spin * 0.35);

        ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
        ctx.shadowBlur = 14;

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
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
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const trailLen = Config.NINJA_DART_TRAIL_LEN;
        const tx = this.x - this._dx * trailLen;
        const ty = this.y - this._dy * trailLen;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}