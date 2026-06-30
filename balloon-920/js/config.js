export const APP_VERSION = '1.10';
export const APP_VERSION_DATE = '2026-06-30';

export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 800;

export const SAVE_KEY = 'balloon920_progress_v1';

export const width = LOGICAL_WIDTH;
export const height = LOGICAL_HEIGHT;

export const gravity = { x: 0, y: 1500 };
export const numSubsteps = 6;
export const pbdIterations = 2;
export const dt = 1 / 60;

export const MIN_BALLOON_RADIUS = 36;
export const MAX_BALLOON_RADIUS = 68;
export const BALLOON_PACK_GAP = 5;
/**
 * 关卡 1 锚点：后续关卡只在此基础上改 balloonCountFactor 等，气量/大小分布应沿用本配置。
 * - referenceCount：标准场上球数（≈ 蜂窝格 × countMultiplier，首关 factor=1）
 * - airBuckets：分档随机，避免整屏球看起来「差不多大」
 */
export const BASELINE_SPAWN = {
    countMultiplier: 1.3,
    /** 首关（balloonCountFactor≤1）各色气筒固定燃料 */
    levelOnePump: [80, 80],
    airBuckets: [
        { min: 12, max: 28 },
        { min: 29, max: 48 },
        { min: 49, max: 72 },
        { min: 73, max: 99 }
    ]
};

export const BALLOON_FIELD_PAD_X = 16;
export const BALLOON_FIELD_PAD_TOP = 12;
export const BALLOON_FIELD_PAD_BOTTOM = 8;
export const SMALL_BALLOON_AIR_START = 12;
export const SMALL_BALLOON_AIR_END = 99;
export const SMALL_BALLOON_RADIUS_MUL_AT_MAX_AIR = 0.6;
export const PARTICLES_PER_BALLOON = 20;
export const AIR_CAPACITY = 100;
export const PUMP_AIR_RATE = 164;
export const INFLATE_MAX_SCALE = 1.842;
export const FULL_POP_DELAY = 0.2;
export const CHAIN_POP_INTERVAL = 0.07;
export const CHAIN_PARTICLE_TOUCH = 16;
export const DRAG_MOVE_THRESHOLD = 12;
export const SHAKE_MIN_AIR_DELTA = 0.4;

export const PUMP_ZONE_HEIGHT = 100;
export const GROUND_Y = LOGICAL_HEIGHT - PUMP_ZONE_HEIGHT;

export const TRANSITION_GAP_SEC = 1.5;
export const TRANSITION_FADE_HALF_SEC = TRANSITION_GAP_SEC * 0.5;
export const LOSE_DELAY_SEC = TRANSITION_GAP_SEC;

/** 忍者飞镖：固定 V 形折返，随机左顶点 / 右顶点，严格沿折线飞行 */
export const NINJA_DART_SPEED = 1080;
export const NINJA_DART_HIT_RADIUS = 22;
export const NINJA_DART_OFFSCREEN = 48;
export const NINJA_DART_VISUAL_SIZE = 42;
export const NINJA_DART_TRAIL_LEN = 64;
export const NINJA_DART_SPIN_SPEED = 16;
/** 固定 V 形锚点（与示意图一致，不做动态偏移） */
export const NINJA_DART_ENTRY_Y = BALLOON_FIELD_PAD_TOP + 32;
export const NINJA_DART_APEX_Y = Math.round(GROUND_Y * 0.4);
export const NINJA_DART_EXIT_Y = GROUND_Y - 88;
/** 路线 A：右上 → 左顶点 → 右下 */
export const NINJA_DART_LEFT_APEX_X = 26;
/** 路线 B：左上 → 右顶点 → 左下 */
export const NINJA_DART_RIGHT_APEX_X = LOGICAL_WIDTH - 26;
export const NINJA_DART_DEFAULT_DROP_CHANCE = 0.18;

/** 爆炸类道具揭晓：爆破点停留 → 暗屏展示 → 淡出 → 效果发动 */
export const ITEM_REVEAL_ANCHOR_HOLD_SEC = 0.5;
export const ITEM_REVEAL_HOLD_SEC = 1.5;
export const ITEM_REVEAL_FADE_SEC = 0.45;
export const ITEM_REVEAL_MOVE_SEC = 0.55;