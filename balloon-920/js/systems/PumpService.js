import * as Config from '../config.js';
import { TEAM_PALETTE } from '../level/levelData.js';
import { isClownBall } from '../items/clownBalloon.js';
import { isRainbowBall } from '../items/rainbowBalloon.js';

/** PumpService */
export class PumpService {
    constructor(game) {
        this.game = game;
    }

    paletteTeam(teamIndex) {
        const game = this.game;
            const ctx = game.dom.ctx;
            return TEAM_PALETTE[teamIndex] || TEAM_PALETTE[0];
    }

    pickTeamColor(teamIndex = -1) {
        const game = this.game;
            const ctx = game.dom.ctx;
            if (teamIndex >= 0) return game.paletteTeam(teamIndex);
            const pick = game.activeTeams[Math.floor(Math.random() * game.activeTeams.length)] ?? 0;
            return game.paletteTeam(pick);
    }

    paletteIndexForColor(colorBase) {
        const game = this.game;
            const ctx = game.dom.ctx;
            for (let i = 0; i < TEAM_PALETTE.length; i++) {
                if (TEAM_PALETTE[i].colorBase === colorBase) return i;
            }
            return -1;
    }

    pumpSlotForPaletteTeam(paletteIdx) {
        const game = this.game;
            const ctx = game.dom.ctx;
            for (let i = 0; i < game.activeTeams.length; i++) {
                if (game.activeTeams[i] === paletteIdx) return i;
            }
            return -1;
    }

    pumpSlotForBall(ball) {
        const game = this.game;
            if (isRainbowBall(ball)) return -1;
            if (isClownBall(ball)) {
                return game.pumpSlotForPaletteTeam(game.activeTeams[0] ?? 0);
            }
            return game.pumpSlotForPaletteTeam(game.paletteIndexForColor(ball.colorBase));
    }

    floorLimitY() {
        const game = this.game;
            const ctx = game.dom.ctx;
            return Config.GROUND_Y - 5;
    }

    isInPumpZone(y) {
        const game = this.game;
            const ctx = game.dom.ctx;
            return y >= Config.GROUND_Y;
    }

    pumpFuelForBall(ball) {
        const game = this.game;
            const ctx = game.dom.ctx;
            const slot = game.pumpSlotForBall(ball);
            if (slot < 0) return 0;
            return game.pumpFuelRemaining[slot];
    }

    canPumpBall(ball) {
        const game = this.game;
            const ctx = game.dom.ctx;
            return game.pumpFuelForBall(ball) > 0;
    }

    selectPumpForBall(ball) {
        const game = this.game;
            const ctx = game.dom.ctx;
            const slot = game.pumpSlotForBall(ball);
            if (slot >= 0) game.selectedPumpIndex = slot;
            return slot;
    }

    layoutPumpHitRects() {
        const game = this.game;
            const ctx = game.dom.ctx;
            game.pumpHitRects.length = 0;
            const n = game.activeTeams.length;
            if (n === 0) return;
            const dockTop = Config.GROUND_Y + 6;
            const dockInnerH = Config.PUMP_ZONE_HEIGHT - 12;
            const cols = n <= 3 ? n : (n === 4 ? 4 : 3);
            const rows = Math.ceil(n / cols);
            const gap = n >= 6 ? 8 : (n >= 4 ? 10 : 16);
            const maxRowW = Config.width - 20;
            const iconW = Math.min(72, Math.floor((maxRowW - gap * (cols - 1)) / cols));
            const iconH = rows > 1
                ? Math.min(44, Math.floor((dockInnerH - gap * (rows - 1)) / rows))
                : Math.min(78, dockInnerH - 4);
            let slot = 0;
            for (let r = 0; r < rows; r++) {
                const countInRow = Math.min(cols, n - r * cols);
                const rowW = countInRow * iconW + (countInRow - 1) * gap;
                const startX = (Config.width - rowW) * 0.5;
                const y = dockTop + r * (iconH + gap);
                for (let c = 0; c < countInRow; c++) {
                    game.pumpHitRects.push({
                        index: slot,
                        x: startX + c * (iconW + gap),
                        y,
                        w: iconW,
                        h: iconH
                    });
                    slot++;
                }
            }
    }

    pickPumpAt(x, y) {
        const game = this.game;
            const ctx = game.dom.ctx;
            for (let i = 0; i < game.pumpHitRects.length; i++) {
                const r = game.pumpHitRects[i];
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
            }
            return -1;
    }

