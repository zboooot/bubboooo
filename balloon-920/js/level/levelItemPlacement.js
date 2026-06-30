/**
 * 关卡道具投放（固定表，不用随机 roll 飞镖）
 *
 * fieldBalloonSlots — 占用 layout spawnIndex，生成小丑 / 彩虹等特殊球
 * popItemDrops — 指定 spawnIndex 的气球被玩家撑爆时产出道具（如 ninja_dart）
 * tetrisWallCount — 场地墙（LevelService → TetrisWallService，不占用气球槽）
 */

/** @typedef {'clown'|'rainbow'} FieldBalloonKind */

/**
 * @param {object} level
 * @returns {Map<number, FieldBalloonKind>}
 */
export function fieldBalloonSlotMap(level) {
    const map = new Map();
    const slots = level?.fieldBalloonSlots;
    if (!Array.isArray(slots)) return map;
    for (const entry of slots) {
        if (entry == null || typeof entry.spawnIndex !== 'number') continue;
        const kind = entry.kind;
        if (kind === 'clown' || kind === 'rainbow') {
            map.set(entry.spawnIndex, kind);
        }
    }
    return map;
}

/**
 * @param {object} level
 * @param {number} spawnIndex
 * @returns {string[]}
 */
export function popItemDropsForSpawnIndex(level, spawnIndex) {
    const entries = level?.popItemDrops;
    if (!Array.isArray(entries)) return [];
    const out = [];
    for (const entry of entries) {
        if (entry?.spawnIndex === spawnIndex && entry.itemId) {
            out.push(entry.itemId);
        }
    }
    return out;
}

/**
 * @param {number} slotCount
 * @param {number} clownCount
 * @param {Set<number>} [reserved]
 * @param {() => number} rng
 */
export function buildClownPopDrops(slotCount, clownCount, reserved, rng) {
    const n = Math.max(1, Math.floor(slotCount));
    const want = Math.min(Math.max(0, clownCount), n);
    const blocked = reserved ?? new Set();
    const drops = [];
    const used = new Set(blocked);
    for (let k = 0; k < want; k++) {
        const free = [];
        for (let i = 0; i < n; i++) {
            if (!used.has(i)) free.push(i);
        }
        if (!free.length) break;
        const idx = free[Math.floor(rng() * free.length)];
        used.add(idx);
        drops.push({ spawnIndex: idx, itemId: 'clown_balloon' });
    }
    return drops;
}

/**
 * @param {number} balloonCount
 * @param {number} [dartCount=3]
 * @returns {{ spawnIndex: number, itemId: 'ninja_dart' }[]}
 */
export function defaultNinjaDartPopDrops(balloonCount, dartCount = 3) {
    const n = Math.max(1, Math.floor(balloonCount));
    const count = Math.min(dartCount, n);
    if (count <= 0) return [];
    const drops = [];
    for (let k = 0; k < count; k++) {
        const spawnIndex =
            count === 1
                ? Math.floor(n / 2)
                : Math.min(n - 1, Math.round(((k + 1) / (count + 1)) * n));
        drops.push({ spawnIndex, itemId: 'ninja_dart' });
    }
    return drops;
}