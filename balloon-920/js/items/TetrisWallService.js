import * as Config from '../config.js';
import { clamp, makeSeededRng, rollEphemeralSeed } from '../utils/math.js';
import {
    TETRIS_CELL_SIZE,
    TETRIS_MAX_WIDTH,
    TETRIS_WALL_COLORS,
    TETRIS_OUTLINE_CORNER_RADIUS,
    buildWallOutlineWorld,
    cellsBounds,
    pathFromRoundedOutline,
    pickRandomTetromino,
} from './tetrisWall.js';

/** 墙碰撞 slop；粗筛外扩与粒子检测共用 */
const WALL_COLLISION_SLOP = 2.2;
const WALL_BROADPHASE_PAD = WALL_COLLISION_SLOP + 3;
/** 每帧墙求解重复遍数，减少角点与深穿透 */
const WALL_SOLVE_PASSES = 2;

/** @param {{ x: number, y: number, w: number, h: number }[]} cells */
function aabbFromCells(cells, pad = 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.w);
        maxY = Math.max(maxY, c.y + c.h);
    }
    return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
    };
}

function aabbsOverlap(a, bMinX, bMinY, bMaxX, bMaxY) {
    return !(bMaxX < a.minX || bMinX > a.maxX || bMaxY < a.minY || bMinY > a.maxY);
}

function particleNearCell(px, py, cell, slop) {
    return (
        px >= cell.x - slop &&
        px <= cell.x + cell.w + slop &&
        py >= cell.y - slop &&
        py <= cell.y + cell.h + slop
    );
}

/** 关卡内俄罗斯方块形状金属墙 */
export class TetrisWallService {
    constructor(game) {
        this.game = game;
    }

    clearTetrisWalls() {
        this.game.tetrisWalls = [];
    }

