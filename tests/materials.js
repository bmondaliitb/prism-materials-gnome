import {eligible, materialStyle, PRESETS, shellSurfaceKind, shellSurfaceRole} from '../prism@local/materials.js';
function assert(value, message) { if (!value) throw new Error(message); }
const base = {normal: true, fullscreen: false, minimized: false, focused: true, focusOnly: true, app: 'test.desktop', applications: ['test.desktop']};
assert(eligible(base), 'Opted-in focused normal window is eligible');
for (const change of [{fullscreen: true}, {minimized: true}, {normal: false}, {focused: false}, {applications: []}, {app: 'other.desktop'}])
    assert(!eligible({...base, ...change}), `Must reject ${JSON.stringify(change)}`);
assert(eligible({...base, focused: false, focusOnly: false}), 'All-selected-windows mode');
assert(materialStyle('unknown', true) === materialStyle('frosted', true), 'Unknown preset falls back');
assert(materialStyle('clear', true) !== materialStyle('clear', false), 'Distinct appearance tokens');
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
print('22 material policy checks passed');
