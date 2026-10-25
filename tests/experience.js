import {surfaceOpacity, panelIsDark, wallpaperLuminance, solidLuminance, comfortPolicy, Experience} from '../prism@local/experience.js';
import {materialStyle} from '../prism@local/materials.js';
import GdkPixbuf from 'gi://GdkPixbuf';
function assert(value, message) { if (!value) throw new Error(message); }
const battery = {onBattery: true, powerSaver: false};
assert(comfortPolicy(battery, true, 'high', 30).backdropFps === 20 &&
    !comfortPolicy(battery, true, 'high', 30).blurFocusedOnly, 'Battery retains all-window blur with a lower refresh cap');
const saver = comfortPolicy({onBattery: false, powerSaver: true}, true, 'high', 0);
assert(saver.quality === 'eco' && saver.backdropFps === 12 && saver.blurFocusedOnly,
    'Explicit Power Saver works on AC and caps an unlimited refresh preference');
assert(comfortPolicy(battery, true, 'off', 5).quality === 'off' &&
    comfortPolicy(battery, true, 'high', 5).backdropFps === 5, 'Manual blur-off and lower refresh rates stay authoritative');
const manual = comfortPolicy({onBattery: true, powerSaver: true}, false, 'high', 0);
assert(manual.quality === 'high' && manual.backdropFps === 0 && !manual.lowPower && !manual.blurFocusedOnly,
    'Disabling automatic comfort restores saved quality and unlimited refresh without changing preferences');
assert(comfortPolicy({}, true, 'balanced', 30).quality === 'balanced', 'Missing power services retain the saved policy');
const cached = comfortPolicy({onBattery: true}, true, 'cached', 30);
assert(cached.quality === 'eco' && cached.cachedBackdrop, 'Cached frost uses the Eco budget and retains frozen caching on battery');
let onBattery = true, profile = 'balanced', changes = 0;
const powerProbe = {state: {}, _a11y: {get_boolean: () => false}, _interface: {get_boolean: () => true},
    _battery: {get_cached_property: () => ({deep_unpack: () => onBattery})},
    _power: {get_cached_property: () => ({deep_unpack: () => profile})}, _changed: () => changes++};
Experience.prototype._sync.call(powerProbe);
assert(powerProbe.state.onBattery && !powerProbe.state.powerSaver,
    'UPower battery status is distinct from an explicit Power Saver profile');
onBattery = false; profile = 'power-saver';
Experience.prototype._sync.call(powerProbe);
assert(!powerProbe.state.onBattery && powerProbe.state.powerSaver && changes === 2,
    'Power profile changes independently refresh the policy while plugged in');
assert(surfaceOpacity('dialogs', 0.85, true) > surfaceOpacity('menus', 0.85, true), 'Dialogs have stronger separation than menus');
assert(surfaceOpacity('dock', 0.85, true) < surfaceOpacity('menus', 0.85, true), 'Dock remains airier than menus');
assert(surfaceOpacity('dialogs', 0.99, true) === 1 && surfaceOpacity('dock', 0.4, true) === 0.4, 'Hierarchy stays within opacity bounds');
assert(surfaceOpacity('dialogs', 0.85, false) === 0.85, 'Hierarchy can be disabled');
assert(panelIsDark(false, 0.25, 0.05), 'Dark wallpaper gives bright panel labels even in light appearance');
assert(!panelIsDark(true, 0.25, 0.95), 'Bright wallpaper gives dark labels even in dark appearance');
assert(panelIsDark(true, 0.25, null), 'Missing wallpaper falls back to selected appearance');
assert(panelIsDark(true, 1, 1) && !panelIsDark(false, 1, 0), 'Opaque panels take precedence over wallpaper colors');
const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, 8, 8);
pixbuf.fill(0xffffffff);
assert(wallpaperLuminance(pixbuf) > 0.99, 'Real image sample detects bright wallpaper');
pixbuf.fill(0x000000ff);
assert(wallpaperLuminance(pixbuf) === 0, 'Real image sample detects dark wallpaper');
assert(solidLuminance('#ffffff') > 0.99 && solidLuminance('#000000') === 0 && solidLuminance('invalid') === null,
    'Solid wallpapers have a safe brightness estimate or fallback');
const focused = materialStyle('soft', true, {focused: true, emphasis: true, edges: true, transitions: true});
const inactive = materialStyle('soft', true, {focused: false, emphasis: true, edges: true});
assert(focused !== inactive && focused.includes('140ms') && inactive.includes('0ms'), 'Focus emphasis and optional tint transitions change only backdrop styling');
print('Material hierarchy, wallpaper sampling/contrast, focus styling, and transition policies passed');
