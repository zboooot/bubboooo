import { ItemSource } from './itemTypes.js';
import { Item } from './Item.js';

/**
 * 爆破掉落表：气泡撑爆时 roll 产出道具（第二类）
 *
 * TODO:
 * - 按气球颜色 team / paletteIndex 分池
 * - 按 combo 连击数加权
 * - 按关卡 tier 解锁掉落池
 * - 互斥与保底（pity）规则
 */
export class ItemDropTable {
    /**
     * @param {object} ball 被撑爆的气球
     * @param {object} ctx
     * @param {boolean} ctx.fromChain
     * @param {number} ctx.comboCount
     * @param {number} ctx.levelIndex
     * @returns {Item[]} 本次爆破产出的掉落物（可为空）
     */
    rollOnPop(ball, ctx) {
        // TODO: 实现掉落概率与条目选择
        // const pool = this._poolForBall(ball, ctx);
        // const itemId = weightedPick(pool, rng);
        // if (!itemId) return [];
        // return [new Item({ itemId, source: ItemSource.DROP, x: ball.cx, y: ball.cy, ... })];
        void ball;
        void ctx;
        return [];
    }
}