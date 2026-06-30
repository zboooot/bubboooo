import { TEAM_PALETTE } from './levelData.js';

export const DEFAULT_TEST_LAB = {
    balloonCount: 10,
    clownCount: 1,
    clownCopyMin: 5,
    clownCopyMax: 10,
    teamCount: 3,
    itemMode: 'clown',
    tetrisWallCount: 1,
    scatter: 0.2,
    layoutRadiusScale: 0.95,
};

/**
 * @param {object} params
 * @returns {object} level spec
 */
export function buildTestLabLevelSpec(params) {
    const p = { ...DEFAULT_TEST_LAB, ...params };
    const teamCount = Math.min(TEAM_PALETTE.length, Math.max(2, p.teamCount));
    const activeTeams = [];
    for (let i = 0; i < teamCount; i++) activeTeams.push(i);
    const pump = activeTeams.map(() => 120);
    const spec = {
        id: 0,
        title: '测试关卡',
        testLab: true,
        procedural: false,
        seed: null,
        balloonCount: Math.max(0, p.balloonCount),
        clownCount: Math.max(0, p.clownCount),
        clownCopyMin: Math.max(1, p.clownCopyMin),
        clownCopyMax: Math.max(p.clownCopyMin, p.clownCopyMax),
        itemMode: p.itemMode,
        tetrisWallCount: Math.max(0, p.tetrisWallCount ?? 0),
        balloonCountFactor: 1,
        layoutRadiusScale: p.layoutRadiusScale ?? 0.95,
        scatter: p.scatter ?? 0.2,
        activeTeams,
        pump,
        embeddedItems: [],
    };

    if (p.itemMode === 'ninja_dart') {
        spec.forceNinjaDartOnPop = true;
        spec.dropConfig = { ninja_dart: { chance: 1 } };
    }

    return spec;
}