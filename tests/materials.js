import {eligible, materialStyle, PRESETS, shellSurfaceKind, shellSurfaceRole} from '../prism@local/materials.js';
function assert(value, message) { if (!value) throw new Error(message); }
const base = {normal: true, fullscreen: false, minimized: false, focused: true, focusOnly: true, app: 'test.desktop', applications: ['test.desktop']};
assert(eligible(base), 'Opted-in focused normal window is eligible');
for (const change of [{fullscreen: true}, {minimized: true}, {normal: false}, {focused: false}, {applications: []}, {app: 'other.desktop'}])
    assert(!eligible({...base, ...change}), `Must reject ${JSON.stringify(change)}`);
assert(eligible({...base, focused: false, focusOnly: false}), 'All-selected-windows mode');
assert(materialStyle('unknown', true) === materialStyle('frosted', true), 'Unknown preset falls back');
assert(materialStyle('clear', true) !== materialStyle('clear', false), 'Distinct appearance tokens');
for (const dark of [true, false]) {
    assert(materialStyle('frosted', dark, {edges: false}).includes('rgba(255,255,255,0)'),
        'Disabling glass edges removes synthetic app highlights in either appearance');
    assert(!materialStyle('frosted', dark, {edges: true}).includes('rgba(255,255,255,0);'),
        'Enabled glass edges remain visible');
}
assert(PRESETS.clear.radius < PRESETS.frosted.radius && PRESETS.frosted.radius < PRESETS.soft.radius, 'Material density increases');
assert(eligible({...base, app: undefined, applications: [], allApplications: true}), 'All apps includes unidentified eligible windows');
assert(!eligible({...base, normal: false, allApplications: true}), 'All apps never admits desktop/dock/unknown window types');
assert(shellSurfaceKind('dash-background custom') === 'dock', 'Dock background classification');
assert(shellSurfaceKind('popup-menu-content quick-settings') === 'menus', 'Menu classification');
assert(shellSurfaceKind('modal-dialog') === 'dialogs', 'Dialog classification');
assert(shellSurfaceKind('popup-menu-item') === null, 'Menu foreground rows are untouched');
assert(shellSurfaceKind('popup-menu-boxpointer') === 'menus', 'Popup chrome classified');
assert(shellSurfaceKind('datemenu-popover') === 'menus', 'Date menu classified even without generic menu class');
assert(shellSurfaceKind('notification-banner') === 'notifications', 'Tray banners classified independently');
assert(shellSurfaceRole('popup-menu-boxpointer') === 'pointer', 'Arrow paint separated from material');
assert(shellSurfaceRole('calendar') === 'inset', 'Calendar cards require scoped background clearing');
for (const classes of ['switcher-list', 'osd-window', 'dash-label', 'screenshot-ui-tooltip', 'tooltip']) {
    assert(shellSurfaceKind(classes) === 'overlays' && shellSurfaceRole(classes) === 'surface',
        `${classes} is a lightweight overlay surface`);
}
for (const classes of ['switcher-popup', 'item-box', 'level', 'search-entry', 'app-folder-dialog'])
    assert(shellSurfaceKind(classes) === null, `${classes} does not receive a separate desktop material`);
print('Material eligibility and Shell surface policy checks passed');
