export const TEAM_PALETTE = [
    { colorBase: '#d91e48', colorLight: '#ff6b85', defaultPump: 35, shortName: '红' },
    { colorBase: '#7b2fd4', colorLight: '#c49bff', defaultPump: 28, shortName: '紫' },
    { colorBase: '#0ea5b7', colorLight: '#5eead4', defaultPump: 30, shortName: '青' },
    { colorBase: '#e85d04', colorLight: '#ffb366', defaultPump: 28, shortName: '橙' },
    { colorBase: '#16a34a', colorLight: '#86efac', defaultPump: 26, shortName: '绿' },
    { colorBase: '#2563eb', colorLight: '#93c5fd', defaultPump: 26, shortName: '蓝' },
];

/**
 * 关卡道具字段（主线 / 测试关共用）：
 * - fieldBalloonSlots: [{ spawnIndex, kind: 'clown'|'rainbow' }]
 * - popItemDrops: [{ spawnIndex, itemId }]
 * - tetrisWallCount: number
 * - embeddedItems: [{ spawnIndex, itemId, meta? }]
 *
 * 主线投放（levelMainlineItems.js）：
 * 1–2 关无道具；3 关 1 次随机飞镖；4 关固定彩虹 + 概率 1 飞镖；
 * 1–3 关固定教学表（TUTORIAL_LEVELS），不参与程序关密度调整；
 * 5–8 关随机 1–2 种道具（不含飞镖）+ 概率 1 飞镖；4–8 关气筒燃料 ×2；4 关起 ×0.8 减球，5–8 关密度锚定第 4 关；
 * 9–14 关随机 1–2 种道具；15 关起墙/小丑加权 + 低概率飞镖/彩虹。
 */

export const TUTORIAL_LEVEL_COUNT = 3;

export const NINJA_DART_TEST_LEVEL = {
    id: 'test-ninja-dart',
    title: '忍者飞镖试炼',
    testLevel: true,
    balloonCountFactor: 0.78,
    layoutRadiusScale: 0.92,
    scatter: 0.04,
    activeTeams: [0, 1, 2],
    pump: [120, 120, 120],
    popItemDrops: [
        { spawnIndex: 2, itemId: 'ninja_dart' },
        { spawnIndex: 6, itemId: 'ninja_dart' },
        { spawnIndex: 11, itemId: 'ninja_dart' },
    ],
};

/** @type {Record<string, object>} */
export const TEST_LEVELS = {
    ninja_dart: NINJA_DART_TEST_LEVEL,
};

export const TUTORIAL_LEVELS = [
    {
        id: 1,
        title: '双筒热身',
        balloonCountFactor: 1,
        activeTeams: [0, 1],
        pump: [80, 80],
    },
    {
        id: 2,
        title: '三色加厚',
        balloonCountFactor: 1.12,
        activeTeams: [0, 1, 2],
        pump: [80, 80, 76],
    },
    {
        id: 3,
        title: '紧油考验',
        balloonCountFactor: 1.2,
        activeTeams: [0, 1, 2],
        pump: [80, 80, 30],
    },
];