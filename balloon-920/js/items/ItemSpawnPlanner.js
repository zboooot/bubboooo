import { ItemPhase, ItemSource, canEmbedItemInBalloon } from './itemTypes.js';
import { Item } from './Item.js';

/**
 * 关卡预设规划：在气泡生成时分配内置道具（第一类）
 *
 * 关卡数据扩展约定（TODO 写入 levelData / LevelService）：
 *
 * ```js
 * {
 *   embeddedItems: [
 *     { spawnIndex: 2, itemId: 'fuel_pack' },
 *     { spawnIndex: 5, itemId: 'bomb', meta: { radius: 80 } },
 *   ],
 *   // 或 procedual: embeddedItemDensity, embeddedItemPool, ...
 * }
 * ```
 */
export class ItemSpawnPlanner {
    /**
     * @param {object} level 当前关卡 spec
     * @param {number} spawnIndex 气球在 layout 中的序号
     * @param {object} ball 刚创建的气球
     * @param {() => number} rng
     * @returns {Item|null}
     */
    planEmbeddedForBalloon(level, spawnIndex, ball, rng) {
        void rng;

        const entries = level.embeddedItems;
        if (!Array.isArray(entries)) return null;

        const entry = entries.find((e) => e.spawnIndex === spawnIndex);
        if (!entry?.itemId) return null;
        if (!canEmbedItemInBalloon(entry.itemId)) return null;

        return new Item({
            itemId: entry.itemId,
            source: ItemSource.EMBEDDED,
            phase: ItemPhase.HIDDEN,
            x: ball.cx,
            y: ball.cy,
            meta: entry.meta ?? {},
        });
    }

    /**
     * TODO: 程序关按种子自动生成 embedded 布局
     * @param {object} level
     * @param {number} spawnCount
     * @param {() => number} rng
     * @returns {Map<number, Item>}
     */
    planProceduralEmbedded(level, spawnCount, rng) {
        void level;
        void spawnCount;
        void rng;
        return new Map();
    }
}