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

        if (ctx.fromDart || ctx.fromBomb || ctx.fromChain) return [];

        const level = this.game.currentLevelSpec;
        const drops = [];
        const allowed = this._allowedDropSet(level);

        if (ctx.dartEligible && this._isDropAllowed(level, 'ninja_dart', allowed)) {
            const ninjaChance = this._resolveNinjaDartChance(level);
            if (ninjaChance > 0 && Math.random() < ninjaChance) {
                drops.push('ninja_dart');
            }
        }

        if (ctx.bombEligible && this._isDropAllowed(level, 'bomb', allowed)) {
            const bombChance = this._resolveBombChance(level);
            if (bombChance > 0 && Math.random() < bombChance) {
                drops.push('bomb');
            }
        }

        return drops.filter((id) => getItemDef(id));
    }

    _allowedDropSet(level) {
        if (!Array.isArray(level?.allowedDropItems)) return null;
        return new Set(level.allowedDropItems);
    }

    _isDropAllowed(level, itemId, allowed) {
        if (allowed) return allowed.has(itemId);
        if (level?.forceBombOnPop && itemId === 'ninja_dart') return false;
        if (level?.forceNinjaDartOnPop && itemId === 'bomb') return false;
        return true;
    }

    _resolveNinjaDartChance(level) {
        const cfg = level?.dropConfig?.ninja_dart;
        if (cfg != null) {
            if (typeof cfg === 'number') return cfg;
            if (typeof cfg.chance === 'number') return cfg.chance;
        }

        if (level?.forceNinjaDartOnPop) return 1;

        if (level?.testLevel || level?.forceBombOnPop) return 0;

        return Config.NINJA_DART_DEFAULT_DROP_CHANCE;
    }

    _resolveBombChance(level) {
        const cfg = level?.dropConfig?.bomb;
        if (cfg != null) {
            if (typeof cfg === 'number') return cfg;
            if (typeof cfg.chance === 'number') return cfg.chance;
        }

        if (level?.forceBombOnPop) return 1;

        if (level?.testLevel || level?.forceNinjaDartOnPop) return 0;

        return 0;
    }
}