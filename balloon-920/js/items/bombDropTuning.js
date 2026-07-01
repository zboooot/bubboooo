import * as Config from '../config.js';

export const BOMB_DROP_JSON_PATH = 'data/bombDropTuning.json';

/** @typedef {typeof BOMB_DROP_TUNING_DEFAULTS} BombDropTuning */

export const BOMB_DROP_TUNING_DEFAULTS = {
    arcHeight: Config.BOMB_DROP_ARC_HEIGHT,
    arcSway: Config.BOMB_DROP_ARC_SWAY,
    dropSpeed: Config.BOMB_DROP_SPEED,
    minDurationSec: Config.BOMB_DROP_MIN_DURATION_SEC,
    maxDurationSec: Config.BOMB_DROP_MAX_DURATION_SEC,
    easePower: Config.BOMB_DROP_EASE_POWER,
    tiltFactor: Config.BOMB_DROP_TILT_FACTOR,
    landHoldSec: Config.BOMB_LAND_HOLD_SEC,
};

const TUNING_KEYS = Object.keys(BOMB_DROP_TUNING_DEFAULTS);

/** @type {BombDropTuning} */
let _tuning = { ...BOMB_DROP_TUNING_DEFAULTS };

export function getBombDropTuning() {
    return _tuning;
}

/**
 * @param {Partial<BombDropTuning>} partial
 */
export function setBombDropTuning(partial) {
    const next = { ..._tuning };
    for (const key of TUNING_KEYS) {
        if (partial[key] != null && Number.isFinite(Number(partial[key]))) {
            next[key] = Number(partial[key]);
        }
    }
    _tuning = next;
    _clampTuning();
}

export function resetBombDropTuning() {
    _tuning = { ...BOMB_DROP_TUNING_DEFAULTS };
}

/**
 * @param {unknown} raw
 * @returns {BombDropTuning}
 */
export function normalizeBombDropTuning(raw) {
    const base = { ...BOMB_DROP_TUNING_DEFAULTS };
    if (!raw || typeof raw !== 'object') return base;

    for (const key of TUNING_KEYS) {
        const val = raw[key];
        if (val != null && Number.isFinite(Number(val))) {
            base[key] = Number(val);
        }
    }
    return base;
}

/**
 * @param {unknown} raw
 */
export function applyBombDropTuning(raw) {
    _tuning = normalizeBombDropTuning(raw);
    _clampTuning();
}

/**
 * @param {string} [url]
 * @returns {Promise<BombDropTuning>}
 */
export async function loadBombDropTuningFromJson(url = BOMB_DROP_JSON_PATH) {
    try {
        const res = await fetch(`${url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        applyBombDropTuning(data);
        return getBombDropTuning();
    } catch (err) {
        console.warn('[bombDropTuning] JSON 加载失败，使用内置默认', err);
        resetBombDropTuning();
        return getBombDropTuning();
    }
}

export function getBombDropTuningJsonString() {
    const payload = {};
    for (const key of TUNING_KEYS) {
        payload[key] = _tuning[key];
    }
    return `${JSON.stringify(payload, null, 2)}\n`;
}

export function downloadBombDropTuningJson(filename = 'bombDropTuning.json') {
    const blob = new Blob([getBombDropTuningJsonString()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function _clampTuning() {
    _tuning.arcHeight = clamp(_tuning.arcHeight, 0, 180);
    _tuning.arcSway = clamp(_tuning.arcSway, -0.8, 0.8);
    _tuning.dropSpeed = clamp(_tuning.dropSpeed, 200, 1200);
    _tuning.minDurationSec = clamp(_tuning.minDurationSec, 0.08, 1.2);
    _tuning.maxDurationSec = clamp(_tuning.maxDurationSec, 0.12, 2);
    if (_tuning.maxDurationSec < _tuning.minDurationSec) {
        _tuning.maxDurationSec = _tuning.minDurationSec;
    }
    _tuning.easePower = clamp(_tuning.easePower, 1, 4);
    _tuning.tiltFactor = clamp(_tuning.tiltFactor, 0, 1.2);
    _tuning.landHoldSec = clamp(_tuning.landHoldSec, 0, 2);
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}