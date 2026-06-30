/** 音效子系统：BGM、打气、爆破、胜负音效 */
export function createSfxSystem(getSimTime) {
/** 三消式连击音阶：每多一爆明确升一档，跨两个八度 */
const COMBO_MELODY = [
    392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5,
    1174.66, 1318.51, 1567.98, 1760, 1975.53, 2093, 2349.32, 2637.02
];

let ctx = null;
let master = null;
let popBus = null;
let pumpBed = null;
let pumpIntensity = 0;
let pumpStrokePhase = 0;
let lastChuffPhaseInt = 0;
let lastDeniedAt = 0;
let noiseLoopBuffer = null;
let bgmBus = null;
let bgmStarted = false;
let bgmGraphReady = false;
let bgmEl = null;
let bgmMediaSource = null;
let bgmAutoplayAttempts = 0;

const BGM_SRC = 'assets/bgm.mp3';
const BGM_LEVEL = 0.26;

function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    popBus = ctx.createGain();
    popBus.gain.value = 1.15;
    popBus.connect(master);

    const bufferSize = 2 * ctx.sampleRate;
    noiseLoopBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseLoopBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.012 * white) / 1.012;
        data[i] = white * 0.55 + last * 0.45;
    }

    const bedNoise = ctx.createBufferSource();
    bedNoise.buffer = noiseLoopBuffer;
    bedNoise.loop = true;
    const bedHigh = ctx.createBiquadFilter();
    bedHigh.type = 'highpass';
    bedHigh.frequency.value = 280;
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'bandpass';
    bedFilter.frequency.value = 1150;
    bedFilter.Q.value = 0.95;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    const bedTone = ctx.createOscillator();
    bedTone.type = 'sine';
    bedTone.frequency.value = 210;
    const bedToneGain = ctx.createGain();
    bedToneGain.gain.value = 0;
    const bedBus = ctx.createGain();
    bedBus.gain.value = 1;

    bedNoise.connect(bedHigh);
    bedHigh.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(bedBus);
    bedTone.connect(bedToneGain);
    bedToneGain.connect(bedBus);
    bedBus.connect(master);

    bedNoise.start();
    bedTone.start();
    pumpBed = { bedGain, bedFilter, bedTone, bedToneGain, bedBus };
}

function resume() {
    init();
    if (!ctx) return;
    const begin = () => {
        startBgm();
        if (!bgmStarted) requestAnimationFrame(() => startBgm());
    };
    if (ctx.state === 'suspended') {
        ctx.resume().then(begin).catch(begin);
    } else {
        begin();
    }
}

function ensureBgmElement() {
    if (bgmEl) return;
    bgmEl = new Audio(BGM_SRC);
    bgmEl.loop = true;
    bgmEl.preload = 'auto';
    bgmEl.crossOrigin = 'anonymous';
    bgmEl.playsInline = true;
    bgmEl.setAttribute('playsinline', '');
    bgmEl.volume = 1;
}

function setupBgmGraph() {
    if (!ctx || bgmGraphReady) return;
    ensureBgmElement();
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0;
    bgmBus.connect(master);
    bgmMediaSource = ctx.createMediaElementSource(bgmEl);
    bgmMediaSource.connect(bgmBus);
    bgmGraphReady = true;
}

function runBgmPlayback() {
    if (!ctx) return;
    setupBgmGraph();
    const t = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(t);
    bgmBus.gain.setValueAtTime(bgmBus.gain.value, t);
    bgmBus.gain.linearRampToValueAtTime(BGM_LEVEL, t + 1.2);
    const playPromise = bgmEl.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
            bgmStarted = true;
        }).catch(() => {});
    } else {
        bgmStarted = true;
    }
}

function startBgm() {
    init();
    if (!ctx) return;
    ensureBgmElement();

    const kick = () => runBgmPlayback();
    if (ctx.state === 'suspended') {
        ctx.resume().then(kick).catch(kick);
    } else {
        kick();
    }
}

function autoplayBgm() {
    init();
    ensureBgmElement();
    startBgm();
    if (bgmAutoplayAttempts >= 24) return;
    bgmAutoplayAttempts++;
    if (!bgmStarted || (bgmEl && bgmEl.paused)) {
        requestAnimationFrame(autoplayBgm);
    }
}

function makeNoiseBurst(durationSec, shaping) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = shaping ? shaping(t) : Math.pow(1 - t, 1.4);
        d[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
}

