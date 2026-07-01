import { makeSeededRng } from '../utils/math.js';

/** @typedef {'ninja_dart'|'rainbow'|'clown'|'tetris_wall'} MainlineItemType */

const ALL_ITEM_TYPES = /** @type {MainlineItemType[]} */ ([
    'ninja_dart',
    'rainbow',
    'clown',
    'tetris_wall',
]);

/** 主线第 4–8 关：每关独立掷一次，成功则固定投放 1 个飞镖（绑定随机 spawnIndex） */
export const MAINLINE_LEVEL_4_8_DART_PROB = 0.5;
/** 主线第 4–8 关：相对程序生成基准的场上球数系数（0.8 = 少 20%） */
export const MAINLINE_LEVEL_4_8_BALLOON_COUNT_MUL = 0.8;

const ITEM_TYPES_WITHOUT_DART = ALL_ITEM_TYPES.filter((t) => t !== 'ninja_dart');

export function mergeMainlineItemFields(target, fields) {
    target.fieldBalloonSlots = fields.fieldBalloonSlots ?? [];
    target.popItemDrops = fields.popItemDrops ?? [];
    target.tetrisWallCount = fields.tetrisWallCount ?? 0;
}

export function buildMainlineItemFields(levelIndex, slotCount, rng) {
    const n = Math.max(1, Math.floor(slotCount));
    const levelNum = levelIndex + 1;
    const out = {
        fieldBalloonSlots: /** @type {{ spawnIndex: number, kind: 'clown'|'rainbow' }[]} */ ([]),
        popItemDrops: /** @type {{ spawnIndex: number, itemId: string }[]} */ ([]),
        tetrisWallCount: 0,
    };

    if (levelNum <= 2) return out;

    const used = new Set();

    if (levelNum === 3) {
        const idx = pickPopDropIndex(n, used, rng);
        if (idx >= 0) out.popItemDrops.push({ spawnIndex: idx, itemId: 'ninja_dart' });
        return out;
    }

    if (levelNum === 4) {
        const idx = defaultRainbowSpawnIndex(n);
        out.fieldBalloonSlots.push({ spawnIndex: idx, kind: 'rainbow' });
        tryAddOneNinjaDartDrop(out, n, used, rng);
        return out;
    }

    if (levelNum >= 5 && levelNum <= 8) {
        const typeCount = rng() < 0.42 ? 1 : 2;
        const types = pickDistinctTypes(ITEM_TYPES_WITHOUT_DART, typeCount, rng);
        applyItemTypes(out, types, n, used, rng);
        tryAddOneNinjaDartDrop(out, n, used, rng);
        return out;
    }

    if (levelNum >= 9 && levelNum <= 14) {
        const typeCount = rng() < 0.42 ? 1 : 2;
        const types = pickDistinctTypes(ALL_ITEM_TYPES, typeCount, rng);
        applyItemTypes(out, types, n, used, rng);
        return out;
    }

    if (levelNum >= 15) {
        const wallCount = weightedPick([0, 1, 1, 2, 2], rng);
        out.tetrisWallCount = wallCount;

        const clownCount = weightedPick([0, 1, 1, 2], rng);
        for (let c = 0; c < clownCount; c++) {
            const idx = pickFieldSlot(n, used, rng);
            if (idx < 0) break;
            out.fieldBalloonSlots.push({ spawnIndex: idx, kind: 'clown' });
        }

        if (rng() < 0.18) {
            const idx = pickPopDropIndex(n, used, rng);
            if (idx >= 0) out.popItemDrops.push({ spawnIndex: idx, itemId: 'ninja_dart' });
        }
        if (rng() < 0.22) {
            const idx = pickFieldSlot(n, used, rng);
            if (idx >= 0) out.fieldBalloonSlots.push({ spawnIndex: idx, kind: 'rainbow' });
        }
    }

    return out;
}

export function mainlineItemSeed(levelIndex, slotCount) {
    return (levelIndex + 1) * 8803 + slotCount * 97 + 4049;
}

export function applyMainlineItemPlan(level, levelIndex, slotCount) {
    if (level.testLevel || level.testLab) return;
    const levelNum = levelIndex + 1;
    if (levelNum <= 2) {
        mergeMainlineItemFields(level, {
            fieldBalloonSlots: [],
            popItemDrops: [],
            tetrisWallCount: 0,
        });
        return;
    }
    const rng = makeSeededRng(mainlineItemSeed(levelIndex, slotCount));
    const fields = buildMainlineItemFields(levelIndex, slotCount, rng);
    mergeMainlineItemFields(level, fields);
}

function defaultRainbowSpawnIndex(n) {
    return Math.min(n - 1, Math.max(0, Math.floor(n * 0.42)));
}

function tryAddOneNinjaDartDrop(out, n, used, rng) {
    if (out.popItemDrops.some((d) => d.itemId === 'ninja_dart')) return;
    if (rng() >= MAINLINE_LEVEL_4_8_DART_PROB) return;
    const idx = pickPopDropIndex(n, used, rng);
    if (idx >= 0) out.popItemDrops.push({ spawnIndex: idx, itemId: 'ninja_dart' });
}

function pickFieldSlot(n, used, rng) {
    const free = [];
    for (let i = 0; i < n; i++) {
        if (!used.has(i)) free.push(i);
    }
    if (!free.length) return -1;
    const idx = free[Math.floor(rng() * free.length)];
    used.add(idx);
    return idx;
}

function pickPopDropIndex(n, used, rng) {
    const free = [];
    for (let i = 0; i < n; i++) {
        if (!used.has(i)) free.push(i);
    }
    if (!free.length) return -1;
    return free[Math.floor(rng() * free.length)];
}

function pickDistinctTypes(pool, count, rng) {
    const copy = pool.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(count, copy.length));
}

function weightedPick(weights, rng) {
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return weights[i];
    }
    return weights[weights.length - 1];
}

function applyItemTypes(out, types, n, used, rng) {
    for (let t = 0; t < types.length; t++) {
        const type = types[t];
        if (type === 'ninja_dart') {
            const idx = pickPopDropIndex(n, used, rng);
            if (idx >= 0) out.popItemDrops.push({ spawnIndex: idx, itemId: 'ninja_dart' });
        } else if (type === 'rainbow') {
            const idx = pickFieldSlot(n, used, rng);
            if (idx >= 0) out.fieldBalloonSlots.push({ spawnIndex: idx, kind: 'rainbow' });
        } else if (type === 'clown') {
            const idx = pickFieldSlot(n, used, rng);
            if (idx >= 0) out.fieldBalloonSlots.push({ spawnIndex: idx, kind: 'clown' });
        } else if (type === 'tetris_wall') {
            out.tetrisWallCount = Math.min(2, Math.max(1, out.tetrisWallCount + 1));
        }
    }
}