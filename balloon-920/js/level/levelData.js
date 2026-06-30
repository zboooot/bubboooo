export const TEAM_PALETTE = [
    { colorBase: '#d91e48', colorLight: '#ff6b85', defaultPump: 35, shortName: '红' },
    { colorBase: '#7b2fd4', colorLight: '#c49bff', defaultPump: 28, shortName: '紫' },
    { colorBase: '#0ea5b7', colorLight: '#5eead4', defaultPump: 30, shortName: '青' },
    { colorBase: '#e85d04', colorLight: '#ffb366', defaultPump: 28, shortName: '橙' },
    { colorBase: '#16a34a', colorLight: '#86efac', defaultPump: 26, shortName: '绿' },
    { colorBase: '#2563eb', colorLight: '#93c5fd', defaultPump: 26, shortName: '蓝' }
];

/** 主线固定教学关数量（不含测试关） */
export const TUTORIAL_LEVEL_COUNT = 3;

/** 独立测试关，仅通过 ?test=ninja_dart 进入，不计入主线进度 */
export const NINJA_DART_TEST_LEVEL = {
    id: 'test-ninja-dart',
    title: '忍者飞镖试炼',
    testLevel: true,
    balloonCountFactor: 0.78,
    layoutRadiusScale: 0.92,
    scatter: 0.04,
    activeTeams: [0, 1, 2],
    pump: [120, 120, 120],
    forceNinjaDartOnPop: true,
    dropConfig: {
        ninja_dart: { chance: 1 },
    },
};

/** @type {Record<string, object>} */
export const TEST_LEVELS = {
    ninja_dart: NINJA_DART_TEST_LEVEL,
};

/** 新手基础关（固定，不 procedurally 生成） */
export const TUTORIAL_LEVELS = [
    {
        id: 1,
        title: '双筒热身',
        balloonCountFactor: 1,
        activeTeams: [0, 1],
        pump: [80, 80]
    },
    {
        id: 2,
        title: '三色加厚',
        balloonCountFactor: 1.12,
        activeTeams: [0, 1, 2],
        pump: [80, 80, 76]
    },
    {
        id: 3,
        title: '紧油考验',
        balloonCountFactor: 1.2,
        activeTeams: [0, 1, 2],
        pump: [80, 80, 30]
    }
];