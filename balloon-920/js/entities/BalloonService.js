import * as Config from '../config.js';
import { TEAM_PALETTE } from '../level/levelData.js';
import { Particle, DistanceConstraint, AreaConstraint } from '../physics/pbd.js';
import { clamp } from '../utils/math.js';
import {
    isClownBall,
    enqueueClownsNearPop,
    popClownBalloon,
} from '../items/clownBalloon.js';
import { clownChainColorKey } from '../items/clownPopCinematic.js';

/** BalloonService */
export class BalloonService {
    constructor(game) {
        this.game = game;
    }

    createSoftBall(cx, cy, radius, colorBase, colorLight, initialVelocity = null) {
        const game = this.game;
            const N = Config.PARTICLES_PER_BALLOON;
            const ballParticles = [];

            for (let i = 0; i < N; i++) {
                const angle = (i / N) * Math.PI * 2;
                const px = cx + Math.cos(angle) * radius;
                const py = cy + Math.sin(angle) * radius;
                const p = new Particle(px, py, 1.0);
                if (initialVelocity) {
                    p.vx = initialVelocity.vx;
                    p.vy = initialVelocity.vy;
                }
                ballParticles.push(p);
                game.particles.push(p);
            }

            const distanceConstraints = [];
            for (let i = 0; i < N; i++) {
                const c1 = new DistanceConstraint(ballParticles[i], ballParticles[(i + 1) % N], 1.0);
                const c2 = new DistanceConstraint(ballParticles[i], ballParticles[(i + 2) % N], 0.8);
                game.constraints.push(c1, c2);
                distanceConstraints.push(c1, c2);
            }
            const areaConstraint = new AreaConstraint(ballParticles, 1.0);
            game.constraints.push(areaConstraint);

            const solverConstraints = distanceConstraints.concat([areaConstraint]);

            game.balls.push({
                particles: ballParticles,
                radius,
                baseRadius: radius,
                colorBase,
                colorLight,
                inflate: 0,
                fillAtRestBase: 0,
                restVisualScale: 1,
                air: Config.AIR_CAPACITY,
                imminentPopDelay: null,
                distanceConstraints,
                areaConstraint,
                solverConstraints,
                cx,
                cy,
                labelLift: 0,
                labelScale: 1,
                labelPulse: 0,
                labelLastCeil: 0,
                role: 'normal',
            });
    }

    refreshBallCentroids() {
        const game = this.game;
            for (let b = 0; b < game.balls.length; b++) {
                const ball = game.balls[b];
                const pts = ball.particles;
                let cx = 0;
                let cy = 0;
                for (let i = 0; i < pts.length; i++) {
                    cx += pts[i].x;
                    cy += pts[i].y;
                }
                ball.cx = cx / pts.length;
                ball.cy = cy / pts.length;
            }
    }

    destroyBall(index) {
        const game = this.game;
            const ball = game.balls[index];
            const set = new Set(ball.particles);

            for (let i = game.particles.length - 1; i >= 0; i--) {
                if (set.has(game.particles[i])) game.particles.splice(i, 1);
            }

            for (let i = game.constraints.length - 1; i >= 0; i--) {
                const c = game.constraints[i];
                if (c instanceof AreaConstraint) {
                    if (c.particles === ball.particles) game.constraints.splice(i, 1);
                } else if (c instanceof DistanceConstraint) {
                    if (set.has(c.p1) || set.has(c.p2)) game.constraints.splice(i, 1);
                }
            }

            if (game.dragNode && set.has(game.dragNode)) game.dragNode = null;
            if (game.activeInflateBall === ball) game.activeInflateBall = null;
            game.balls.splice(index, 1);
    }

