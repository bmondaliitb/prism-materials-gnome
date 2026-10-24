import GLib from 'gi://GLib';
import {clientSurfaceRoot} from '../prism@local/windowSurface.js';
import {eligible, materialStyle} from '../prism@local/materials.js';
const [, bytes] = GLib.file_get_contents('prism@local/extension.js');
const source = new TextDecoder().decode(bytes).replace(/^import .*;\n/gm, '').replace('export default class Prism', 'class Prism');
let destroyed = 0;
class Widget {
    constructor(properties) { this.properties = properties; this.redraws = 0; }
    add_effect(effect) { this.effect = effect; }
    set_position(x, y) { this.position = [x, y]; }
    set_size(w, h) { this.size = [w, h]; }
    set_style(style) { this.style = style; }
    queue_redraw() { this.redraws++; }
    destroy() { destroyed++; }
}
let windowType = 0;
const win = {get_window_type: () => windowType, is_fullscreen: () => false, minimized: false,
    get_frame_rect: () => ({x: 15, y: 25, width: 500, height: 400}),
    get_buffer_rect: () => ({x: 10, y: 20})};
const values = {'enabled': true, 'reduce-transparency': false, 'focused-only': true,
    'applications': ['test.desktop'], 'appearance': 'dark', 'preset': 'frosted',
    'sidebar-materials': false, 'blur-radius': 36, 'force-translucency': true, 'translucency': 92};
const settings = {};
for (const method of ['get_boolean', 'get_strv', 'get_int', 'get_string']) settings[method] = key => values[key];
const Prism = new Function('Extension', 'Gio', 'Meta', 'Shell', 'St', 'Main', 'global', 'eligible', 'materialStyle', 'FrostEffect', 'GObject', 'clientSurfaceRoot', 'VisualBackdrop', 'BackdropRefreshEffect', 'gtkMenuCss',
    source + '\nreturn Prism;')(
    class {}, {}, {WindowType: {NORMAL: 0, MENU: 1, DROPDOWN_MENU: 2, POPUP_MENU: 3, TOOLTIP: 4, COMBO: 5, DIALOG: 6, MODAL_DIALOG: 7, UTILITY: 8, TOOLBAR: 9, DESKTOP: 10}}, {BlurMode: {BACKGROUND: 1}, BlurEffect: class {}}, {Widget},
    {overview: {visible: false}, sessionMode: {isLocked: false}}, {display: {focus_window: win}}, eligible, materialStyle, class {isFrost = true;}, {type_name_from_instance: actor => actor.constructor.$gtype}, clientSurfaceRoot, Widget, class {}, (dark, opacity) => `${dark}:${opacity}`);
const extension = new Prism();
extension._settings = settings;
extension._tracker = {get_window_app: () => ({get_id: () => 'test.desktop'})};
const surface = {opacity: 240, constructor: {$gtype: 'MetaSurfaceContainerActorWayland'}};
const decoration = {opacity: 255, constructor: {$gtype: 'OtherExtensionDecoration'}};
const actor = {effects: [], get_children: () => [decoration, surface], insert_child_at_index: () => {},
    add_effect(effect) { this.effects.push(effect); },
    remove_effect(effect) { this.effects = this.effects.filter(item => item !== effect); }};