    strokeRoundRect(x, y, w, h, r) {
        const game = this.game;
            const ctx = game.dom.ctx;
            const rr = Math.min(r, w * 0.5, h * 0.5);
            ctx.beginPath();
            ctx.moveTo(x + rr, y);
            ctx.lineTo(x + w - rr, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
            ctx.lineTo(x + w, y + h - rr);
            ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
            ctx.lineTo(x + rr, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
            ctx.lineTo(x, y + rr);
            ctx.quadraticCurveTo(x, y, x + rr, y);
            ctx.closePath();
    }

    ensurePumpFuelLabelState() {
        const game = this.game;
        const n = game.pumpFuelRemaining.length;
        if (game.pumpFuelLabelScale.length === n) return;
        game.resetPumpFuelLabelAnims();
    }

    resetPumpFuelLabelAnims() {
        const game = this.game;
        const fuels = game.pumpFuelRemaining;
        game.pumpFuelLabelScale = fuels.map(() => 1);
    }

    bumpPumpFuelLabelOnFuelUse(pumpIdx, fuelBefore) {
        const game = this.game;
        game.ensurePumpFuelLabelState();
        const after = game.pumpFuelRemaining[pumpIdx] ?? 0;
        const used = fuelBefore - after;
        if (used <= 0 || pumpIdx < 0) return;

        let scale = game.pumpFuelLabelScale[pumpIdx] ?? 1;
        scale = Math.max(0.5, scale - 0.035 - Math.min(used, 4) * 0.022);
        const ceilBefore = Math.ceil(fuelBefore);
        const ceilAfter = Math.ceil(after);
        if (ceilAfter < ceilBefore) {
            scale = Math.min(scale, 0.62);
        }
        game.pumpFuelLabelScale[pumpIdx] = scale;
    }

    updatePumpFuelLabelAnims() {
        const game = this.game;
        const scales = game.pumpFuelLabelScale;
        if (!scales.length) return;
        const k = Math.min(1, 11 * Config.dt);
        for (let i = 0; i < scales.length; i++) {
            scales[i] += (1 - scales[i]) * k;
        }
    }

    drawPumpIcon(x, y, w, h, tool, index, selected, fuelRemaining) {
        const game = this.game;
            const ctx = game.dom.ctx;
            const empty = fuelRemaining <= 0;
            const cx = x + w * 0.4;
            const baseY = y + h - 9;
            const barrelW = w * 0.3;
            const barrelH = h * 0.46;
            const barrelTop = baseY - barrelH - 3;
            const metal = '#8b93a8';
            const metalDark = '#4d5568';

            ctx.save();
            if (empty) ctx.globalAlpha = 0.42;
            if (selected && !empty) {
                ctx.shadowColor = tool.colorLight;
                ctx.shadowBlur = 10;
            }

            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            game.strokeRoundRect(x + 2, y + 3, w - 4, h - 6, 10);
            ctx.fill();

            ctx.fillStyle = 'rgba(35, 38, 52, 0.95)';
            ctx.beginPath();
            ctx.ellipse(cx, baseY, barrelW * 0.72, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = metalDark;
            ctx.lineWidth = 1;
            ctx.stroke();

            const barrelGrad = ctx.createLinearGradient(cx - barrelW * 0.5, barrelTop, cx + barrelW * 0.5, barrelTop);
            barrelGrad.addColorStop(0, tool.colorBase);
            barrelGrad.addColorStop(0.45, tool.colorLight);
            barrelGrad.addColorStop(1, tool.colorBase);
            ctx.fillStyle = barrelGrad;
            game.strokeRoundRect(cx - barrelW * 0.5, barrelTop, barrelW, barrelH, barrelW * 0.35);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            game.strokeRoundRect(cx - barrelW * 0.34, barrelTop + 4, barrelW * 0.1, barrelH - 10, 2);
            ctx.fill();

            const stemW = barrelW * 0.34;
            const stemH = 7;
            const handleY = barrelTop - stemH;
            ctx.fillStyle = metalDark;
            game.strokeRoundRect(cx - stemW * 0.5, handleY, stemW, stemH, 3);
            ctx.fill();
            ctx.fillStyle = metal;
            game.strokeRoundRect(cx - barrelW * 0.95, handleY - 5, barrelW * 1.9, 5, 2.5);
            ctx.fill();

            const hoseX0 = cx + barrelW * 0.42;
            const hoseY0 = barrelTop + barrelH * 0.58;
            const nozzleX = x + w - 10;
            const nozzleY = baseY - 14;
            ctx.strokeStyle = tool.colorBase;
            ctx.lineWidth = 4.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(hoseX0, hoseY0);
            ctx.bezierCurveTo(cx + w * 0.35, hoseY0 - 2, x + w * 0.55, nozzleY + 6, nozzleX - 4, nozzleY);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(hoseX0, hoseY0 - 1);
            ctx.bezierCurveTo(cx + w * 0.35, hoseY0 - 3, x + w * 0.55, nozzleY + 4, nozzleX - 4, nozzleY - 1);
            ctx.stroke();

            ctx.fillStyle = metal;
            ctx.beginPath();
            ctx.arc(nozzleX, nozzleY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = metalDark;
            ctx.beginPath();
            ctx.arc(nozzleX + 1.5, nozzleY, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = selected ? 2.5 : 1.5;
            game.strokeRoundRect(x + 2, y + 3, w - 4, h - 6, 10);
            ctx.stroke();

            ctx.shadowBlur = 0;
            game.ensurePumpFuelLabelState();
            const num = empty ? '0' : String(Math.max(0, Math.ceil(fuelRemaining)));
            const labelY = barrelTop + barrelH * 0.52;
            const shrink = game.pumpFuelLabelScale[index] ?? 1;
            const fontSize = Math.max(14, Math.min(20, barrelW * 0.95)) * shrink;
            ctx.font = `bold ${fontSize}px "ZCOOL KuaiLe", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillStyle = empty ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.98)';
            ctx.strokeText(num, cx, labelY);
            ctx.fillText(num, cx, labelY);
            ctx.restore();
    }

    drawPumpDock() {
        const game = this.game;
            const ctx = game.dom.ctx;
            const dockGrad = ctx.createLinearGradient(0, Config.GROUND_Y, 0, Config.height);
            dockGrad.addColorStop(0, 'rgba(18, 18, 32, 0.92)');
            dockGrad.addColorStop(1, 'rgba(8, 8, 16, 0.98)');
            ctx.fillStyle = dockGrad;
            ctx.fillRect(0, Config.GROUND_Y, Config.width, Config.PUMP_ZONE_HEIGHT);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, Config.GROUND_Y + 0.5);
            ctx.lineTo(Config.width, Config.GROUND_Y + 0.5);
            ctx.stroke();

            game.layoutPumpHitRects();
            for (let i = 0; i < game.activeTeams.length; i++) {
                const r = game.pumpHitRects[i];
                if (!r) continue;
                const tool = game.paletteTeam(game.activeTeams[i]);
                game.drawPumpIcon(
                    r.x, r.y, r.w, r.h, tool, i,
                    game.selectedPumpIndex === i, game.pumpFuelRemaining[i] ?? 0
                );
            }
    }

    updateInflation() {
        const game = this.game;
            const ctx = game.dom.ctx;
            game.inflatePumpActive = false;
            if (game.gameOutcome !== 'playing' || !game.pointerDown || !game.activeInflateBall) return;
            if (!game.balls.includes(game.activeInflateBall)) {
                game.activeInflateBall = null;
                return;
            }

            const ball = game.activeInflateBall;
            const pumpIdx = game.pumpSlotForBall(ball);
            if (pumpIdx < 0 || game.pumpFuelRemaining[pumpIdx] <= 0) {
                game.sfx.playDenied();
                game.activeInflateBall = null;
                return;
            }

            const airBefore = ball.air;
            const fill = game.airToFillRatio(ball.air);
            const ease = Math.pow(Math.max(0, 1 - fill), 3.2);
            const speedFactor = Math.max(0.15, ease);
            const want = Config.PUMP_AIR_RATE * speedFactor * Config.dt;
            const used = Math.min(want, ball.air, game.pumpFuelRemaining[pumpIdx]);
            if (used <= 0) {
                game.sfx.playDenied();
                game.activeInflateBall = null;
                return;
            }

            const fuelBeforePump = game.pumpFuelRemaining[pumpIdx];
            ball.air -= used;
            game.pumpFuelRemaining[pumpIdx] -= used;
            if (game.pumpFuelRemaining[pumpIdx] < 1e-6) game.pumpFuelRemaining[pumpIdx] = 0;
            game.bumpPumpFuelLabelOnFuelUse(pumpIdx, fuelBeforePump);

            game.inflatePumpActive = true;
            game.checkLevelLose();

            game.applyBallAirVisual(ball);
            game.bumpBallLabelOnAirTick(ball, airBefore);
            const airDelta = airBefore - ball.air;
            if (airDelta >= Config.SHAKE_MIN_AIR_DELTA) {
                game.applyInflationShake(ball);
            }
            game.schedulePopIfEmpty(ball);
    }

}
