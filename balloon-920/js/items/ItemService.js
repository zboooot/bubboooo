import { ItemPhase } from './itemTypes.js';
import { ItemDropTable } from './ItemDropTable.js';
import { ItemSpawnPlanner } from './ItemSpawnPlanner.js';
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
    }

    clearLevelItems() {
        this.itemPickups.length = 0;
        this.ninjaDarts.length = 0;
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

        const drops = this.dropTable.rollOnPop(ball, {
            ...ctx,
            levelIndex: this.game.levelIndex,
        });
        for (const itemId of drops) {
            this._activateDrop(itemId, cx, cy);
        }
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

    _activateDrop(itemId, cx, cy) {
        void cx;
        void cy;
        if (itemId === 'ninja_dart') {
            this.spawnNinjaDart();
        }
    }

    spawnNinjaDart(opts = {}) {
        if (this.ninjaDarts.length > 0) return null;
        const dart = new NinjaDart(opts);
        this.ninjaDarts.push(dart);
        return dart;
    }

    updateItems(dt) {
        this._updateNinjaDarts(dt);
        this._updateLoosePickups(dt);
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
}