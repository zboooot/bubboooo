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
