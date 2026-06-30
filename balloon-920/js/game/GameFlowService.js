import * as Config from '../config.js';
import { isClownBall } from '../items/clownBalloon.js';

/** GameFlowService */
export class GameFlowService {
    constructor(game) {
        this.game = game;
    }

    balloonCountOnPumpSlot(slot) {
        const game = this.game;
            let n = 0;
            for (let i = 0; i < game.balls.length; i++) {
                const b = game.balls[i];
                if (isClownBall(b)) continue;
                if (game.pumpSlotForBall(b) === slot) n++;
            }
            return n;
    }

    canFullyPopBallNow(ball) {
        const game = this.game;
            if (isClownBall(ball)) return false;
            if (ball.air <= 0) return true;
            const slot = game.pumpSlotForBall(ball);
            if (slot < 0) return false;
            return (game.pumpFuelRemaining[slot] ?? 0) >= ball.air;
    }

    isLevelUnwinnable() {
        const game = this.game;
            if (game.balls.length === 0) return false;

            for (let slot = 0; slot < game.activeTeams.length; slot++) {
                if (game.balloonCountOnPumpSlot(slot) > 0 && (game.pumpFuelRemaining[slot] ?? 0) <= 0) {
                    return true;
                }
            }

            for (let i = 0; i < game.balls.length; i++) {
                if (game.canFullyPopBallNow(game.balls[i])) return false;
            }
            return true;
    }

    checkLevelLose() {
        const game = this.game;
            if (game.gameOutcome !== 'playing') return;
            if (game.balls.length === 0) {
                game.loseCountdown = null;
                return;
            }
            if (!game.isLevelUnwinnable()) {
                game.loseCountdown = null;
                game.updateLevelHud();
                return;
            }
            if (game.loseCountdown == null) game.loseCountdown = Config.LOSE_DELAY_SEC;
            game.updateLevelHud();
    }

    updateLoseCountdown() {
        const game = this.game;
            if (game.gameOutcome !== 'playing') return;
            if (game.loseCountdown == null) return;
            if (game.balls.length === 0 || !game.isLevelUnwinnable()) {
                game.loseCountdown = null;
                game.updateLevelHud();
                return;
            }
            game.loseCountdown -= Config.dt;
            game.updateLevelHud();
            if (game.loseCountdown <= 0) {
                game.loseCountdown = null;
                game.gameOutcome = 'lost';
                game.activeInflateBall = null;
                game.playOutcomeSoundOnce('lost');
                game.updateLevelHud();
            }
    }

    checkLevelWin() {
        const game = this.game;
            if (game.gameOutcome !== 'playing') return;
            if (game.balls.length > 0) return;
            game.loseCountdown = null;
            if (game.winRevealCountdown == null) game.winRevealCountdown = Config.TRANSITION_GAP_SEC;
            game.activeInflateBall = null;
            game.updateLevelHud();
    }

    updateWinRevealCountdown() {
        const game = this.game;
            if (game.gameOutcome !== 'playing') return;
            if (game.winRevealCountdown == null) return;
            game.winRevealCountdown -= Config.dt;
            game.updateLevelHud();
            if (game.winRevealCountdown <= 0) {
                game.winRevealCountdown = null;
                game.gameOutcome = 'won';
                game.activeInflateBall = null;
                game.playOutcomeSoundOnce('won');
                game.spawnWinCelebrate();
                game.updateLevelHud();
            }
    }

    spawnWinCelebrate() {
        const game = this.game;
            if (game.winCelebrateSpawned) return;
            game.winCelebrateSpawned = true;
            game.celebrateEffects.length = 0;
            const colors = ['#ffffff', '#fff7ed', '#fb923c', '#fdba74', '#fde047', '#ff6b9d'];
            const emitters = [
                { x: 16, y: Config.GROUND_Y * 0.44 },
                { x: Config.width - 16, y: Config.GROUND_Y * 0.44 }
            ];
            for (let e = 0; e < emitters.length; e++) {
                const em = emitters[e];
                const dir = em.x < Config.width * 0.5 ? 1 : -1;
                for (let i = 0; i < 64; i++) {
                    game.celebrateEffects.push({
                        x: em.x + (Math.random() - 0.5) * 12,
                        y: em.y + (Math.random() - 0.5) * 10,
                        vx: dir * (100 + Math.random() * 320) + (Math.random() - 0.5) * 40,
                        vy: -(140 + Math.random() * 360),
                        life: 0.85 + Math.random() * 1.35,
                        maxLife: 1,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        size: 1.8 + Math.random() * 3.2,
                        twinkle: Math.random() * Math.PI * 2
                    });
                }
            }
    }