    pickTetrisWallAt(x, y) {
        const game = this.game;
        if (!game.tetrisWalls?.length) return false;
        for (let w = 0; w < game.tetrisWalls.length; w++) {
            const wall = game.tetrisWalls[w];
            const a = wall.aabb;
            if (a && (x < a.minX || x > a.maxX || y < a.minY || y > a.maxY)) continue;
            for (const cell of wall.cells) {
                if (
                    x >= cell.x &&
                    x <= cell.x + cell.w &&
                    y >= cell.y &&
                    y <= cell.y + cell.h
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    spawnTetrisWallsForLevel(level) {
        const game = this.game;
        game.clearTetrisWalls();
        const count = Math.max(0, level.tetrisWallCount ?? 0);
        if (count <= 0) return;

        const rng = makeSeededRng(rollEphemeralSeed(level.seed ?? game.levelIndex ?? 0));
        const padX = Config.BALLOON_FIELD_PAD_X;
        const padTop = Config.BALLOON_FIELD_PAD_TOP;
        const floorY = game.floorLimitY() - 12;
        const playW = Config.width - padX * 2;

        const balloonBand = this._balloonVerticalExtents();
        const keepOut = this._balloonKeepOutGap();

        for (let n = 0; n < count; n++) {
            let placed = false;
            for (let attempt = 0; attempt < 64 && !placed; attempt++) {
                const piece = pickRandomTetromino(rng);
                const bounds = cellsBounds(piece.cells, TETRIS_CELL_SIZE);
                if (bounds.width > TETRIS_MAX_WIDTH + 0.5) continue;

                const maxX = padX + playW - bounds.width;
                const maxY = floorY - bounds.height;
                if (maxX <= padX || maxY <= padTop) continue;

                const originX = padX + rng() * (maxX - padX);
                const yMin = balloonBand
                    ? Math.min(maxY, balloonBand.bottom + keepOut)
                    : padTop;
                const preferBelow = balloonBand && yMin < maxY && rng() < 0.82;
                const originY = preferBelow
                    ? yMin + rng() * (maxY - yMin)
                    : padTop + rng() * (maxY - padTop);
                const cells = piece.cells.map(([c, r]) => ({
                    x: originX + c * TETRIS_CELL_SIZE,
                    y: originY + r * TETRIS_CELL_SIZE,
                    w: TETRIS_CELL_SIZE,
                    h: TETRIS_CELL_SIZE,
                }));

                if (!this._overlapsExisting(cells) && !this._overlapsBalls(cells)) {
                    const outline = buildWallOutlineWorld(
                        piece.cells,
                        TETRIS_CELL_SIZE,
                        originX,
                        originY,
                    );
                    const aabb = aabbFromCells(cells, WALL_BROADPHASE_PAD);
                    game.tetrisWalls.push({
                        id: piece.id,
                        rotation: piece.rotation,
                        cells,
                        outline,
                        aabb,
                        outlineBox: this._outlineBBox(outline),
                    });
                    game.sfx?.playTetrisWallSpawn?.();
                    placed = true;
                }
            }
        }
    }

    _overlapsExisting(cells) {
        const game = this.game;
        for (let w = 0; w < game.tetrisWalls.length; w++) {
            for (const a of cells) {
                for (const b of game.tetrisWalls[w].cells) {
                    if (this._rectsOverlap(a, b, 4)) return true;
                }
            }
        }
        return false;
    }

    /** 与气球软体轮廓保持间距，避免墙生成在球体内部 */
    _balloonKeepOutGap() {
        return 14;
    }

    /** @returns {{ top: number, bottom: number } | null} */
    _balloonVerticalExtents() {
        const game = this.game;
        if (!game.balls.length) return null;
        const gap = this._balloonKeepOutGap();
        let top = Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < game.balls.length; i++) {
            const ball = game.balls[i];
            game.syncBallBounds(ball);
            const r = Math.max(ball.boundsRadius, ball.radius) + gap;
            top = Math.min(top, ball.cy - r);
            bottom = Math.max(bottom, ball.cy + r);
        }
        return { top, bottom };
    }

    _overlapsBalls(cells) {
        const game = this.game;
        const gap = this._balloonKeepOutGap();
        for (let i = 0; i < game.balls.length; i++) {
            const ball = game.balls[i];
            game.syncBallBounds(ball);
            const pts = ball.particles;
            for (const cell of cells) {
                for (let p = 0; p < pts.length; p++) {
                    if (this._circleRectOverlap(pts[p].x, pts[p].y, gap, cell)) return true;
                }
                const hullR = Math.max(ball.boundsRadius, ball.radius) + gap;
                if (this._circleRectOverlap(ball.cx, ball.cy, hullR, cell)) return true;
            }
        }
        return false;
    }

    _rectsOverlap(a, b, gap = 0) {
        return !(
            a.x + a.w + gap <= b.x ||
            b.x + b.w + gap <= a.x ||
            a.y + a.h + gap <= b.y ||
            b.y + b.h + gap <= a.y
        );
    }

    _circleRectOverlap(cx, cy, r, rect) {
        const closestX = clamp(cx, rect.x, rect.x + rect.w);
        const closestY = clamp(cy, rect.y, rect.y + rect.h);
        const dx = cx - closestX;
        const dy = cy - closestY;
        return dx * dx + dy * dy < r * r;
    }

    resolveParticleVsTetrisWalls(particle, slop = WALL_COLLISION_SLOP) {
        const game = this.game;
        const walls = game.tetrisWalls;
        if (!walls?.length) return;
        const pad = WALL_BROADPHASE_PAD;
        for (let w = 0; w < walls.length; w++) {
            const wall = walls[w];
            const a = wall.aabb;
            if (
                a &&
                (particle.x < a.minX - pad ||
                    particle.x > a.maxX + pad ||
                    particle.y < a.minY - pad ||
                    particle.y > a.maxY + pad)
            ) {
                continue;
            }
            for (const cell of wall.cells) {
                if (!particleNearCell(particle.x, particle.y, cell, slop)) continue;
                this._pushParticleOutOfRect(particle, cell.x, cell.y, cell.x + cell.w, cell.y + cell.h, slop);
            }
        }
    }

    _pushParticleOutOfRect(p, minX, minY, maxX, maxY, slop) {
        const closestX = clamp(p.x, minX, maxX);
        const closestY = clamp(p.y, minY, maxY);
        let dx = p.x - closestX;
        let dy = p.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < 1e-10) {
            const penL = p.x - minX;
            const penR = maxX - p.x;
            const penT = p.y - minY;
            const penB = maxY - p.y;
            const minPen = Math.min(penL, penR, penT, penB);
            if (minPen === penL) p.x -= slop - minPen;
            else if (minPen === penR) p.x += slop - minPen;
            else if (minPen === penT) p.y -= slop - minPen;
            else p.y += slop - minPen;
            return;
        }

        if (distSq >= slop * slop) return;
        const dist = Math.sqrt(distSq);
        const pen = slop - dist;
        p.x += (dx / dist) * pen;
        p.y += (dy / dist) * pen;
    }

    solveTetrisWallCollisions() {
        const game = this.game;
        const walls = game.tetrisWalls;
        if (!walls?.length) return;
        const slop = WALL_COLLISION_SLOP;
        const pad = WALL_BROADPHASE_PAD;

        for (let pass = 0; pass < WALL_SOLVE_PASSES; pass++) {
            for (let b = 0; b < game.balls.length; b++) {
                const ball = game.balls[b];
                game.syncBallBounds(ball);
                const hullR = Math.max(ball.boundsRadius, ball.radius) + pad;
                const bMinX = ball.cx - hullR;
                const bMaxX = ball.cx + hullR;
                const bMinY = ball.cy - hullR;
                const bMaxY = ball.cy + hullR;

                const pts = ball.particles;
                for (let w = 0; w < walls.length; w++) {
                    const wall = walls[w];
                    const a = wall.aabb;
                    if (!a || !aabbsOverlap(a, bMinX, bMinY, bMaxX, bMaxY)) continue;

                    for (let i = 0; i < pts.length; i++) {
                        const p = pts[i];
                        if (p === game.dragNode) continue;
                        if (game.particleInSpawnGrowBall?.(p)) continue;
                        if (
                            p.x < a.minX - pad ||
                            p.x > a.maxX + pad ||
                            p.y < a.minY - pad ||
                            p.y > a.maxY + pad
                        ) {
                            continue;
                        }
                        for (const cell of wall.cells) {
                            if (!particleNearCell(p.x, p.y, cell, slop)) continue;
                            this._pushParticleOutOfRect(
                                p,
                                cell.x,
                                cell.y,
                                cell.x + cell.w,
                                cell.y + cell.h,
                                slop,
                            );
                        }
                    }
                }
            }
        }
    }

    _outlineBBox(outline) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < outline.length; i++) {
            const x = outline[i][0];
            const y = outline[i][1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
        return { minX, minY, maxX, maxY };
    }

    _traceWallPath(ctx, outline) {
        if (!outline?.length) return false;
        ctx.beginPath();
        return pathFromRoundedOutline(ctx, outline, TETRIS_OUTLINE_CORNER_RADIUS);
    }

    drawTetrisWalls(ctx) {
        const game = this.game;
        if (!game.tetrisWalls?.length) return;

        const { base, light, edge } = TETRIS_WALL_COLORS;
        for (const wall of game.tetrisWalls) {
            const outline = wall.outline;
            if (!this._traceWallPath(ctx, outline)) continue;

            const box = wall.outlineBox ?? this._outlineBBox(outline);
            const g = ctx.createLinearGradient(box.minX, box.minY, box.maxX, box.maxY);
            g.addColorStop(0, light);
            g.addColorStop(0.42, base);
            g.addColorStop(1, edge);
            ctx.fillStyle = g;
            ctx.fill();

            ctx.strokeStyle = 'rgba(20, 22, 28, 0.62)';
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.stroke();

            const shineW = Math.max(8, (box.maxX - box.minX) * 0.38);
            ctx.save();
            ctx.clip();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
            ctx.fillRect(box.minX + 3, box.minY + 3, shineW, 2.5);
            ctx.restore();
        }
    }
}