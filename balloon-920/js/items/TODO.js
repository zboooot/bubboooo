/**
 * 道具模块实施清单（按推荐顺序）
 *
 * ━━ 一、数据与注册 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] itemTypes.js — 在 ITEM_REGISTRY 注册首批道具定义
 * [ ] itemTypes.js — 为每个道具实现 onCollect(game, item, ctx) 效果
 * [ ] levelData.js — 教学关 TUTORIAL_LEVELS 增加 embeddedItems 示例字段
 * [ ] LevelService.generateProceduralLevel — 支持程序关 embeddedItemDensity / pool
 *
 * ━━ 二、第一类：关卡预设（embedded）━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] ItemSpawnPlanner.planEmbeddedForBalloon — 完整读取 level.embeddedItems
 * [ ] ItemSpawnPlanner.planProceduralEmbedded — 程序关按种子分配预设
 * [ ] ItemService.onBalloonSpawn — 挂载 ball.embeddedItem
 * [ ] TODO 可选：打气到阈值后 phase → REVEALED，Renderer 球内显露图标
 * [ ] ItemService._releaseEmbedded — 爆破弹出动画与初速度调参
 *
 * ━━ 三、第二类：爆破掉落（drop）━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] ItemDropTable — 按颜色/关卡/combo 配置掉落池与权重
 * [ ] ItemDropTable.rollOnPop — 实现 weightedPick + 空掉落
 * [ ] ItemService.onBalloonPop — 与 embedded 释放顺序、同帧上限
 *
 * ━━ 四、场上行为 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] ItemService.updateItems — 重力、地面界、寿命衰减、移除
 * [ ] ItemService.tryCollectAt — 点击拾取或与打气命中判定
 * [ ] ItemService.applyItemEffect — 统一效果入口（燃料+/范围爆/等）
 * [ ] InputController.startDrag — 可选：优先检测 itemPickups 点击
 *
 * ━━ 五、表现 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] ItemService.drawItems — loose 道具绘制
 * [ ] Renderer.draw — 球内 embedded 图标（REVEALED 时）
 * [ ] Sfx — 掉落/拾取音效
 *
 * ━━ 六、挂钩点（已接入，待填逻辑）━━━━━━━━━━━━━━━━━━━━━━━━
 * ✓ LevelService.spawnBalloonsWithLayout → game.onBalloonSpawn(ball, i, level)
 * ✓ BalloonService.popBalloon         → game.onBalloonPop(ball, ctx)
 * ✓ LevelService.clearWorld           → game.clearLevelItems()
 * ✓ BalloonGameApp.loop               → game.updateItems(dt)
 * ✓ Renderer.draw                     → game.drawItems(ctx)
 *
 * ━━ 七、验收 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ ] 无道具配置时，玩法与表现与当前版本完全一致
 * [ ] 教学关可放置 1 个 embedded 道具，撑爆后可见并拾取
 * [ ] 掉落表可配置 1 种 drop 道具，撑爆有概率产出
 */

export const ITEM_MODULE_TODO_VERSION = 1;