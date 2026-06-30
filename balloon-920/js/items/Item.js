import { ItemPhase, ItemSource, getItemDef } from './itemTypes.js';

let _nextItemUid = 1;

/**
 * 道具运行时实体
 * - embedded：通常引用自 ball.embeddedItem，pop 时转为 loose
 * - drop：pop 时直接在爆破点创建 loose 实例
 */
export class Item {
    /**
     * @param {object} opts
     * @param {string} opts.itemId
     * @param {import('./itemTypes.js').ItemSource} opts.source
     * @param {number} [opts.x]
     * @param {number} [opts.y]
     * @param {import('./itemTypes.js').ItemPhase} [opts.phase]
     * @param {object} [opts.meta] 关卡预设附加参数 / 掉落上下文
     */
    constructor({ itemId, source, x = 0, y = 0, phase = ItemPhase.LOOSE, meta = {} }) {
        this.uid = _nextItemUid++;
        this.itemId = itemId;
        this.source = source;
        this.phase = phase;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.life = 1;
        this.maxLife = 1;
        this.meta = meta;
        /** @type {object|null} 绑定的气球引用，仅 embedded 且未 loose 时有效 */
        this.hostBall = null;
    }

    get def() {
        return getItemDef(this.itemId);
    }

    /** @returns {boolean} */
    isEmbedded() {
        return this.source === ItemSource.EMBEDDED;
    }

    /** @returns {boolean} */
    isLoose() {
        return this.phase === ItemPhase.LOOSE;
    }

    /**
     * 从气泡脱离，进入场地
     * @param {number} x
     * @param {number} y
     * @param {{ vx?: number, vy?: number }} [impulse]
     */
    releaseFromBall(x, y, impulse = {}) {
        this.phase = ItemPhase.LOOSE;
        this.x = x;
        this.y = y;
        this.vx = impulse.vx ?? 0;
        this.vy = impulse.vy ?? 0;
        this.hostBall = null;
    }

    markCollected() {
        this.phase = ItemPhase.COLLECTED;
    }
}