import * as Config from '../config.js';
import { getItemDef } from './itemTypes.js';

/**
 * 爆破掉落表：气泡撑爆时 roll 产出道具（第二类）
 */
export class ItemDropTable {
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {object} ball 被撑爆的气球
     * @param {object} ctx
     * @param {boolean} ctx.fromChain
     * @param {boolean} [ctx.fromDart]
     * @param {number} ctx.comboCount
     * @param {number} ctx.levelIndex
     * @returns {string[]} 本次爆破产出的道具 id 列表
     */
    rollOnPop(ball, ctx) {
        void ball;

        if (ctx.fromDart) return [];

        const level = this.game.currentLevelSpec;
        const drops = [];

        const ninjaChance = this._resolveNinjaDartChance(level, ctx);
        if (ninjaChance > 0 && Math.random() < ninjaChance) {
            drops.push('ninja_dart');
        }

        return drops.filter((id) => getItemDef(id));
    }

    _resolveNinjaDartChance(level, ctx) {
        const cfg = level?.dropConfig?.ninja_dart;
        if (cfg != null) {
            if (typeof cfg === 'number') return cfg;
            if (typeof cfg.chance === 'number') return cfg.chance;
        }

        if (level?.forceNinjaDartOnPop) return 1;

        let chance = Config.NINJA_DART_DEFAULT_DROP_CHANCE;
        if (ctx.fromChain && ctx.comboCount >= 3) {
            chance = Math.min(0.35, chance + 0.06);
        }
        return chance;
    }
}