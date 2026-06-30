import { ItemPhase, getItemDef } from './itemTypes.js';
import { ItemDropTable } from './ItemDropTable.js';
import { ItemSpawnPlanner } from './ItemSpawnPlanner.js';
import { ItemRevealPresentation } from './ItemRevealPresentation.js';
import { NinjaDart } from './NinjaDart.js';

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
        /** @type {ItemRevealPresentation|null} */
        this.itemReveal = null;
        /** 本次玩家操作是否已消耗飞镖触发名额（含判定失败） */
        this.dartActionConsumed = false;
    }

    get isRevealActive() {
        return this.itemReveal != null;
    }

    get isAnchorHoldActive() {
        return this.itemReveal?.phase === 'anchor_hold';
    }

    /** 玩家新一轮打气操作开始，重置飞镖触发名额 */
    beginPlayerDartAction() {
        this.dartActionConsumed = false;
    }

    clearLevelItems() {
        this.itemPickups.length = 0;
        this.ninjaDarts.length = 0;
        this.itemReveal = null;
        this.game.itemRevealActive = false;
        this.game.itemRevealAnchorHold = false;
        this.dartActionConsumed = false;
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

        const drops = this.dropTable.rollOnPop(ball, {
            ...ctx,
            levelIndex: this.game.levelIndex,
            dartEligible,
        });
        for (const itemId of drops) {
            this._activateDrop(itemId, ball);
        }
    }

    _canAttemptDartRoll(ctx) {
        if (ctx.fromDart || ctx.fromChain) return false;
        if (this.dartActionConsumed) return false;
        if (this.itemReveal || this.ninjaDarts.length > 0) return false;
        return true;
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
        if (this.itemReveal || this.ninjaDarts.length > 0) return;

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

    updateItems(dt) {
        this._updateItemReveal(dt);
        if (this.isRevealActive) return;

        this._updateNinjaDarts(dt);
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
        for (const dart of this.ninjaDarts) {
            dart.draw(ctx);
        }
    }

    drawItemReveal(ctx) {
        if (!this.itemReveal) return;
        this.itemReveal.draw(ctx, this.game);
    }
}