    syncBallRestState(ball) {
        const game = this.game;
            const pts = ball.particles;
            let cx = 0;
            let cy = 0;
            for (let i = 0; i < pts.length; i++) {
                cx += pts[i].x;
                cy += pts[i].y;
            }
            cx /= pts.length;
            cy /= pts.length;

            let avgR = 0;
            for (let i = 0; i < pts.length; i++) {
                avgR += Math.hypot(pts[i].x - cx, pts[i].y - cy);
            }
            avgR /= pts.length;

            ball.cx = cx;
            ball.cy = cy;
            ball.radius = avgR;
            ball.baseRadius = avgR;

            const area = ball.areaConstraint.calculateArea();
            ball.areaConstraint.restArea = area;
            ball.areaConstraint.baseRestArea = area;

            for (let i = 0; i < ball.distanceConstraints.length; i++) {
                const dc = ball.distanceConstraints[i];
                const dx = dc.p1.x - dc.p2.x;
                const dy = dc.p1.y - dc.p2.y;
                const len = Math.hypot(dx, dy);
                dc.restLength = len;
                dc.initialRestLength = len;
            }

            ball.fillAtRestBase = game.airToFillRatio(ball.air);
            ball.restVisualScale = game.visualScaleFromAir(ball.air);
            ball.areaConstraint.restArea = ball.areaConstraint.baseRestArea;
            for (let i = 0; i < ball.distanceConstraints.length; i++) {
                ball.distanceConstraints[i].restLength = ball.distanceConstraints[i].initialRestLength;
            }
    }

    reshapeBallToCircle(ball, radius) {
        const game = this.game;
            const pts = ball.particles;
            const n = pts.length;
            const cx = ball.cx;
            const cy = ball.cy;

            for (let i = 0; i < n; i++) {
                const angle = (i / n) * Math.PI * 2;
                pts[i].x = cx + Math.cos(angle) * radius;
                pts[i].y = cy + Math.sin(angle) * radius;
                pts[i].vx = 0;
                pts[i].vy = 0;
                pts[i].px = pts[i].x;
                pts[i].py = pts[i].y;
            }

            ball.radius = radius;
            ball.baseRadius = radius;
    }

    localRelaxBall(ball, iterations) {
        const game = this.game;
            for (let k = 0; k < iterations; k++) {
                const list = ball.solverConstraints;
                for (let i = 0; i < list.length; i++) list[i].solve();
            }
    }

    /**
     * 气球标签数字：当前气量 0–100（100 = 即将撑爆）。
     * 内部 ball.air 仍为「剩余可打气量」，与视觉/打气逻辑一致。
     * @param {object} ball
     * @param {number} [remainingAir] 可选，用于打气前后对比动画
     */
    displayAirForLabel(ball, remainingAir) {
        const cap = Config.AIR_CAPACITY;
        const rem = remainingAir !== undefined ? remainingAir : ball.air;
        if (rem <= 0 && ball.imminentPopDelay != null) return cap;
        const filled = cap - Math.max(0, rem);
        return Math.min(cap, Math.max(0, Math.ceil(filled)));
    }

    /** @returns {number} 0–1，当前气量 ≥90 时指数趋红 */
    displayAirLabelRedBlend(ball) {
        const display = this.displayAirForLabel(ball);
        const start = Config.AIR_LABEL_RED_START;
        if (display < start) return 0;
        const span = Config.AIR_CAPACITY - start;
        const t = Math.min(1, Math.max(0, (display - start) / span));
        const k = Config.AIR_LABEL_RED_EXP;
        if (t <= 0) return 0;
        return (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
    }

    airToFillRatio(air) {
        const game = this.game;
            const clamped = Math.max(0, Math.min(Config.AIR_CAPACITY, air));
            return 1 - clamped / Config.AIR_CAPACITY;
    }

    smallBalloonRadiusMul(air) {
        const game = this.game;
            if (air <= Config.SMALL_BALLOON_AIR_START) return 1;
            if (air >= Config.SMALL_BALLOON_AIR_END) return Config.SMALL_BALLOON_RADIUS_MUL_AT_MAX_AIR;
            const t = (air - Config.SMALL_BALLOON_AIR_START) / (Config.SMALL_BALLOON_AIR_END - Config.SMALL_BALLOON_AIR_START);
            return 1 - 0.4 * t;
    }

    visualScaleFromAir(air) {
        const game = this.game;
            const fill = game.airToFillRatio(air);
            const baseScale = 1 + fill * (Config.INFLATE_MAX_SCALE - 1);
            return baseScale * game.smallBalloonRadiusMul(air);
    }

    currentInflateScale(ball) {
        const game = this.game;
            return game.visualScaleFromAir(ball.air);
    }

    applyBallAirVisual(ball) {
        const game = this.game;
            ball.inflate = game.airToFillRatio(ball.air);
            game.applyInflationTargets(ball);
    }

    schedulePopIfEmpty(ball) {
        const game = this.game;
            if (isClownBall(ball)) return;
            if (ball.air > 0) return;
            if (ball.imminentPopDelay == null) {
                ball.imminentPopDelay = Config.FULL_POP_DELAY;
                game.primeImminentPopFx(ball);
            }
    }

    primeImminentPopFx(ball) {
        this.game.spawnImminentPopBurst(ball);
    }

    spawnImminentPopBurst(ball) {
        const game = this.game;
        const c = game.polygonCentroid(ball.particles);
        const sparks = ['#ff3b3b', '#ff6b35', '#ffcc66', '#fff5f5', ball.colorLight];
        for (let i = 0; i < 32; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 120 + Math.random() * 340;
            game.popEffects.push({
                x: c.x + (Math.random() - 0.5) * ball.radius * 0.35,
                y: c.y + (Math.random() - 0.5) * ball.radius * 0.35,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: 0.35 + Math.random() * 0.45,
                maxLife: 0.8,
                color: sparks[i % sparks.length],
                size: 2.5 + Math.random() * 5.5,
            });
        }
    }

    spawnImminentPopSparks(ball, count = 2) {
        const game = this.game;
        const c = game.polygonCentroid(ball.particles);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 60 + Math.random() * 180;
            game.popEffects.push({
                x: c.x,
                y: c.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.22 + Math.random() * 0.2,
                maxLife: 0.42,
                color: Math.random() < 0.55 ? '#ff4444' : '#ffaa44',
                size: 2 + Math.random() * 3,
            });
        }
    }

