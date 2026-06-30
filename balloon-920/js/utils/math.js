/** 数学与随机工具 */

export function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
}

export function makeSeededRng(seed) {
        let s = (seed >>> 0) || 1;
        return function seededRandom() {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 4294967296;
        };
}

/** 每次调用不同的非复现种子（用于方块墙等需要每次随机的生成） */
export function rollEphemeralSeed(mix = 0) {
        const t = Date.now() >>> 0;
        const r = (Math.random() * 0xffffffff) >>> 0;
        return (t ^ r ^ ((mix >>> 0) * 2654435761)) >>> 0 || 1;
}