function playPumpChuff(inflate, intensity) {
    if (!ctx || !popBus) return;
    const t = ctx.currentTime;
    const power = 0.65 + intensity * 0.55 + inflate * 0.35;

    const whoosh = ctx.createBufferSource();
    whoosh.buffer = makeNoiseBurst(0.09, (u) => Math.sin(Math.PI * u) * (1 - u * 0.35));
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.setValueAtTime(720 + inflate * 380, t);
    wf.frequency.linearRampToValueAtTime(2200 + inflate * 500, t + 0.07);
    wf.Q.value = 1.05;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.001, t);
    wg.gain.linearRampToValueAtTime(power * 0.82, t + 0.006);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    whoosh.connect(wf);
    wf.connect(wg);
    wg.connect(master);
    whoosh.start(t);
    whoosh.stop(t + 0.1);

    const puff = ctx.createOscillator();
    puff.type = 'sine';
    puff.frequency.setValueAtTime(260 + inflate * 80, t);
    puff.frequency.exponentialRampToValueAtTime(420 + inflate * 120, t + 0.045);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(power * 0.28, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    puff.connect(pg);
    pg.connect(master);
    puff.start(t);
    puff.stop(t + 0.065);

    const click = ctx.createOscillator();
    click.type = 'sine';
    click.frequency.setValueAtTime(520, t);
    click.frequency.exponentialRampToValueAtTime(320, t + 0.035);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(power * 0.22, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    click.connect(cg);
    cg.connect(master);
    click.start(t);
    click.stop(t + 0.045);
}

function updatePump(inflate, dt, isPumping) {
    resume();
    if (!pumpBed || !ctx) return;
    if (isPumping) pumpIntensity = Math.min(1, pumpIntensity + dt * 2.2);
    else pumpIntensity = Math.max(0, pumpIntensity - dt * 4.5);

    const t = ctx.currentTime;
    const pressure = pumpIntensity * (0.45 + inflate * 0.55);
    const wobble = 0.72 + 0.28 * Math.sin(getSimTime() * 9.5);

    pumpBed.bedGain.gain.setTargetAtTime(pressure * 0.58 * wobble, t, 0.025);
    pumpBed.bedFilter.frequency.setTargetAtTime(980 + inflate * 750 + wobble * 90, t, 0.04);
    pumpBed.bedToneGain.gain.setTargetAtTime(pressure * 0.1, t, 0.03);
    pumpBed.bedTone.frequency.setTargetAtTime(190 + inflate * 70 + wobble * 8, t, 0.04);
    pumpBed.bedBus.gain.setTargetAtTime(pumpIntensity > 0.02 ? 1 : 0, t, 0.05);

    if (isPumping && pumpIntensity > 0.08) {
        const strokeHz = 4.8 + inflate * 3.2;
        pumpStrokePhase += dt * strokeHz;
        const phaseInt = Math.floor(pumpStrokePhase);
        if (phaseInt > lastChuffPhaseInt) {
            const steps = Math.min(3, phaseInt - lastChuffPhaseInt);
            for (let i = 0; i < steps; i++) playPumpChuff(inflate, pumpIntensity);
            lastChuffPhaseInt = phaseInt;
        }
    } else {
        pumpStrokePhase = 0;
        lastChuffPhaseInt = 0;
    }
}

/** 气球爆破：膜裂瞬态 + 空腔闷响 + 放气 flutter（非打击/噪声爆裂路线） */
function playPopImpact(t, scale, firstPop) {
    const s = scale * (firstPop ? 1.45 : 1);

    const lip = ctx.createOscillator();
    lip.type = 'sine';
    lip.frequency.setValueAtTime((firstPop ? 920 : 760) * Math.min(1.1, scale + 0.15), t);
    lip.frequency.exponentialRampToValueAtTime(380, t + 0.022);
    const lipG = ctx.createGain();
    lipG.gain.setValueAtTime((firstPop ? 0.95 : 0.62) * s, t);
    lipG.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
    lip.connect(lipG);
    lipG.connect(popBus);
    lip.start(t);
    lip.stop(t + 0.03);

    const tear = ctx.createBufferSource();
    tear.buffer = makeNoiseBurst(firstPop ? 0.07 : 0.055, (u) => Math.pow(1 - u, 0.55));
    const tearF = ctx.createBiquadFilter();
    tearF.type = 'bandpass';
    tearF.Q.value = 2.2;
    tearF.frequency.setValueAtTime(5200, t);
    tearF.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    const tearG = ctx.createGain();
    tearG.gain.setValueAtTime((firstPop ? 1.35 : 0.88) * s, t);
    tearG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    tear.connect(tearF);
    tearF.connect(tearG);
    tearG.connect(popBus);
    tear.start(t);
    tear.stop(t + 0.065);

    const cavity = ctx.createOscillator();
    cavity.type = 'triangle';
    cavity.frequency.setValueAtTime(firstPop ? 268 : 220, t);
    cavity.frequency.exponentialRampToValueAtTime(108, t + 0.1);
    const cavG = ctx.createGain();
    cavG.gain.setValueAtTime((firstPop ? 1.05 : 0.58) * s, t);
    cavG.gain.exponentialRampToValueAtTime(0.001, t + (firstPop ? 0.13 : 0.09));
    const cavF = ctx.createBiquadFilter();
    cavF.type = 'lowpass';
    cavF.frequency.value = 520;
    cavity.connect(cavF);
    cavF.connect(cavG);
    cavG.connect(popBus);
    cavity.start(t);
    cavity.stop(t + 0.14);

    const flutterDur = firstPop ? 0.11 : 0.07;
    const flutter = ctx.createBufferSource();
    flutter.buffer = makeNoiseBurst(flutterDur, (u) => {
        const wobble = 0.55 + 0.45 * Math.sin(u * Math.PI * 7);
        return (1 - u) * wobble;
    });
    const fltF = ctx.createBiquadFilter();
    fltF.type = 'bandpass';
    fltF.frequency.setValueAtTime(1400, t);
    fltF.frequency.linearRampToValueAtTime(680, t + flutterDur);
    fltF.Q.value = 0.9;
    const fltG = ctx.createGain();
    fltG.gain.setValueAtTime((firstPop ? 0.72 : 0.42) * s, t);
    fltG.gain.exponentialRampToValueAtTime(0.001, t + flutterDur);
    flutter.connect(fltF);
    fltF.connect(fltG);
    fltG.connect(popBus);
    flutter.start(t);
    flutter.stop(t + flutterDur + 0.01);

    if (firstPop) {
        const ring = ctx.createOscillator();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(156, t);
        ring.frequency.exponentialRampToValueAtTime(92, t + 0.16);
        const ringG = ctx.createGain();
        ringG.gain.setValueAtTime(0.55 * s, t);
        ringG.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        ring.connect(ringG);
        ringG.connect(popBus);
        ring.start(t);
        ring.stop(t + 0.19);
    }
}

function playComboPlink(t, freq, step) {
    const vel = 0.58 + Math.min(step, 12) * 0.055;
    const dur = 0.11 + Math.min(step, 8) * 0.006;

    const lead = ctx.createOscillator();
    lead.type = 'triangle';
    lead.frequency.setValueAtTime(freq, t);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0.001, t);
    lg.gain.linearRampToValueAtTime(vel, t + 0.004);
    lg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    lead.connect(lg);
    lg.connect(popBus);
    lead.start(t);
    lead.stop(t + dur + 0.02);

    const harm = ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(freq * 2, t);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.001, t);
    hg.gain.linearRampToValueAtTime(vel * 0.38, t + 0.003);
    hg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
    harm.connect(hg);
    hg.connect(popBus);
    harm.start(t);
    harm.stop(t + dur + 0.02);

    if (step >= 3) {
        const sparkle = ctx.createOscillator();
        sparkle.type = 'sine';
        sparkle.frequency.setValueAtTime(freq * 3, t);
        const spg = ctx.createGain();
        spg.gain.setValueAtTime(0.001, t);
        spg.gain.linearRampToValueAtTime(vel * 0.22, t + 0.002);
        spg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        sparkle.connect(spg);
        spg.connect(popBus);
        sparkle.start(t);
        sparkle.stop(t + 0.08);
    }
}