    applyImminentPopShake(ball, delayLeft) {
        const game = this.game;
        const urgency = 1 - delayLeft / Config.FULL_POP_DELAY;
        const pts = ball.particles;
        const c = game.polygonCentroid(pts);
        const mag = (18 + urgency * 120) * Config.dt;
        const spin = game.simTime * (28 + urgency * 50);
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const nx = p.x - c.x;
            const ny = p.y - c.y;
            const len = Math.hypot(nx, ny) || 1;
            const wave = Math.sin(spin + i * 1.1);
            p.vx += (nx / len) * wave * mag + (Math.random() - 0.5) * mag * 2.2;
            p.vy += (ny / len) * wave * mag + (Math.random() - 0.5) * mag * 2.2;
        }
    }

    rollBaselineInitialAir(spawnIndex = 0) {
        const game = this.game;
            const buckets = Config.BASELINE_SPAWN.airBuckets;
            const bucket = buckets[((spawnIndex % buckets.length) + buckets.length) % buckets.length];
            const span = bucket.max - bucket.min + 1;
            return bucket.min + Math.floor(Math.random() * span);
    }

    randomInitialAir(spawnIndex = 0) {
        const game = this.game;
            return game.rollBaselineInitialAir(spawnIndex);
    }

    updateImminentPops() {
        const game = this.game;
            for (let i = game.balls.length - 1; i >= 0; i--) {
                const ball = game.balls[i];
                if (ball.imminentPopDelay == null) continue;
                game.applyImminentPopShake(ball, ball.imminentPopDelay);
                if (Math.random() < 0.72) game.spawnImminentPopSparks(ball, 1 + Math.floor(Math.random() * 2));
                ball.imminentPopDelay -= Config.dt;
                if (ball.imminentPopDelay <= 0) {
                    ball.imminentPopDelay = null;
                    game.refreshBallCentroids();
                    for (let bi = 0; bi < game.balls.length; bi++) game.syncBallBounds(game.balls[bi]);
                    game.popBalloon(ball);
                }
            }
    }

    applyInflationTargets(ball) {
        const game = this.game;
            const targetScale = game.visualScaleFromAir(ball.air);
            const baseScale = ball.restVisualScale || targetScale;
            const rel = baseScale > 1e-6 ? targetScale / baseScale : targetScale;
            const areaScale = rel * rel;
            ball.areaConstraint.restArea = ball.areaConstraint.baseRestArea * areaScale;
            for (const dc of ball.distanceConstraints) {
                dc.restLength = dc.initialRestLength * rel;
            }
            ball.radius = ball.baseRadius * rel;

            const wobble = ball.inflate * ball.inflate;
            const pulse = Math.sin(game.simTime * (8 + wobble * 28)) * wobble;
            ball.areaConstraint.stiffness = Math.max(0.35, 1 - wobble * 0.55 + pulse * 0.2);
            for (const dc of ball.distanceConstraints) {
                dc.stiffness = dc.baseStiffness * Math.max(0.4, 1 - wobble * 0.45);
            }
    }

    applyInflationShake(ball) {
        const game = this.game;
            if (ball.inflate <= 0.12) return;
            const pts = ball.particles;
            const c = game.polygonCentroid(pts);
            const wobble = ball.inflate * ball.inflate;
            const mag = (6 + wobble * 220) * Config.dt;
            const spin = game.simTime * (14 + wobble * 40);

            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                const nx = p.x - c.x;
                const ny = p.y - c.y;
                const len = Math.hypot(nx, ny) || 1;
                const tx = -ny / len;
                const ty = nx / len;
                const wave = Math.sin(spin + i * 0.85) * wobble;
                p.vx += tx * wave * mag + (Math.random() - 0.5) * mag * 1.6;
                p.vy += ty * wave * mag + (Math.random() - 0.5) * mag * 1.6;
            }
    }

    spawnPopEffect(ball) {
        const game = this.game;
            const c = game.polygonCentroid(ball.particles);
            for (let i = 0; i < 18; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 80 + Math.random() * 260;
                game.popEffects.push({
                    x: c.x,
                    y: c.y,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp,
                    life: 0.55 + Math.random() * 0.35,
                    maxLife: 1,
                    color: ball.colorLight,
                    size: 2 + Math.random() * 4
                });
            }
    }

    popBalloon(ball, fromChain = false, extraCtx = {}) {
        const game = this.game;
            if (!game.balls.includes(ball)) return;
            if (isClownBall(ball)) {
                popClownBalloon(game, ball, fromChain);
                return;
            }

            if (!fromChain) {
                game.resetChainPopState();
                game.chainComboCount = 1;
            } else {
                game.chainComboCount++;
            }
            game.ensureChainVisited();
            game.chainPopVisited.add(ball);

            game.sfx.playPop(game.chainComboCount);
            game.bumpComboHud(game.chainComboCount);

            const neighbors = game.getTouchingSameColorNeighbors(ball);
            game.spawnPopEffect(ball);
            game.onBalloonPop(ball, {
                fromChain,
                comboCount: game.chainComboCount,
                ...extraCtx,
            });
            enqueueClownsNearPop(game, ball);
            const idx = game.balls.indexOf(ball);
            if (idx >= 0) game.destroyBall(idx);
            game.updateBallCount();
            game.enqueueChainNeighbors(ball, neighbors);
            game.checkLevelWin();
            game.checkLevelLose();
    }

    syncBallBounds(ball) {
        const game = this.game;
            const pts = ball.particles;
            let cx = 0;
            let cy = 0;
            for (let i = 0; i < pts.length; i++) {
                cx += pts[i].x;
                cy += pts[i].y;
            }
            cx /= pts.length;
            cy /= pts.length;
            let maxR = 0;
            for (let i = 0; i < pts.length; i++) {
                const r = Math.hypot(pts[i].x - cx, pts[i].y - cy);
                if (r > maxR) maxR = r;
            }
            ball.cx = cx;
            ball.cy = cy;
            ball.boundsRadius = maxR;
            return ball;
    }

    minParticleGap(ballA, ballB) {
        const game = this.game;
            const pa = ballA.particles;
            const pb = ballB.particles;
            let best = Infinity;
            for (let i = 0; i < pa.length; i++) {
                const ax = pa[i].x;
                const ay = pa[i].y;
                for (let j = 0; j < pb.length; j++) {
                    const d = Math.hypot(ax - pb[j].x, ay - pb[j].y);
                    if (d < best) best = d;
                }
            }
            return best;
    }

    ballsPhysicallyTouch(ballA, ballB) {
        const game = this.game;
            if (game.minParticleGap(ballA, ballB) <= Config.CHAIN_PARTICLE_TOUCH) return true;
            game.syncBallBounds(ballA);
            game.syncBallBounds(ballB);
            const dist = Math.hypot(ballA.cx - ballB.cx, ballA.cy - ballB.cy);
            return dist <= ballA.boundsRadius + ballB.boundsRadius + Config.CHAIN_PARTICLE_TOUCH * 0.5;
    }

    getTouchingSameColorNeighbors(ball) {
        const game = this.game;
            game.syncBallBounds(ball);
            const neighbors = [];
            for (let i = 0; i < game.balls.length; i++) {
                const other = game.balls[i];
                if (other === ball) continue;
                if (clownChainColorKey(other) !== clownChainColorKey(ball)) continue;
                if (!game.ballsPhysicallyTouch(ball, other)) continue;
                neighbors.push({ ball: other, gap: game.minParticleGap(ball, other) });
            }
            neighbors.sort((a, b) => a.gap - b.gap);
            return neighbors.map((n) => n.ball);
    }

    enqueueChainNeighbors(ball, neighbors) {
        const game = this.game;
            game.ensureChainVisited();
            for (let i = 0; i < neighbors.length; i++) {
                const n = neighbors[i];
                if (!game.balls.includes(n) || game.chainPopVisited.has(n)) continue;
                game.chainPopVisited.add(n);
                game.chainPopQueue.push(n);
            }
    }

    processChainPops() {
        const game = this.game;
            if (game.isGameplayFrozen?.()) return;
            if (!game.chainPopQueue.length) return;
            game.chainPopAccum += Config.dt;
            if (game.chainPopAccum < Config.CHAIN_POP_INTERVAL) return;
            game.chainPopAccum -= Config.CHAIN_POP_INTERVAL;

            const next = game.chainPopQueue.shift();
            if (!next || !game.balls.includes(next)) return;
            if (isClownBall(next)) popClownBalloon(game, next, true);
            else game.popBalloon(next, true);
    }

    resetChainPopState() {
        const game = this.game;
            game.chainPopQueue = [];
            game.chainPopVisited = null;
            game.chainPopAccum = 0;
    }

    ensureChainVisited() {
        const game = this.game;
            if (!game.chainPopVisited) game.chainPopVisited = new Set();
    }

    ensureBallLabelState(ball) {
        const game = this.game;
            if (ball.labelLift == null) ball.labelLift = 0;
            if (ball.labelScale == null) ball.labelScale = 1;
            if (ball.labelPulse == null) ball.labelPulse = 0;
            if (ball.labelLastCeil == null) ball.labelLastCeil = game.displayAirForLabel(ball);
    }

    updateBallLabelAnims() {
        const game = this.game;
            for (let i = 0; i < game.balls.length; i++) {
                const ball = game.balls[i];
                game.ensureBallLabelState(ball);
                ball.labelLift *= Math.exp(-5.2 * Config.dt);
                ball.labelPulse *= Math.exp(-9.5 * Config.dt);
                ball.labelScale += (1 - ball.labelScale) * Math.min(1, 7.5 * Config.dt);
            }
    }

    bumpBallLabelOnAirTick(ball, airBefore) {
        const game = this.game;
            game.ensureBallLabelState(ball);
            const ceilBefore = game.displayAirForLabel(ball, airBefore);
            const ceilAfter = game.displayAirForLabel(ball);
            if (ceilAfter > ceilBefore) {
                const step = ceilAfter - ceilBefore;
                ball.labelLift = Math.min(ball.radius * 0.4, ball.labelLift + 3.2 + step * 1.2);
                ball.labelPulse = Math.min(1, ball.labelPulse + 0.55 + step * 0.15);
                ball.labelScale = Math.min(1.34, ball.labelScale + 0.07 + step * 0.03);
            }
            ball.labelLastCeil = ceilAfter;
    }

    polygonCentroid(poly) {
        const game = this.game;
            let cx = 0;
            let cy = 0;
            for (let i = 0; i < poly.length; i++) {
                cx += poly[i].x;
                cy += poly[i].y;
            }
            return { x: cx / poly.length, y: cy / poly.length };
    }

    updatePopEffects() {
        const game = this.game;
            for (let i = game.popEffects.length - 1; i >= 0; i--) {
                const fx = game.popEffects[i];
                fx.life -= Config.dt;
                if (fx.life <= 0) {
                    game.popEffects.splice(i, 1);
                    continue;
                }
                fx.x += fx.vx * Config.dt;
                fx.y += fx.vy * Config.dt;
                fx.vy += 420 * Config.dt;
                fx.vx *= 0.98;
            }
    }

}
