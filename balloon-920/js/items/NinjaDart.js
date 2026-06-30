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
        if (y == null) throw new Error('NinjaDart requires a validated flight Y');
        this.y = y;
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

    /**
     * 在气球群「顶部～中间」高度带内随机选路，并保证能击中至少一个气球。
     * @param {object} game
     * @param {object} [opts]
     * @param {object} [opts.excludeBall] 即将被移除的气球，不参与选路
     * @returns {number|null}
     */
    static pickFlightY(game, opts = {}) {
        const exclude = opts.excludeBall ?? null;
        const balls = game.balls.filter((b) => b !== exclude && b.air > 0);
        if (!balls.length) return null;

        for (const ball of balls) game.syncBallBounds(ball);

        const band = NinjaDart._upperFlightBand(balls);
        const candidates = [];

        for (let i = 0; i < 14; i++) {
            const y = band.top + Math.random() * (band.mid - band.top);
            const hitCount = NinjaDart._countHitsAtY(y, balls, game);
            if (hitCount > 0) candidates.push({ y, hitCount });
        }

        for (const ball of balls) {
            if (ball.cy < band.top || ball.cy > band.mid) continue;
            const hitCount = NinjaDart._countHitsAtY(ball.cy, balls, game);
            if (hitCount > 0) candidates.push({ y: ball.cy, hitCount });
        }

        if (!candidates.length) {
            const fallbackY = NinjaDart._fallbackUpperY(balls, band, game);
            return fallbackY;
        }

        let best = 0;
        for (const c of candidates) best = Math.max(best, c.hitCount);
        const tier = candidates.filter((c) => c.hitCount === best);
        return tier[Math.floor(Math.random() * tier.length)].y;
    }

    /** 气球群垂直范围的上半区：顶缘 ~ 中线 */
    static _upperFlightBand(balls) {
        let clusterTop = Infinity;
        let clusterBottom = -Infinity;
        for (const ball of balls) {
            clusterTop = Math.min(clusterTop, ball.cy - ball.boundsRadius);
            clusterBottom = Math.max(clusterBottom, ball.cy + ball.boundsRadius);
        }
        const clusterMid = (clusterTop + clusterBottom) * 0.5;
        const span = clusterBottom - clusterTop;
        const minSpan = Config.NINJA_DART_HIT_RADIUS * 2;
        if (clusterMid - clusterTop < minSpan) {
            return { top: clusterTop, mid: clusterTop + span * 0.38 };
        }
        return { top: clusterTop, mid: clusterMid };
    }

    static _fallbackUpperY(balls, band, game) {
        let topBall = balls[0];
        for (const ball of balls) {
            if (ball.cy < topBall.cy) topBall = ball;
        }
        const y = Math.max(band.top, Math.min(band.mid, topBall.cy));
        return NinjaDart._countHitsAtY(y, balls, game) > 0 ? y : null;
    }

    static _countHitsAtY(y, balls, game) {
        let count = 0;
        for (const ball of balls) {
            if (NinjaDart._lineHitsBallAtY(y, ball, game)) count++;
        }
        return count;
    }

    static _lineHitsBallAtY(y, ball, game) {
        game.syncBallBounds(ball);
        const reachY = ball.boundsRadius + Config.NINJA_DART_HIT_RADIUS;
        return Math.abs(y - ball.cy) <= reachY;
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