function playPop(comboIndex) {
    resume();
    if (!ctx || !popBus) return;
    const step = Math.max(0, comboIndex - 1);
    const melodyIdx = Math.min(step, COMBO_MELODY.length - 1);
    const freq = COMBO_MELODY[melodyIdx];
    const t = ctx.currentTime;

    if (comboIndex === 1) {
        popBus.gain.cancelScheduledValues(t);
        popBus.gain.setValueAtTime(1.55, t);
        popBus.gain.setTargetAtTime(1.15, t + 0.12, 0.06);
        playPopImpact(t, 1, true);
        playComboPlink(t, COMBO_MELODY[0], 0);
    } else {
        const tail = Math.max(0.38, 0.72 - step * 0.03);
        playPopImpact(t, tail, false);
        playComboPlink(t, freq, step);
    }
}

function playDenied() {
    resume();
    if (!ctx || !master) return;
    const now = performance.now();
    if (now - lastDeniedAt < 280) return;
    lastDeniedAt = now;
    const t = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.25);

    const buf = ctx.createBufferSource();
    buf.buffer = makeNoiseBurst(0.08, (u) => 1 - u);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    buf.connect(ng);
    ng.connect(master);
    buf.start(t);
    buf.stop(t + 0.09);
}

function playWin() {
    resume();
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        const at = t + i * 0.085;
        g.gain.setValueAtTime(0.001, at);
        g.gain.linearRampToValueAtTime(0.42, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
        o.connect(g);
        g.connect(popBus);
        o.start(at);
        o.stop(at + 0.52);
    });
}

function playLose() {
    resume();
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.7);
}

    return { resume, autoplayBgm, updatePump, playPop, playDenied, playWin, playLose };
}
