import { ItemPhase, getItemDef } from './itemTypes.js';
import { ItemDropTable } from './ItemDropTable.js';
import { ItemSpawnPlanner } from './ItemSpawnPlanner.js';
import { ItemRevealPresentation } from './ItemRevealPresentation.js';
import { NinjaDart } from './NinjaDart.js';
import { Bomb } from './Bomb.js';
import * as Config from '../config.js';

/**
 * 道具子系统入口
 */
export class ItemService {
    constructor(game) {
        this.game = game;
        this.dropTable = new ItemDropTable(game);
        this.spawnPlanner = new ItemSpawnPlanner();
        /** @type {import('./Item.js').Item[]} 场上 loose / 待收集 */
        this.itemPickups = [];
        /** @type {NinjaDart[]} 活跃忍者飞镖 */
        this.ninjaDarts = [];
        /** @type {Bomb[]} 活跃炸弹 */
        this.bombs = [];
        /** @type {ItemRevealPresentation|null} */
        this.itemReveal = null;
        /** 本次玩家操作是否已消耗飞镖触发名额（含判定失败） */
        this.dartActionConsumed = false;
        /** 本次玩家操作是否已消耗炸弹触发名额（含判定失败） */
        this.bombActionConsumed = false;
    }

    get isRevealActive() {
        return this.itemReveal != null;
    }

    get isAnchorHoldActive() {
        return this.itemReveal?.phase === 'anchor_hold';
    }

    /** 玩家新一轮打气操作开始，重置道具触发名额 */
    beginPlayerDartAction() {
        this.dartActionConsumed = false;
        this.bombActionConsumed = false;
    }

    clearLevelItems() {
        this.itemPickups.length = 0;
        this.ninjaDarts.length = 0;
        this.bombs.length = 0;
        this.itemReveal = null;
        this.game.itemRevealActive = false;
        this.game.itemRevealAnchorHold = false;
        this.dartActionConsumed = false;
        this.bombActionConsumed = false;
    }

    onBalloonSpawn(ball, spawnIndex, level) {
        const rng = this.game.levelSpawnRng ?? (() => Math.random());
        const embedded = this.spawnPlanner.planEmbeddedForBalloon(level, spawnIndex, ball, rng);
        if (!embedded) return;

        embedded.hostBall = ball;
        embedded.x = ball.cx;
        embedded.y = ball.cy;
        ball.embeddedItem = embedded;
    }

    onBalloonPop(ball, ctx) {
        const cx = ball.cx;
        const cy = ball.cy;

        this._releaseEmbedded(ball, cx, cy);

        const dartEligible = this._canAttemptDartRoll(ctx);
        if (dartEligible) this.dartActionConsumed = true;

        const bombEligible = this._canAttemptBombRoll(ctx);
        if (bombEligible) this.bombActionConsumed = true;

        const drops = this.dropTable.rollOnPop(ball, {
            ...ctx,
            levelIndex: this.game.levelIndex,
            dartEligible,
            bombEligible,
        });
        for (const itemId of drops) {
            this._activateDrop(itemId, ball);
        }
    }

    _canAttemptDartRoll(ctx) {
        if (ctx.fromDart || ctx.fromBomb || ctx.fromChain) return false;
        if (this.dartActionConsumed) return false;
        if (this.itemReveal || this.ninjaDarts.length > 0 || this.bombs.length > 0) return false;
        if (!this._isDropEnabledForLevel('ninja_dart')) return false;
        return true;
    }

    _canAttemptBombRoll(ctx) {
        if (ctx.fromBomb || ctx.fromDart || ctx.fromChain) return false;
        if (this.bombActionConsumed) return false;
        if (this.itemReveal || this.bombs.length > 0 || this.ninjaDarts.length > 0) return false;
        if (!this._isDropEnabledForLevel('bomb')) return false;
        return true;
    }

    _isDropEnabledForLevel(itemId) {
        const level = this.game.currentLevelSpec;
        if (Array.isArray(level?.allowedDropItems)) {
            return level.allowedDropItems.includes(itemId);
        }
        if (level?.forceBombOnPop && itemId === 'ninja_dart') return false;
        if (level?.forceNinjaDartOnPop && itemId === 'bomb') return false;

        const chance = itemId === 'ninja_dart'
            ? this.dropTable._resolveNinjaDartChance(level)
            : this.dropTable._resolveBombChance(level);
        return chance > 0;
    }

