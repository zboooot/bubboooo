import { getItemDef } from './itemTypes.js';
import { popItemDropsForSpawnIndex } from '../level/levelItemPlacement.js';

/**
 * 爆破掉落：仅按关卡表 popItemDrops 固定投放（飞镖不随机）
 */
export class ItemDropTable {
    constructor(game) {
        this.game = game;
    }

    rollOnPop(ball, ctx) {
        const level = this.game.currentLevelSpec;
        const spawnIndex = ball.spawnIndex;
        if (spawnIndex == null || typeof spawnIndex !== 'number') return [];

        const ids = popItemDropsForSpawnIndex(level, spawnIndex);
        const drops = [];
        for (const itemId of ids) {
            if (!getItemDef(itemId)) continue;
            if (itemId === 'ninja_dart' && ctx.fromDart) continue;
            drops.push(itemId);
        }
        return drops;
    }
}