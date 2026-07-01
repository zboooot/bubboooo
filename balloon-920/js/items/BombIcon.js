/**
 * 炸弹图标绘制（揭晓 UI 与场上掉落共用）
 * 经典卡通炸弹：立体球体 + 金属箍 + 弯引线 + 火花
 */

function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

function cubicBezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
}

/**
 * @param {CanvasRenderingContext2D} ctx 已 translate 到图标中心
 * @param {object} opts
 * @param {number} opts.size 基准尺寸（约等于外廓半径）
 * @param {string} [opts.accent='#f97316']
 * @param {number} [opts.alpha=1]
 * @param {number} [opts.fuseLength=1] 引线长度比例 0~1
 */
export function drawBombIcon(ctx, { size, accent = '#f97316', alpha = 1, fuseLength = 1 }) {
    const bodyR = size * 0.76;
    const bodyCy = size * 0.1;
    const fuseT = Math.max(0, Math.min(1, fuseLength));

    ctx.save();

    ctx.shadowColor = hexToRgba(accent, 0.62 * alpha);
    ctx.shadowBlur = size * 0.42;

    const bodyGrad = ctx.createRadialGradient(
        -bodyR * 0.32, bodyCy - bodyR * 0.38, bodyR * 0.08,
        0, bodyCy, bodyR
    );
    bodyGrad.addColorStop(0, `rgba(100, 116, 139, ${alpha})`);
    bodyGrad.addColorStop(0.42, `rgba(30, 41, 59, ${alpha})`);
    bodyGrad.addColorStop(1, `rgba(15, 23, 42, ${alpha})`);

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = hexToRgba(accent, 0.92 * alpha);
    ctx.lineWidth = Math.max(1.5, size * 0.065);
    ctx.beginPath();
    ctx.arc(0, bodyCy, bodyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    const shine = ctx.createRadialGradient(
        -bodyR * 0.42, bodyCy - bodyR * 0.48, 0,
        -bodyR * 0.42, bodyCy - bodyR * 0.48, bodyR * 0.62
    );
    shine.addColorStop(0, `rgba(255, 255, 255, ${0.42 * alpha})`);
    shine.addColorStop(0.55, `rgba(255, 255, 255, ${0.08 * alpha})`);
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(-bodyR * 0.18, bodyCy - bodyR * 0.22, bodyR * 0.34, bodyR * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fill();

    const bandY = bodyCy + bodyR * 0.02;
    const bandH = bodyR * 0.24;
    ctx.fillStyle = hexToRgba(accent, 0.88 * alpha);
    ctx.beginPath();
    ctx.ellipse(0, bandY, bodyR * 0.92, bandH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 * alpha})`;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.ellipse(0, bandY - bandH * 0.12, bodyR * 0.88, bandH * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.78 * alpha})`;
    ctx.lineWidth = Math.max(1.8, size * 0.075);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bodyR * 0.08, bodyCy - bodyR * 0.62);
    ctx.lineTo(-bodyR * 0.06, bodyCy - bodyR * 0.38);
    ctx.lineTo(bodyR * 0.1, bodyCy - bodyR * 0.14);
    ctx.stroke();

    const fuseBaseX = bodyR * 0.38;
    const fuseBaseY = bodyCy - bodyR * 0.74;
    const fuseP0 = { x: fuseBaseX, y: fuseBaseY };
    const fuseP1 = { x: fuseBaseX + bodyR * 0.28, y: fuseBaseY - bodyR * 0.14 };
    const fuseP2 = { x: fuseBaseX + bodyR * 0.1, y: fuseBaseY - bodyR * 0.38 };
    const fuseP3 = { x: fuseBaseX + bodyR * 0.34, y: fuseBaseY - bodyR * 0.48 };

    if (fuseT > 0.02) {
        ctx.strokeStyle = `rgba(168, 162, 158, ${alpha})`;
        ctx.lineWidth = Math.max(1.6, size * 0.058);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fuseP0.x, fuseP0.y);

        const segments = 14;
        const steps = Math.max(2, Math.ceil(segments * fuseT));
        for (let i = 1; i <= steps; i++) {
            const t = Math.min(fuseT, i / segments);
            const p = cubicBezierPoint(t, fuseP0, fuseP1, fuseP2, fuseP3);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        const tip = cubicBezierPoint(fuseT, fuseP0, fuseP1, fuseP2, fuseP3);
        const sparkScale = 0.55 + fuseT * 0.45;
        _drawSpark(ctx, tip.x, tip.y, size * 0.18 * sparkScale, accent, alpha);
    }

    ctx.restore();
}

function _drawSpark(ctx, x, y, r, accent, alpha) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    glow.addColorStop(0, `rgba(255, 251, 235, ${0.95 * alpha})`);
    glow.addColorStop(0.35, hexToRgba('#fbbf24', 0.85 * alpha));
    glow.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 251, 235, ${0.98 * alpha})`;
    ctx.strokeStyle = hexToRgba('#fbbf24', 0.95 * alpha);
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const outer = i % 2 === 0 ? r * 1.15 : r * 0.48;
        const px = x + Math.cos(a) * outer;
        const py = y + Math.sin(a) * outer;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hexToRgba(accent, 0.9 * alpha);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * 炸点爆破图标：漫画式星芒爆炸（配合循环缩放）
 * @param {CanvasRenderingContext2D} ctx 已 translate 到炸点中心
 */
export function drawExplosionBurstIcon(ctx, { size, accent = '#f97316', alpha = 1, rotation = 0 }) {
    ctx.save();
    ctx.rotate(rotation);

    const glowR = size * 1.35;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, `rgba(255, 251, 235, ${0.72 * alpha})`);
    glow.addColorStop(0.28, hexToRgba('#fbbf24', 0.55 * alpha));
    glow.addColorStop(0.62, hexToRgba(accent, 0.22 * alpha));
    glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = hexToRgba(accent, 0.65 * alpha);
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = hexToRgba(accent, 0.92 * alpha);
    ctx.strokeStyle = `rgba(255, 251, 235, ${0.88 * alpha})`;
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const outer = i % 2 === 0 ? size * 1.05 : size * 0.46;
        const px = Math.cos(a) * outer;
        const py = Math.sin(a) * outer;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const outer = i % 2 === 0 ? size * 0.62 : size * 0.28;
        const px = Math.cos(a) * outer;
        const py = Math.sin(a) * outer;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255, 251, 235, ${0.95 * alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}