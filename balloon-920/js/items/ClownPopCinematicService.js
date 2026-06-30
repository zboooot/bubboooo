import * as Config from '../config.js';
import {
    isGameplayFrozen as checkGameplayFrozen,
    resumeClownCinematicAfterReveal as runResumeClownCinematic,
    updateClownPopCinematic as tickClownPopCinematic,
    updateBalloonSpawnGrows as tickBalloonSpawnGrows,
    updateClownBurstSpawn as tickClownBurstSpawn,
} from './clownPopCinematic.js';

/** 小丑爆破演出：暂停玩法、暗屏烧毁、再生成气球 */
export class ClownPopCinematicService {
    constructor(game) {
        this.game = game;
    }

    isGameplayFrozen() {
        return checkGameplayFrozen(this.game);
    }

    resumeClownCinematicAfterReveal(snapshot) {
        runResumeClownCinematic(this.game, snapshot);
    }

    updateClownPopCinematic() {
        tickClownPopCinematic(this.game, Config.dt);
    }

    updateBalloonSpawnGrows() {
        tickBalloonSpawnGrows(this.game, Config.dt);
    }

    updateClownBurstSpawn() {
        tickClownBurstSpawn(this.game, Config.dt);
    }

    particleInSpawnGrowBall(particle) {
        const game = this.game;
        for (let i = 0; i < game.balls.length; i++) {
            const ball = game.balls[i];
            if (!ball.spawnGrow) continue;
            if (ball.particles.includes(particle)) return true;
        }
        return false;
    }
}