const state = {window: win, layer: null};
function assert(value, message) { if (!value) throw new Error(message); }
extension._update(actor, state);
assert(surface.opacity === 221 && decoration.opacity === 255, 'Actual compositor root selected even behind another decoration');
assert(state.layer.position.join() === '5,5', 'Backdrop uses frame-buffer offsets');
assert(state.layer.size.join() === '500,400', 'Backdrop excludes shadow extents');
assert(actor.effects.length === 1, 'Window actor receives a culling guard while backdrop capture is active');
assert(!state.layer.properties.reactive && !state.layer.properties.can_focus && !state.layer.properties.track_hover, 'Backdrop cannot receive clicks, keyboard focus, or hover');
extension._update(actor, state);
assert(surface.opacity === 221, 'Repeated updates must not accumulate fading');
assert(state.layer.redraws === 1, 'Repeated window refresh does not invalidate unchanged frost');
values['force-translucency'] = false;
extension._update(actor, state);
assert(surface.opacity === 240, 'Disabling forced translucency restores original alpha');
values.enabled = false;
extension._update(actor, state);
assert(state.layer === null && surface.opacity === 240 && destroyed === 1, 'Suspending cleans up and restores');
assert(actor.effects.length === 0, 'Suspending removes the window culling guard');
extension._update(actor, state);
assert(destroyed === 1, 'Repeated cleanup is idempotent');
values.enabled = true;
values['force-translucency'] = true;
values['sidebar-materials'] = true;
for (const app of ['arbitrary.app.desktop', 'another.app.desktop']) {
    values.applications = [app];
    extension._tracker = {get_window_app: () => ({get_id: () => app})};
    extension._update(actor, state);
    assert(surface.opacity === 240, `${app} must retain full foreground opacity in sidebar mode`);
    extension._clear(state);
}
values.applications = ['another.app.desktop'];
values['sidebar-materials'] = false;
extension._update(actor, state);
assert(surface.opacity === 221, 'Whole-window mode remains available when sidebar-only mode is off');
extension._clear(state);
values['all-applications'] = true;
values.applications = [];
extension._update(actor, state);
assert(state.layer !== null, 'All-app scope does not require app selection');
extension._clear(state);
windowType = 6;
extension._update(actor, state);
assert(state.layer === null, 'Dialogs excluded until requested');
values['window-dialogs'] = true;
extension._update(actor, state);
assert(state.layer !== null, 'Dialog category can be enabled');
extension._clear(state);
windowType = 3;
values['sidebar-materials'] = true;
values['popup-opacity'] = 80;
extension._update(actor, state);
assert(state.layer === null, 'Popups excluded until requested');
values['window-popups'] = true;
extension._update(actor, state);
assert(state.layer !== null && surface.opacity === 192, 'Popup opacity is independent of sidebar and whole-window mode');
extension._clear(state);
windowType = 10;
extension._update(actor, state);
assert(state.layer === null, 'Desktop never admitted by broad scope');
windowType = 0;
values['sidebar-materials'] = false;
values['preserve-corners'] = true;
extension._update(actor, state);
assert(state.layer === null && state.surface === surface && surface.opacity === 221, 'Native window corners remain unbacked while translucency stays active');
extension._clear(state);
assert(surface.opacity === 240 && state.surface === null, 'Corner-safe mode restores alpha even without a backdrop layer');
values['preserve-corners'] = false;
extension._update(actor, state);
assert(state.layer !== null, 'Explicit legacy mode can create backdrop blur');
values['preserve-corners'] = true;
extension._update(actor, state);
assert(state.layer === null && surface.opacity === 221, 'Enabling corner safety removes existing square backdrops immediately');
extension._clear(state);
values['rounded-frost'] = true;
values['window-radius'] = 14;
extension._update(actor, state);
assert(state.layer !== null && state.effect.isFrost && state.effect.radii[0] === 14, 'Corner-safe app backdrops use configurable rounded frost');
extension._clear(state);
values['render-quality'] = 'off';
extension._update(actor, state);
assert(state.layer !== null && state.effect === null && surface.opacity === 221, 'Translucency-only keeps tint and opacity with no GPU capture effect');
assert(actor.effects.length === 0, 'Translucency-only does not disable compositor culling');
values['render-quality'] = 'eco';
extension._update(actor, state);
assert(state.effect.quality === 'eco', 'Switching from no blur to Eco creates the bounded renderer');
values['render-quality'] = 'high';
extension._update(actor, state);
assert(state.effect.quality === 'high', 'App rendering level changes without reload');
extension._clear(state);
let writes = 0;
values['auto-comfort'] = true;
values['gentle-transitions'] = true;
extension._experience = {state: {highContrast: true, lowPower: false, animations: true}};
extension._update(actor, state);
assert(state.layer === null && surface.opacity === 240, 'System high contrast suspends window effects and restores original opacity');
extension._experience.state = {highContrast: false, lowPower: true, animations: false};
values['render-quality'] = 'high';
extension._update(actor, state);
assert(state.effect.quality === 'eco' && state.layer.style.includes('transition-duration: 0ms'), 'Battery mode selects Eco and disables tint transitions');
assert(values['render-quality'] === 'high', 'Automatic comfort does not rewrite the saved quality setting');
extension._clear(state);
values['focused-only'] = false;
const backgroundState = {window: {...win}, layer: null};
extension._update(actor, backgroundState);
assert(backgroundState.layer === null, 'Battery mode limits app backdrops to the focused app even with all-window scope');
values['auto-comfort'] = false;
assert(extension._context().quality === 'high', 'Automatic comfort can be disabled independently');
extension._experience.state.lowPower = false;
values['gtk-menus'] = true;
extension._gtkMenus = {apply: () => writes++};
extension._syncGtkMenus();
extension._syncGtkMenus();
assert(writes === 1, 'Unchanged generated CSS avoids synchronous file access');
values['shell-opacity'] = 80;
extension._syncGtkMenus();
assert(writes === 2, 'Palette/opacity changes still update GTK menus');
extension._syncGtkMenus(true);
assert(writes === 3, 'Disable always removes managed GTK styles');
let cssSyncs = 0, shellRefreshes = 0;
extension._syncGtkMenus = () => cssSyncs++;
extension._shellSurfaces = {refresh: () => shellRefreshes++};
extension._windows = new Map();
extension._refresh(false);
assert(cssSyncs === 0 && shellRefreshes === 0, 'Focus refresh does no stylesheet IO or Shell tree scan');
print('Lifecycle and focus hot-path checks passed');
