import {surfaceOpacity, panelIsDark, wallpaperLuminance, solidLuminance} from '../prism@local/experience.js';
import {materialStyle} from '../prism@local/materials.js';
import GdkPixbuf from 'gi://GdkPixbuf';
function assert(value, message) { if (!value) throw new Error(message); }
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
