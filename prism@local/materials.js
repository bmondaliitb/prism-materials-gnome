export const PRESETS = Object.freeze({
    clear: {name: 'Clear', radius: 18, tint: 0.06},
    frosted: {name: 'Frosted', radius: 36, tint: 0.16},
    soft: {name: 'Soft', radius: 56, tint: 0.28},
});

// One palette across compositor and GTK materials. Density and geometry remain
// role-specific; overview/OSD/authentication use the dark palette for native
// light foregrounds even when application appearance is light.
const PALETTES = Object.freeze({
    dark: Object.freeze({background: '25,28,35', foreground: '242,242,242',
        edge: '255,255,255,0.14', highlight: '255,255,255'}),
    light: Object.freeze({background: '240,244,252', foreground: '28,30,40',
        edge: '20,25,35,0.14', highlight: '28,30,40'}),
});
export const MATERIAL_STATES = Object.freeze({hover: 0.12, focus: 0.16, pressed: 0.22, disabled: 0.4});
export function surfacePalette(dark) { return PALETTES[dark ? 'dark' : 'light']; }

export function materialStyle(preset, dark, options = {}) {
    const inactive = options.emphasis && !options.focused;
    const tint = Math.min(0.6, (PRESETS[preset] ?? PRESETS.frosted).tint + (inactive ? 0.08 : 0));
    const color = surfacePalette(dark).background;
    const edge = options.edges ? (inactive ? 0.06 : dark ? 0.26 : 0.55) : 0;
    return `background-color: rgba(${color}, ${tint}); border: 1px solid rgba(255,255,255,${edge}); transition-duration: ${options.transitions ? 140 : 0}ms;`;
}

export function eligible({normal, fullscreen, minimized, focused, focusOnly, app, applications, allApplications = false}) {
    return normal && !fullscreen && !minimized && (!focusOnly || focused) &&
        (allApplications || applications.includes(app));
}

export function shellSurfaceKind(classes) {
    const names = new Set(classes.split(/\s+/));
    if (['switcher-list', 'osd-window', 'dash-label', 'screenshot-ui-tooltip', 'tooltip']
        .some(name => names.has(name))) return 'overlays';
    if (names.has('dash-background')) return 'dock';
    if (['popup-menu-content', 'quick-settings', 'popup-menu-boxpointer',
        'candidate-popup-boxpointer', 'candidate-popup-content', 'datemenu-popover',
        'popup-sub-menu', 'quick-toggle-menu'].some(name => names.has(name))) return 'menus';
    if (names.has('notification-banner')) return 'notifications';
    if (names.has('modal-dialog')) return 'dialogs';
    return null;
}

export function shellSurfaceRole(classes) {
    const names = new Set(classes.split(/\s+/));
    if (names.has('popup-menu-boxpointer') || names.has('candidate-popup-boxpointer')) return 'pointer';
    if (shellSurfaceKind(classes)) return 'surface';
    if (['calendar', 'datemenu-today-button', 'datemenu-calendar-column',
        'datemenu-displays-box', 'datemenu-displays-section', 'message-list',
        'message', 'events-button', 'world-clocks-button', 'weather-button'].some(name => names.has(name))) return 'inset';
    return null;
}
