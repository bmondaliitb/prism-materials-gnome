export const PRESETS = Object.freeze({
    clear: {name: 'Clear', radius: 18, tint: 0.06},
    frosted: {name: 'Frosted', radius: 36, tint: 0.16},
    soft: {name: 'Soft', radius: 56, tint: 0.28},
});

export function materialStyle(preset, dark) {
    const tint = (PRESETS[preset] ?? PRESETS.frosted).tint;
    const color = dark ? '24, 27, 36' : '240, 244, 252';
    return `background-color: rgba(${color}, ${tint}); border: 1px solid rgba(255,255,255,${dark ? 0.12 : 0.32});`;
}

export function eligible({normal, fullscreen, minimized, focused, focusOnly, app, applications, allApplications = false}) {
    return normal && !fullscreen && !minimized && (!focusOnly || focused) &&
        (allApplications || applications.includes(app));
}

export function shellSurfaceKind(classes) {
    const names = new Set(classes.split(/\s+/));
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
