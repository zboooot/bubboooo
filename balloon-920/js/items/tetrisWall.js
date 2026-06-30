import * as Config from '../config.js';

/** 四格方块相对原点坐标 [col, row] */
export const TETROMINO_SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]],
    O: [[1, 0], [2, 0], [1, 1], [2, 1]],
    T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]],
    Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
    J: [[0, 0], [0, 1], [0, 2], [1, 2]],
    L: [[1, 0], [1, 1], [1, 2], [0, 2]],
};

export const TETRIS_WALL_COLORS = {
    base: '#5c6370',
    light: '#9aa3b2',
    edge: '#3d4450',
};

export const TETRIS_CELL_SIZE = 26;
export const TETRIS_MAX_WIDTH = Config.width * 0.5;

export function normalizeCells(cells) {
    const minX = Math.min(...cells.map((c) => c[0]));
    const minY = Math.min(...cells.map((c) => c[1]));
    return cells.map(([x, y]) => [x - minX, y - minY]);
}

export function rotateCells(cells, quarterTurns) {
    let out = cells.map(([x, y]) => [x, y]);
    const turns = ((quarterTurns % 4) + 4) % 4;
    for (let t = 0; t < turns; t++) {
        out = out.map(([x, y]) => [y, -x]);
        out = normalizeCells(out);
    }
    return out;
}

export function cellsBounds(cells, cellSize) {
    const maxC = Math.max(...cells.map((c) => c[0]));
    const maxR = Math.max(...cells.map((c) => c[1]));
    return {
        cols: maxC + 1,
        rows: maxR + 1,
        width: (maxC + 1) * cellSize,
        height: (maxR + 1) * cellSize,
    };
}

export function pickRandomTetromino(rng) {
    const keys = Object.keys(TETROMINO_SHAPES);
    const id = keys[Math.floor(rng() * keys.length)];
    const rotation = Math.floor(rng() * 4);
    const cells = rotateCells(TETROMINO_SHAPES[id], rotation);
    return { id, rotation, cells };
}

function gridKey(c, r) {
    return `${c},${r}`;
}

/** 将四连块格并集的外边界连成一圈多边形（局部像素坐标） */
export function tracePolyominoOutline(gridCells, cellSize) {
    const set = new Set(gridCells.map(([c, r]) => gridKey(c, r)));
    const segments = [];

    for (const [c, r] of gridCells) {
        const x0 = c * cellSize;
        const y0 = r * cellSize;
        const x1 = (c + 1) * cellSize;
        const y1 = (r + 1) * cellSize;
        if (!set.has(gridKey(c, r - 1))) segments.push([[x0, y0], [x1, y0]]);
        if (!set.has(gridKey(c + 1, r))) segments.push([[x1, y0], [x1, y1]]);
        if (!set.has(gridKey(c, r + 1))) segments.push([[x1, y1], [x0, y1]]);
        if (!set.has(gridKey(c - 1, r))) segments.push([[x0, y1], [x0, y0]]);
    }

    if (!segments.length) return [];

    const pointKey = ([x, y]) => `${x},${y}`;
    const segKey = (a, b) => `${pointKey(a)}>${pointKey(b)}`;
    const adj = new Map();

    for (const [a, b] of segments) {
        const ka = pointKey(a);
        if (!adj.has(ka)) adj.set(ka, []);
        adj.get(ka).push(b);
    }

    const used = new Set();
    const polygon = [];
    let from = segments[0][0];
    let to = segments[0][1];
    polygon.push(from);
    used.add(segKey(from, to));

    const startKey = pointKey(from);
    let guard = 0;
    while (pointKey(to) !== startKey && guard++ < segments.length + 4) {
        polygon.push(to);
        const nextCandidates = adj.get(pointKey(to)) || [];
        let next = null;
        for (let i = 0; i < nextCandidates.length; i++) {
            const candidate = nextCandidates[i];
            const k = segKey(to, candidate);
            if (!used.has(k)) {
                next = candidate;
                used.add(k);
                break;
            }
        }
        if (!next) break;
        to = next;
    }

    return polygon;
}

export function buildWallOutlineWorld(gridCells, cellSize, originX, originY) {
    const local = tracePolyominoOutline(gridCells, cellSize);
    return local.map(([x, y]) => [x + originX, y + originY]);
}

export const TETRIS_OUTLINE_CORNER_RADIUS = 5;

/** 外轮廓：凸角圆角，凹角保持直角 */
export function pathFromRoundedOutline(ctx, outline, cornerRadius = TETRIS_OUTLINE_CORNER_RADIUS) {
    const n = outline.length;
    if (n < 3) return false;

    let area = 0;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += outline[i][0] * outline[j][1] - outline[j][0] * outline[i][1];
    }
    const ccw = area > 0;

    let started = false;
    for (let i = 0; i < n; i++) {
        const prev = outline[(i - 1 + n) % n];
        const curr = outline[i];
        const next = outline[(i + 1) % n];
        const ax = curr[0] - prev[0];
        const ay = curr[1] - prev[1];
        const bx = next[0] - curr[0];
        const by = next[1] - curr[1];
        const cross = ax * by - ay * bx;
        const convex = ccw ? cross > 1e-6 : cross < -1e-6;

        const len1 = Math.hypot(ax, ay) || 1;
        const len2 = Math.hypot(bx, by) || 1;
        const rr = convex
            ? Math.min(cornerRadius, len1 * 0.42, len2 * 0.42)
            : 0;

        if (convex && rr > 0.5) {
            const pIn = [curr[0] - (ax / len1) * rr, curr[1] - (ay / len1) * rr];
            const pOut = [curr[0] + (bx / len2) * rr, curr[1] + (by / len2) * rr];
            if (!started) {
                ctx.moveTo(pIn[0], pIn[1]);
                started = true;
            } else {
                ctx.lineTo(pIn[0], pIn[1]);
            }
            ctx.quadraticCurveTo(curr[0], curr[1], pOut[0], pOut[1]);
        } else if (!started) {
            ctx.moveTo(curr[0], curr[1]);
            started = true;
        } else {
            ctx.lineTo(curr[0], curr[1]);
        }
    }
    ctx.closePath();
    return started;
}