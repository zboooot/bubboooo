import * as Config from '../config.js';
import { beginClownPopCinematic } from './clownPopCinematic.js';
export { isClownBall, findClownsTouching, enqueueClownsNearPop } from './clownShared.js';

/** 小丑气球相对同关卡普通球布局半径放大 50% */
export const CLOWN_BALLOON_SIZE_MUL = 1.5;

/**
 * 在场地生成小丑气球（不可打气，白灰球体 + joker.png 哭脸贴图）
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function spawnClownBalloon(game, cx, cy, radius, meta = {}) {
    const base = radius ?? Config.MIN_BALLOON_RADIUS;
    const r = base * CLOWN_BALLOON_SIZE_MUL;
    game.createSoftBall(cx, cy, r, '#b8b8be', '#f2f2f5');
    const ball = game.balls[game.balls.length - 1];
    ball.role = 'clown';
    ball.air = Math.max(40, meta.air ?? 72);
    ball.clownCopyMin = meta.copyMin ?? 5;
    ball.clownCopyMax = meta.copyMax ?? 10;
    ball.labelLastCeil = Math.ceil(ball.air);
    game.applyBallAirVisual(ball);
    const visualR = r * game.currentInflateScale(ball);
    game.reshapeBallToCircle(ball, visualR);
    game.localRelaxBall(ball, 10);
    game.syncBallRestState(ball);
    return ball;
}

/**
 * 小丑爆破：2 秒演出后复制随机色球，不参与同色连锁
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function popClownBalloon(game, ball, fromChain = false) {
    beginClownPopCinematic(game, ball, fromChain);
}