    _releaseEmbedded(ball, cx, cy) {
        const embedded = ball.embeddedItem;
        if (!embedded) return;

        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        embedded.releaseFromBall(cx, cy, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 40,
        });
        this.itemPickups.push(embedded);
        ball.embeddedItem = null;
    }

    _activateDrop(itemId, poppedBall) {
        const def = getItemDef(itemId);
        const pendingOpts = { excludeBall: poppedBall };

        if (def?.presentation === 'explosion') {
            this._startItemReveal(itemId, poppedBall.cx, poppedBall.cy, pendingOpts);
            return;
        }

        this._executeItemEffect(itemId, pendingOpts);
    }

    _startItemReveal(itemId, anchorX, anchorY, pendingOpts) {
        if (this.itemReveal || this.ninjaDarts.length > 0 || this.bombs.length > 0) return;

        this.game.activeInflateBall = null;
        this.game.dragNode = null;
        this.itemReveal = new ItemRevealPresentation({
            itemId,
            anchorX,
            anchorY,
            pendingOpts,
        });
        this.game.itemRevealAnchorHold = true;
        this.game.itemRevealActive = false;
    }

    _executeItemEffect(itemId, opts = {}) {
        if (itemId === 'ninja_dart') {
            this.spawnNinjaDart(opts);
            return;
        }
        if (itemId === 'bomb') {
            this.spawnBomb(opts);
        }
    }

    spawnNinjaDart(opts = {}) {
        if (this.ninjaDarts.length > 0) return null;

        const path = NinjaDart.pickFlightPath(this.game, opts);
        if (path == null) return null;

        const dart = new NinjaDart({ path });
        this.ninjaDarts.push(dart);
        return dart;
    }

    spawnBomb(opts = {}) {
        if (this.bombs.length > 0) return null;

        const radius = this._resolveBombRadius(opts);
        const target = Bomb.pickDropTarget(this.game, { ...opts, radius });
        if (target == null) return null;

        const bomb = new Bomb({
            targetX: target.x,
            targetY: target.y,
            radius,
        });
        this.bombs.push(bomb);
        return bomb;
    }

    _resolveBombRadius(opts = {}) {
        if (typeof opts.radius === 'number') return opts.radius;

        const level = this.game.currentLevelSpec;
        const cfg = level?.dropConfig?.bomb;
        if (cfg != null && typeof cfg.radius === 'number') return cfg.radius;

        return Config.BOMB_DEFAULT_EXPLOSION_RADIUS;
    }

    updateItems(dt) {
        this._updateItemReveal(dt);
        if (this.isRevealActive) return;

        this._updateNinjaDarts(dt);
        this._updateBombs(dt);
        this._updateLoosePickups(dt);
    }

    _updateItemReveal(dt) {
        if (!this.itemReveal) return;

        const wasAnchorHold = this.itemReveal.phase === 'anchor_hold';
        const status = this.itemReveal.update(dt);

        if (wasAnchorHold && this.itemReveal.phase !== 'anchor_hold') {
            this.game.itemRevealAnchorHold = false;
            this.game.itemRevealActive = true;
        }

        if (status !== 'complete') return;

        const { itemId, pendingOpts } = this.itemReveal;
        this.itemReveal = null;
        this.game.itemRevealActive = false;
        this.game.itemRevealAnchorHold = false;
        this._executeItemEffect(itemId, pendingOpts);
    }

    _updateNinjaDarts(dt) {
        if (!this.ninjaDarts.length) return;
        const game = this.game;
        for (let i = this.ninjaDarts.length - 1; i >= 0; i--) {
            const dart = this.ninjaDarts[i];
            dart.update(dt, game);
            if (!dart.alive) this.ninjaDarts.splice(i, 1);
        }
    }

    _updateBombs(dt) {
        if (!this.bombs.length) return;
        const game = this.game;
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            bomb.update(dt, game);
            if (!bomb.alive) this.bombs.splice(i, 1);
        }
    }

    _updateLoosePickups(dt) {
        if (!this.itemPickups.length) return;

        for (let i = this.itemPickups.length - 1; i >= 0; i--) {
            const item = this.itemPickups[i];
            if (item.phase !== ItemPhase.LOOSE) continue;

            item.x += item.vx * dt;
            item.y += item.vy * dt;
            item.vy += 420 * dt;
            item.vx *= 0.98;
        }
    }

    drawItems(ctx) {
        for (const bomb of this.bombs) {
            bomb.draw(ctx);
        }
        for (const dart of this.ninjaDarts) {
            dart.draw(ctx);
        }
    }

    drawItemReveal(ctx) {
        if (!this.itemReveal) return;
        this.itemReveal.draw(ctx, this.game);
    }
}