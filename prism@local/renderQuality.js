// Pixel budgets are per surface, not a desktop-wide memory or frame-time limit.
export const RENDER_LEVELS = Object.freeze({
    eco: Object.freeze({factor: 8, pixels: 65536, taps: 5}),
    balanced: Object.freeze({factor: 4, pixels: 262144, taps: 9}),
    high: Object.freeze({factor: 2, pixels: 524288, taps: 9}),
});
export function renderLevel(name) {
    return RENDER_LEVELS[name] ?? RENDER_LEVELS.eco;
}