    updateCelebrateEffects() {
        const game = this.game;
            for (let i = game.celebrateEffects.length - 1; i >= 0; i--) {
                const fx = game.celebrateEffects[i];
                fx.life -= Config.dt;
                if (fx.life <= 0) {
                    game.celebrateEffects.splice(i, 1);
                    continue;
                }
                fx.x += fx.vx * Config.dt;
                fx.y += fx.vy * Config.dt;
                fx.vy += 280 * Config.dt;
                fx.vx *= 0.985;
                fx.twinkle += Config.dt * 14;
            }
    }

    comboTierForCount(n) {
        const game = this.game;
            if (n >= 26) return 4;
            if (n >= 16) return 3;
            if (n >= 11) return 2;
            if (n >= 6) return 1;
            return 0;
    }

    bumpComboHud(n) {
        const game = this.game;
            if (!game.dom.comboHudEl || !game.dom.comboValueEl) return;
            if (n < 2) {
                game.dom.comboHudEl.classList.remove('visible', 'combo-pop');
                game.comboHideTimer = 0;
                return;
            }
            game.dom.comboValueEl.textContent = String(n);
            game.dom.comboHudEl.dataset.tier = String(game.comboTierForCount(n));
            game.dom.comboHudEl.classList.add('visible');
            game.dom.comboHudEl.classList.remove('combo-pop');
            void game.dom.comboHudEl.offsetWidth;
            game.dom.comboHudEl.classList.add('combo-pop');
            game.comboHideTimer = 1.5;
    }

    updateComboHud() {
        const game = this.game;
            if (!game.dom.comboHudEl || game.comboHideTimer <= 0) return;
            if (game.chainPopQueue.length > 0) {
                game.comboHideTimer = 1.5;
                return;
            }
            game.comboHideTimer -= Config.dt;
            if (game.comboHideTimer <= 0) {
                game.dom.comboHudEl.classList.remove('visible', 'combo-pop');
            }
    }

    hideComboHud() {
        const game = this.game;
            game.comboHideTimer = 0;
            game.chainComboCount = 0;
            if (game.dom.comboHudEl) game.dom.comboHudEl.classList.remove('visible', 'combo-pop');
    }

    playOutcomeSoundOnce(outcome) {
        const game = this.game;
            if (game.outcomeSoundPlayed === outcome) return;
            game.outcomeSoundPlayed = outcome;
            if (outcome === 'won') game.sfx.playWin();
            else if (outcome === 'lost') game.sfx.playLose();
    }

    resetOutcomeSound() {
        const game = this.game;
            game.outcomeSoundPlayed = null;
    }

    updateBallCount() {
        const game = this.game;
            game.dom.ballCountEl.textContent = String(game.balls.length);
    }

    updateLevelHud() {
        const game = this.game;
            if (!game.dom.levelHudEl) return;
            const level = game.currentLevelSpec || game.getLevelSpec(game.levelIndex);
            if (game.testLevelId || level?.testLevel) {
                game.dom.levelHudEl.textContent = `${level?.title ?? '测试关'} [测试]`;
                return;
            }
            if (level?.testLab) {
                game.dom.levelHudEl.innerHTML =
                    `<span class="level-num">测试</span> · ${level.title || '测试关卡'}`;
                return;
            }
            const title = level?.title ? ` · ${level.title}` : '';
            game.dom.levelHudEl.innerHTML =
                `第 <span class="level-num">${game.levelIndex + 1}</span> 关${title}`;
    }

    settlementHintForLevel(levelIdx, isWin) {
        const game = this.game;
            if (!isWin) return '';
            if (game.testLevelId) return '撑爆气球会触发飞镖横穿屏幕';
            if (levelIdx === 0) return '注意底下的气体消耗';
            if (levelIdx === 1) return '大的泡泡更容易撑爆';
            if (levelIdx === 2) return '先撑爆哪个颜色的泡泡很重要';
            return '';
    }

}
