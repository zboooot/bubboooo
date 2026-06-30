import { ItemDropTable } from './ItemDropTable.js';
import { ItemSpawnPlanner } from './ItemSpawnPlanner.js';
import { ItemPhase } from './itemTypes.js';

/**
 * 道具子系统入口
 *
 * 职责：
 * 1. 关卡加载 → 为气球挂载 embedded 道具
 * 2. 气球爆破 → 释放 embedded + roll drop 道具
 * 3. 帧更新 →  loose 道具物理/寿命
 * 4. 拾取判定 → 触发道具效果（TODO）
 * 5. 渲染 → 由 Renderer 调用 drawItems（TODO）
 */
export class ItemService {
    constructor(game) {
        this.game = game;
        this.dropTable = new ItemDropTable();
        this.spawnPlanner = new ItemSpawnPlanner();
        /** @type {import('./Item.js').Item[]} 场上 loose / 待收集 */
        this.itemPickups = [];
    }

    // ─── 关卡生命周期 ───────────────────────────────────────────

    clearLevelItems() {
        this.itemPickups.length = 0;
        // TODO: 清理 ball.embeddedItem 引用（destroyBall 时同步）
    }

    /**
     * 气球生成后挂接预设道具
     * @param {object} ball
     * @param {number} spawnIndex
     * @param {object} level
     */
    onBalloonSpawn(ball, spawnIndex, level) {
        const rng = this.game.levelSpawnRng ?? (() => Math.random());
        const embedded = this.spawnPlanner.planEmbeddedForBalloon(level, spawnIndex, ball, rng);
        if (!embedded) return;

        embedded.hostBall = ball;
        embedded.x = ball.cx;
        embedded.y = ball.cy;
        ball.embeddedItem = embedded;

        // TODO: 可选 — 根据 meta.revealAtAir 在打气时切换 REVEALED 并绘制
    }

    // ─── 爆破链路 ───────────────────────────────────────────────

    /**
     * 气球被撑爆
     * @param {object} ball
     * @param {{ fromChain: boolean, comboCount: number }} ctx
     */
    onBalloonPop(ball, ctx) {
        const cx = ball.cx;
        const cy = ball.cy;

        // 1) 释放关卡预设道具
        this._releaseEmbedded(ball, cx, cy);

        // 2) 爆破掉落表
        const drops = this.dropTable.rollOnPop(ball, {
            ...ctx,
            levelIndex: this.game.levelIndex,
        });
        for (const item of drops) {
            this._spawnLoosePickup(item, cx, cy);
        }

        // TODO: 自动拾取 vs 点击拾取策略
        // TODO: 道具冲突（同帧多掉落）优先级
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

    _spawnLoosePickup(item, cx, cy) {
        item.releaseFromBall(cx, cy, {
            vx: (Math.random() - 0.5) * 80,
            vy: -80 - Math.random() * 60,
        });
        this.itemPickups.push(item);
    }

    // ─── 帧循环 ─────────────────────────────────────────────────

    updateItems(dt) {
        if (!this.itemPickups.length) return;

        // TODO: 重力、边界、与气球碰撞、超时消失
        for (let i = this.itemPickups.length - 1; i >= 0; i--) {
            const item = this.itemPickups[i];
            if (item.phase !== ItemPhase.LOOSE) continue;

            item.x += item.vx * dt;
            item.y += item.vy * dt;
            item.vy += 420 * dt;
            item.vx *= 0.98;

            // TODO: tryCollect(item)
            // TODO: if (item.life <= 0) remove
        }
    }

    /**
     * TODO: 在 Renderer.draw 之后或之前调用
     * @param {CanvasRenderingContext2D} ctx
     */
    drawItems(ctx) {
        void ctx;
        // TODO: loose 道具 sprite / 图标
        // TODO: embedded 在球内时的显露绘制（或由 drawBall 钩子处理）
    }

    // ─── 拾取与效果 ─────────────────────────────────────────────

    /**
     * TODO: 点击/触碰拾取
     * @param {number} x
     * @param {number} y
     */
    tryCollectAt(x, y) {
        void x;
        void y;
    }

    /**
     * TODO: 执行道具效果（改燃料、额外爆破、时间暂停等）
     * @param {import('./Item.js').Item} item
     */
    applyItemEffect(item) {
        const def = item.def;
        if (!def?.onCollect) return;
        // def.onCollect(this.game, item, { ... });
        void item;
    }
}