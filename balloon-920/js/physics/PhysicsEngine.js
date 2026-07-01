import * as Config from '../config.js';
import { Particle, DistanceConstraint, AreaConstraint } from './pbd.js';

/** PhysicsEngine */
export class PhysicsEngine {
    constructor(game) {
        this.game = game;
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

    solveBallConstraints() {
        const game = this.game;
            if (!game.constraintOrderFlip) {
                for (let b = 0; b < game.balls.length; b++) {
                    const list = game.balls[b].solverConstraints;
                    for (let i = 0; i < list.length; i++) list[i].solve();
                }
            } else {
                for (let b = game.balls.length - 1; b >= 0; b--) {
                    const list = game.balls[b].solverConstraints;
                    for (let i = list.length - 1; i >= 0; i--) list[i].solve();
                }
            }
            game.constraintOrderFlip = !game.constraintOrderFlip;
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

    pointInPolygon(px, py, poly) {
        const game = this.game;
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i].x, yi = poly[i].y;
                const xj = poly[j].x, yj = poly[j].y;
                const intersects = ((yi > py) !== (yj > py)) &&
                    (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-8) + xi);
                if (intersects) inside = !inside;
            }
            return inside;
    }

    closestPointOnSegment(px, py, ax, ay, bx, by) {
        const game = this.game;
            const abx = bx - ax;
            const aby = by - ay;
            const abLenSq = abx * abx + aby * aby;
            if (abLenSq < 1e-8) return { x: ax, y: ay, t: 0 };
            let t = ((px - ax) * abx + (py - ay) * aby) / abLenSq;
            t = Math.max(0, Math.min(1, t));
            return { x: ax + abx * t, y: ay + aby * t, t };
    }

    getOutwardNormal(ax, ay, bx, by, centroid) {
        const game = this.game;
            const ex = bx - ax;
            const ey = by - ay;
            let nx = -ey;
            let ny = ex;
            const mx = (ax + bx) * 0.5;
            const my = (ay + by) * 0.5;
            const toOutsideX = mx - centroid.x;
            const toOutsideY = my - centroid.y;
            if (nx * toOutsideX + ny * toOutsideY < 0) {
                nx = -nx;
                ny = -ny;
            }
            const len = Math.hypot(nx, ny) || 1;
            return { x: nx / len, y: ny / len };
    }

    projectPointVsPolygon(point, poly, centroid, contactSlop) {
        const game = this.game;
            let best = null;
            let bestDistSq = Infinity;

            for (let i = 0; i < poly.length; i++) {
                const j = (i + 1) % poly.length;
                const a = poly[i];
                const b = poly[j];
                const cp = game.closestPointOnSegment(point.x, point.y, a.x, a.y, b.x, b.y);
                const dx = point.x - cp.x;
                const dy = point.y - cp.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    best = { i, j, cp };
                }
            }

            if (!best) return;

            const a = poly[best.i];
            const b = poly[best.j];
            const normal = game.getOutwardNormal(a.x, a.y, b.x, b.y, centroid);
            const signedDist = (point.x - best.cp.x) * normal.x + (point.y - best.cp.y) * normal.y;
            const needInsideTest = bestDistSq < contactSlop * contactSlop * 16;
            const inside = needInsideTest && game.pointInPolygon(point.x, point.y, poly);
            const penetration = inside ? (contactSlop - signedDist) : Math.max(0, contactSlop - signedDist);
            if (penetration <= 0) return;

            const wp = point.invMass;
            const wa = a.invMass;
            const wb = b.invMass;
            const t = best.cp.t;
            const wA = wa * (1 - t);
            const wB = wb * t;
            const wSum = wp + wA + wB;
            if (wSum < 1e-8) return;

            const corrX = normal.x * penetration;
            const corrY = normal.y * penetration;

            point.x += corrX * (wp / wSum);
            point.y += corrY * (wp / wSum);
            a.x -= corrX * (wA / wSum);
            a.y -= corrY * (wA / wSum);
            b.x -= corrX * (wB / wSum);
            b.y -= corrY * (wB / wSum);
    }

    solvePair(polyA, polyB, pairSeed, cAx, cAy, cBx, cBy) {
        const game = this.game;
            const contactSlop = 2.0;
            const cA = { x: cAx, y: cAy };
            const cB = { x: cBx, y: cBy };
            const offsetA = (game.collisionPhase + pairSeed) % polyA.length;
            const offsetB = (game.collisionPhase + pairSeed * 3) % polyB.length;
            const flip = (game.collisionOrderFlip ^ (pairSeed & 1)) !== 0;

            if (!flip) {
                for (let i = 0; i < polyA.length; i++) {
                    const idx = (offsetA + i) % polyA.length;
                    game.projectPointVsPolygon(polyA[idx], polyB, cB, contactSlop);
                }
                for (let i = 0; i < polyB.length; i++) {
                    const idx = (offsetB + i) % polyB.length;
                    game.projectPointVsPolygon(polyB[idx], polyA, cA, contactSlop);
                }
            } else {
                for (let i = 0; i < polyB.length; i++) {
                    const idx = (offsetB + i) % polyB.length;
                    game.projectPointVsPolygon(polyB[idx], polyA, cA, contactSlop);
                }
                for (let i = 0; i < polyA.length; i++) {
                    const idx = (offsetA + i) % polyA.length;
                    game.projectPointVsPolygon(polyA[idx], polyB, cB, contactSlop);
                }
            }
    }

    solveBallCollisions() {
        const game = this.game;
            if (game.balls.length < 2) return;

            const reachPad = 28;
            for (let a = 0; a < game.balls.length; a++) {
                const ba = game.balls[a];
                for (let b = a + 1; b < game.balls.length; b++) {
                    const bb = game.balls[b];
                    if (ba.spawnGrow || bb.spawnGrow) continue;
                    const dx = ba.cx - bb.cx;
                    const dy = ba.cy - bb.cy;
                    const reach = ba.radius + bb.radius + reachPad;
                    if (dx * dx + dy * dy > reach * reach) continue;
                    game.solvePair(
                        ba.particles, bb.particles, a + b,
                        ba.cx, ba.cy, bb.cx, bb.cy
                    );
                }
            }
            game.collisionOrderFlip = !game.collisionOrderFlip;
            game.collisionPhase++;
    }

    updatePhysics() {
        const game = this.game;
            const subdt = Config.dt / Config.numSubsteps;
            const padding = 5;
            const floorY = game.floorLimitY();

            for (let step = 0; step < Config.numSubsteps; step++) {
                for (const p of game.particles) {
                    if (p === game.dragNode) continue;
                    if (game.particleInSpawnGrowBall?.(p)) continue;
                    p.vy += Config.gravity.y * subdt;
                    p.vx += Config.gravity.x * subdt;
                    p.px = p.x;
                    p.py = p.y;
                    p.x += p.vx * subdt;
                    p.y += p.vy * subdt;
                }

                if (game.dragNode) {
                    game.dragNode.x = game.mouse.x;
                    game.dragNode.y = game.mouse.y;
                    game.dragNode.px = game.mouse.x;
                    game.dragNode.py = game.mouse.y;
                }

                game.refreshBallCentroids();

                for (let iter = 0; iter < Config.pbdIterations; iter++) {
                    game.solveBallConstraints();

                    for (const p of game.particles) {
                        if (p.y > floorY) p.y = floorY;
                        if (p.x > Config.width - padding) p.x = Config.width - padding;
                        if (p.x < padding) p.x = padding;
                    }
                }

                game.solveTetrisWallCollisions();
                game.solveBallCollisions();
                game.solveTetrisWallCollisions();

                for (const p of game.particles) {
                    if (p.y > floorY) p.y = floorY;
                    if (p.x > Config.width - padding) p.x = Config.width - padding;
                    if (p.x < padding) p.x = padding;
                }

                for (const p of game.particles) {
                    if (p === game.dragNode) {
                        p.vx = 0;
                        p.vy = 0;
                        continue;
                    }
                    if (game.particleInSpawnGrowBall?.(p)) {
                        p.vx = 0;
                        p.vy = 0;
                        continue;
                    }

                    p.vx = (p.x - p.px) / subdt;
                    p.vy = (p.y - p.py) / subdt;

                    if (p.y >= floorY - 0.01 && p.vy > 0) {
                        p.vy = -p.vy * 0.1;
                        p.vx *= 0.8;
                    }
                    if (p.x <= 5.01 || p.x >= Config.width - 5.01) {
                        p.vx = -p.vx * 0.1;
                        p.vy *= 0.8;
                    }

                    p.vx *= 0.999;
                    p.vy *= 0.999;
                }

                if (step === Config.numSubsteps - 1) {
                    const driftBlend = 0.02;
                    const driftSpeedThreshold = 40;
                    const driftMeanVxThreshold = 8;
                    for (let b = 0; b < game.balls.length; b++) {
                        const pts = game.balls[b].particles;
                        let hasDragNode = false;
                        for (let i = 0; i < pts.length; i++) {
                            if (pts[i] === game.dragNode) {
                                hasDragNode = true;
                                break;
                            }
                        }
                        if (hasDragNode) continue;

                        let sumVx = 0;
                        let sumVy = 0;
                        for (let i = 0; i < pts.length; i++) {
                            sumVx += pts[i].vx;
                            sumVy += pts[i].vy;
                        }
                        const meanVx = sumVx / pts.length;
                        const meanVy = sumVy / pts.length;
                        const meanSpeed = Math.hypot(meanVx, meanVy);

                        if (meanSpeed > driftSpeedThreshold || Math.abs(meanVx) > driftMeanVxThreshold) continue;

                        for (let i = 0; i < pts.length; i++) {
                            pts[i].vx -= meanVx * driftBlend;
                        }
                    }
                }
            }
            game.refreshBallCentroids();
    }

}
