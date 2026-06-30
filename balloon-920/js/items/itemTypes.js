/**
 * 道具类型定义与注册表
 *
 * 道具分两类（ItemSource）：
 * - embedded：关卡生成时预设在气泡内，随气泡状态变化（隐藏/显露），爆破时释放
 * - drop：气泡被撑爆时按掉落表概率产出，不占用气泡预设槽位
 */

/** @readonly */
export const ItemSource = {
    /** 关卡预设，绑在 ball.embeddedItem 上 */
    EMBEDDED: 'embedded',
    /** 爆破时 roll 产出，进入 itemPickups 列表 */
    DROP: 'drop',
};

/**
 * 道具运行时阶段
 * @readonly
 */
export const ItemPhase = {
    /** 嵌在球内，未显露 */
    HIDDEN: 'hidden',
    /** 嵌在球内，已显露（可选：打气到某阈值后可见） */
    REVEALED: 'revealed',
    /** 已脱离气泡，在场地上作为可拾取物 */
    LOOSE: 'loose',
    /** 已被玩家收集，等待生效或已生效 */
    COLLECTED: 'collected',
};

/**
 * 道具定义（静态配置，不含坐标）
 * @typedef {object} ItemDef
 * @property {string} id
 * @property {string} name
 * @property {ItemSource} defaultSource
 * @property {string} [icon] 渲染用标识
 * @property {boolean} [instantOnDrop] 掉落即生效，无需拾取
 * @property {'explosion'|null} [presentation] 爆炸类揭晓流程
 * @property {string} [accentColor] 揭晓背光色
 * @property {(game: object, item: import('./Item.js').Item, ctx: object) => void} [onCollect]
 */

/** @type {Record<string, ItemDef>} */
export const ITEM_REGISTRY = {
    ninja_dart: {
        id: 'ninja_dart',
        name: '忍者飞镖',
        defaultSource: ItemSource.DROP,
        icon: 'shuriken',
        instantOnDrop: true,
        presentation: 'explosion',
        accentColor: '#38bdf8',
    },
    clown_balloon: {
        id: 'clown_balloon',
        name: '小丑气球',
        defaultSource: ItemSource.EMBEDDED,
        icon: '🤡',
    },
    tetris_wall: {
        id: 'tetris_wall',
        name: '俄罗斯方块墙',
        defaultSource: ItemSource.EMBEDDED,
        icon: '▦',
    },
};

export function getItemDef(itemId) {
    return ITEM_REGISTRY[itemId] ?? null;
}