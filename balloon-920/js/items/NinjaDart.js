import * as Config from '../config.js';

let _nextDartUid = 1;

/**
 * 忍者飞镖：气球爆破后触发，沿随机高度自右向左单程横穿，击破路径上的气球。
 */
export class NinjaDart {
    /**
     * @param {object} [opts]
     * @param {number} [opts.y] 飞行高度（逻辑坐标）
     * @param {number} [opts.speed] 水平速度 px/s
     */
    constructor({ y, speed } = {}) {
        this.uid = _nextDartUid++;
        this.y = y ?? NinjaDart.randomFlightY();
        this.x = Config.width + Config.NINJA_DART_OFFSCREEN;
        this.prevX = this.x;
        this.speed = speed ?? Config.NINJA_DART_SPEED;
        /** @type {-1} */
        this.direction = -1;
        this.rotation = Math.random() * Math.PI * 2;
        this.alive = true;
        /** @type {Set<object>} 已命中的气球 */
        this.hitBalls = new Set();
    }

    static randomFlightY() {
        const minY = Config.BALLOON_FIELD_PAD_TOP + 48;
        const maxY = Config.GROUND_Y - 72;
        return minY + Math.random() * Math.max(40, maxY - minY);
    }

    /**
     * @param {number} dt
     * @param {object} game
     */
    update(dt, game) {
        if (!this.alive) return;

        this.prevX = this.x;
        this.x += this.direction * this.speed * dt;
        this.rotation += Config.NINJA_DART_SPIN_SPEED * dt;

        this._checkBalloonHits(game);

        if (this.x <= -Config.NINJA_DART_OFFSCREEN) {
            this.alive = false;
        }
    }

    _checkBalloonHits(game) {
        const minX = Math.min(this.x, this.prevX) - Config.NINJA_DART_HIT_RADIUS;
        const maxX = Math.max(this.x, this.prevX) + Config.NINJA_DART_HIT_RADIUS;

        for (let i = game.balls.length - 1; i >= 0; i--) {
            const ball = game.balls[i];
            if (this.hitBalls.has(ball)) continue;
            if (!this._segmentHitsBall(minX, maxX, ball, game)) continue;

            this.hitBalls.add(ball);
            game.popBalloon(ball, false, { fromDart: true });
        }
    }

    _segmentHitsBall(minX, maxX, ball, game) {
        game.syncBallBounds(ball);
        const reachY = ball.boundsRadius + Config.NINJA_DART_HIT_RADIUS;
        if (Math.abs(this.y - ball.cy) > reachY) return false;

        const ballMinX = ball.cx - ball.boundsRadius;
        const ballMaxX = ball.cx + ball.boundsRadius;
        return maxX >= ballMinX && minX <= ballMaxX;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const size = Config.NINJA_DART_VISUAL_SIZE;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
        ctx.shadowBlur = 8;

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
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

        const trailLen = 42;
        const trailStart = Math.min(Config.width, this.x + trailLen);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 10]);
        ctx.beginPath();
        ctx.moveTo(trailStart, this.y);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}