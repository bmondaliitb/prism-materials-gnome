// One coordinated profile. Only user-facing choices are persisted; renderer
// values are derived here, so stale per-surface settings cannot override them.
export const DESKTOP_PROFILES = Object.freeze({
    subtle: Object.freeze({label: 'Subtle · more solid', strength: 85}),
    balanced: Object.freeze({label: 'Balanced', strength: 69}),
    airy: Object.freeze({label: 'Airy · default', strength: 50}),
    mist: Object.freeze({label: 'Mist · translucent', strength: 35}),
    glass: Object.freeze({label: 'Glass · very translucent', strength: 15}),
    crystal: Object.freeze({label: 'Crystal · most translucent', strength: 0}),
});

function profileForStrength(value) {
    return Object.keys(DESKTOP_PROFILES).find(key => DESKTOP_PROFILES[key].strength === value) ?? 'custom';
}

export function applyDesktopProfile(settings, profile) {
    if (profile === 'custom') {
        settings.set_string('desktop-profile', 'custom');
        return;
    }
    if (!Object.hasOwn(DESKTOP_PROFILES, profile)) return;
    applyStrength(settings, DESKTOP_PROFILES[profile].strength, profile);
}

export function materialValues(strength) {
    const value = Math.max(0, Math.min(100, Math.round(strength)));
    const density = value < 50 ? -100 + value * 2.4 : 20 + (value - 50) * 1.6;
    return {
        windowOpacity: Math.round(75 + density * 0.20),
        detail: Math.max(0, Math.round(10 + density * 0.20)),
        popupOpacity: Math.round(86 + density * 0.12),
        shellOpacity: Math.round(70 + density * 0.30),
        panelOpacity: Math.max(0, Math.round(10 + density * 0.30)),
        overviewOpacity: Math.max(0, Math.round(20 + density * 0.30)),
    };
}

export function applyStrength(settings, strength, profile = 'custom') {
    const value = Math.max(0, Math.min(100, Math.round(strength)));
    if (settings.get_int('material-strength') !== value) settings.set_int('material-strength', value);
    if (settings.get_string('desktop-profile') !== profile) settings.set_string('desktop-profile', profile);
}

export function applyRecommended(settings) {
    applyDesktopProfile(settings, 'airy');
    settings.set_int('simple-profile-version', 5);
}

export function initializeProfile(settings) {
    const version = settings.get_int('simple-profile-version');
    if (version < 1) applyRecommended(settings);
    else if (version < 4) {
        const oldProfile = settings.get_string('desktop-profile');
        if (version >= 3 && oldProfile !== 'custom') {
            applyDesktopProfile(settings, oldProfile === 'macos' ? 'balanced' : oldProfile);
        } else {
            const old = settings.get_int('material-strength');
            const strength = Math.round(old <= 20 ? (old + 100) / 2.4 : 50 + (old - 20) / 1.6);
            applyStrength(settings, strength, version >= 3 ? 'custom' : profileForStrength(strength));
        }
        settings.set_int('simple-profile-version', 5);
    } else if (version < 5) settings.set_int('simple-profile-version', 5);
}
