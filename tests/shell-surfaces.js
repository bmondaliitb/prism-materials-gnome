import GLib from 'gi://GLib';
import {shellSurfaceKind, shellSurfaceRole} from '../prism@local/materials.js';
import {surfaceOpacity, panelIsDark} from '../prism@local/experience.js';
const [, bytes] = GLib.file_get_contents('prism@local/shellSurfaces.js');
const source = new TextDecoder().decode(bytes).replace(/^import .*;\n/gm, '').replace('export class', 'class');
const callbacks = new Map(); let sourceId = 0;
const loop = {PRIORITY_DEFAULT_IDLE: 0, SOURCE_REMOVE: false,
    idle_add: (_priority, callback) => { callbacks.set(++sourceId, callback); return sourceId; },
    source_remove: id => callbacks.delete(id)};
const Manager = new Function('GLib', 'Shell', 'St', 'shellSurfaceKind', 'shellSurfaceRole', 'FrostEffect', 'surfaceOpacity', 'panelIsDark', source + '\nreturn ShellSurfaces;')(
    loop, {BlurMode: {BACKGROUND: 1}, BlurEffect: class {isNative = true; set_enabled(value) { this.enabled = value; }}},
    {Label: class {static [Symbol.hasInstance](actor) { return actor.isLabel; }},
        Icon: class {static [Symbol.hasInstance](actor) { return actor.isIcon; }}},
    shellSurfaceKind, shellSurfaceRole, class {isFrost = true;}, surfaceOpacity, panelIsDark);
class Actor {
    constructor(classes = '', children = []) {
        this.classes = classes; this.children = children; this.style = 'border-radius: 8px;';
        this.radii = [0, 0, 0, 0];
        this.redraws = 0;
        this.effects = []; this.signals = new Map(); this.next = 0;
    }
    connect(signal, callback) { this.signals.set(++this.next, [signal, callback]); return this.next; }
    disconnect(id) { this.signals.delete(id); }
    emit(signal, child) { for (const [name, callback] of [...this.signals.values()]) if (name === signal) callback(this, child); }
    get_children() { return this.children; }
    get_style_class_name() { return this.classes; }
    get_style() { return this.style; }
    get_clip_to_allocation() { return this.clipped ?? false; }
    set_clip_to_allocation(value) { this.clipped = value; }
    get_theme_node() { return {get_border_radius: corner => this.radii[corner]}; }
    set_style(value) { this.style = value; this.emit('notify::style'); this.emit('style-changed'); }
    add_effect(effect) { this.effects.push(effect); }
    remove_effect(effect) { this.effects = this.effects.filter(item => item !== effect); }
    queue_redraw() { this.redraws++; }
}
function assert(value, message) { if (!value) throw new Error(message); }
const menu = new Actor('popup-menu-content'), text = new Actor('popup-menu-item');
menu.children.push(text);
const inlineSubmenu = new Actor('popup-sub-menu', [new Actor('popup-menu-item')]);
const floatingSubmenu = new Actor('popup-sub-menu');
const floatingPointer = new Actor('popup-menu-boxpointer', [floatingSubmenu]);
menu.children.push(inlineSubmenu, floatingPointer);
const standaloneSubmenu = new Actor('popup-sub-menu');
const quickToggle = new Actor('quick-toggle-menu');
const dock = new Actor('dash-background'), panel = new Actor(), dialog = new Actor('modal-dialog');
const clock = new Actor('clock-display');
const trayIcon = new Actor('system-status-icon');
clock.isLabel = true;
trayIcon.isIcon = true;
const panelButton = new Actor('panel-button', [clock, trayIcon]);
const workspaceDot = new Actor('workspace-dot');
const workspaceLayout = new Actor('workspace-indicator', [workspaceDot]);
panelButton.children.push(workspaceLayout);
const panelPopupLabel = new Actor('popup-menu-item');
const panelPopup = new Actor('popup-menu-content', [panelPopupLabel]);
panel.children.push(panelButton, panelPopup);
const calendar = new Actor('calendar'), calendarCard = new Actor('events-button');
menu.children.push(calendar, calendarCard);
const pointer = new Actor('popup-menu-boxpointer popup-menu', [menu]);
let repaints = 0;
pointer._border = {queue_repaint: () => repaints++};
const looseCalendar = new Actor('calendar');
const message = new Actor('message');
const banner = new Actor('notification-banner', [message]);
panel.style = 'background-color: #131313 !important;';
const orphan = new Actor('popup-menu-boxpointer popup-menu', [new Actor('custom-tray-content')]);
const switcherItem = new Actor('item-box');
const level = new Actor('level');
const overlays = [new Actor('switcher-list', [switcherItem]), new Actor('osd-window', [level]),
    new Actor('dash-label'), new Actor('screenshot-ui-tooltip'), new Actor('tooltip')];
const root = new Actor('', [pointer, orphan, dock, panel, dialog, looseCalendar, banner, ...overlays, standaloneSubmenu, quickToggle]);
let active = false, dark = true;
const values = {'shell-menus': true, 'shell-panel': true, 'shell-dock': false, 'shell-dialogs': false,
    'shell-opacity': 85, 'panel-opacity': 25, 'panel-blur': true, 'blur-radius': 36};
const settings = {get_boolean: key => values[key], get_int: key => values[key], get_string: key => values[key]};
let environment = {};
const tracked = new Map();
const guard = {track: (actor, enabled) => tracked.set(actor, enabled), untrack: actor => tracked.delete(actor)};
const manager = new Manager(root, panel, settings, () => dark, () => active, guard, () => environment);
assert(menu.effects.length === 0, 'Global suspension prevents Shell styling');
active = true; manager.refresh();
assert(menu.effects.length === 1 && panel.effects.length === 1, 'Enabled surfaces receive blur');
assert(inlineSubmenu.effects.length === 0 && inlineSubmenu.style.includes('background-color: transparent !important;'),
    'Expanded inline submenus share the parent material without compounding opacity or blur');
assert(floatingSubmenu.effects.length === 1 && standaloneSubmenu.effects.length === 1 && quickToggle.effects.length === 1,
    'A separate BoxPointer, standalone submenu, and Quick Settings overlay retain their own material');
assert(overlays.every(actor => actor.style === 'border-radius: 8px;'), 'Overlay switch is independent of menus');
values['shell-overlays'] = true; manager.refresh();
for (const actor of overlays) {
    assert(actor.effects.length === 0 && !tracked.get(actor), 'Short-lived overlay never adds blur or a full-redraw guard');
    assert(actor.style.includes('rgba(25,28,35,0.85)') && !actor.style.includes('border:') && !actor.style.includes('transition-duration:'),
        'Overlay tint preserves native geometry and animation timing');
}
assert(switcherItem.style === 'border-radius: 8px;' && level.style === 'border-radius: 8px;',
    'Switcher selection highlights and volume/brightness levels retain their native styling');
assert(panel.style.includes('background-color: rgba(32,34,38,0.25) !important;'), 'Panel has a light tint that blends with the background');
assert(panel.effects[0].brightness === 1, 'Panel preserves background brightness');
const nativePanelEffect = panel.effects[0], nativePanelStyle = panel.style;
manager.setMotionPaused(true);
assert(!nativePanelEffect.enabled && panel.style === nativePanelStyle, 'Workspace animation pauses native panel blur while retaining its styling');
manager.setMotionPaused(false);
assert(nativePanelEffect.enabled && panel.effects[0] === nativePanelEffect, 'Workspace completion reuses and restores the existing native panel effect');
values['panel-blur'] = false; manager.refresh();
assert(panel.effects.length === 0 && panel.style.includes('rgba(32,34,38,0.25)'), '4K profile can keep panel translucency without permanent native blur');
values['panel-blur'] = true; manager.refresh();
assert(panel.effects[0].isNative && !panel.effects[0].isFrost, 'Panel controls are not clipped through the custom rounded shader');
assert(workspaceDot.style === 'border-radius: 8px;' && workspaceLayout.style === 'border-radius: 8px;' && panelButton.style === 'border-radius: 8px;',
    'Workspace dots, layout widgets, and buttons keep their native inline styles');
assert(workspaceDot.effects.length === 0 && workspaceLayout.effects.length === 0, 'Workspace indicator gets no rendering effects');
assert(clock.style.includes('color: rgb(246,247,249) !important;') && trayIcon.style.includes('color: rgb(246,247,249) !important;'),
    'Clock and symbolic tray icons use a bright foreground on the dark panel');
assert(!panelButton.style.includes('background-color:'), 'Panel button hover backgrounds are preserved');
assert(!panelPopupLabel.style.includes('color:'), 'Panel foreground styling does not leak into popup menu content');
dark = false; manager.refresh();
assert(overlays.every(actor => actor.style.includes('rgba(25,28,35,0.85)') && actor.effects.length === 0),
    'Light appearance retains a dark backing for native white OSD and switcher contents');
assert(panel.style.includes('rgba(218,222,228,0.25)') && clock.style.includes('rgb(16,20,26)') && trayIcon.style.includes('rgb(16,20,26)'),
    'Light panel uses neutral gray and dark clock/icon foregrounds');
const lightMenuStyle = menu.style;
values['panel-opacity'] = 70; manager.refresh();
assert(panel.style.includes('rgba(218,222,228,0.7)') && menu.style === lightMenuStyle,
    'Changing panel opacity does not change menu materials');
values['panel-opacity'] = 0; manager.refresh();
assert(panel.style.includes('rgba(218,222,228,0)') && menu.style === lightMenuStyle,
    'Zero tint is allowed without changing other materials');
assert(!clock.style.includes('text-shadow:') && !trayIcon.style.includes('icon-shadow:') && !panel.style.includes('shadow:'),
    'No inherited shadows change panel or workspace paint bounds');
values['panel-opacity'] = 25;
dark = true; manager.refresh();
assert(pointer.style.includes('-arrow-background-color: transparent !important;') && repaints > 0, 'BoxPointer fill cleared and border repainted');
assert(pointer.effects.length === 0, 'Popup chrome does not duplicate backdrop blur');
assert(orphan.style.includes('-arrow-background-color: rgba(24,27,36,0.85) !important;'), 'Popup without a recognized content actor keeps its native tinted backing');
const lateContent = new Actor('popup-menu-content');
orphan.children.push(lateContent); orphan.emit('child-added', lateContent);
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert(orphan.style.includes('-arrow-background-color: transparent !important;') && lateContent.style.includes('rgba(24,27,36,0.85)'), 'Wrapper is cleared only after a replacement surface exists');
orphan.children = orphan.children.filter(child => child !== lateContent); orphan.emit('child-removed', lateContent);
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert(orphan.style.includes('-arrow-background-color: rgba(24,27,36,0.85) !important;'), 'Removing a content surface restores backing instead of leaving a clear popup');

assert(calendar.style.includes('background-color: transparent !important;') && calendarCard.style.includes('background-color: transparent !important;'), 'Calendar layers reveal the root material');
assert(calendar.effects.length === 0 && looseCalendar.style === 'border-radius: 8px;', 'Inset clearing is scoped and adds no stacked blur');
values['shell-notifications'] = true; manager.refresh();
assert(banner.effects.length === 1 && message.effects.length === 0 && message.style.includes('transparent !important'), 'Tray banner material has transparent nested cards');
assert(dock.effects.length === 0 && dialog.effects.length === 0 && text.effects.length === 0, 'Disabled surfaces and menu rows untouched');
assert(menu.style.includes('rgba(24,27,36,0.85)') && menu.style.includes('border-radius: 8px'), 'Tint respects opacity and original inline style');
manager.refresh();
assert(menu.effects.length === 1, 'No duplicate effects');
const hoverRedraws = [menu.redraws, panel.redraws, banner.redraws];
calendarCard.emit('style-changed');
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert([menu.redraws, panel.redraws, banner.redraws].join() === hoverRedraws.join(),
    'Hover refresh does not invalidate unchanged backdrops across the desktop');
values['blur-radius'] = 40; manager.refresh();
assert(menu.redraws === hoverRedraws[0] + 1 && panel.redraws === hoverRedraws[1] && panel.effects[0].radius === 18,
    'Real blur changes repaint menus while Eco panel remains at its native radius cap');
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
text.emit('style-changed');
assert(callbacks.size === 0, 'Menu-row hover does not schedule a global rescan');
menu.emit('style-changed');
assert(callbacks.size === 1, 'Surface theme changes still schedule a refresh');
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert(callbacks.size === 0, 'Owned style writes do not cause refresh feedback');
values['shell-dock'] = true; values['shell-dialogs'] = true; manager.refresh();
assert(dock.effects.length === 1 && dialog.effects.length === 1, 'Dock and dialog switches independent');
values['preserve-corners'] = true;
menu.radii = [16, 16, 16, 16]; dock.radii = [28, 28, 28, 28];
manager.refresh();
assert(menu.effects.length === 0 && dock.effects.length === 0, 'Rounded surfaces never retain a rectangular blur effect');
values['rounded-frost'] = true;
manager.refresh();
assert(menu.effects[0]?.isFrost && dock.effects[0]?.isFrost && !menu.clipped, 'Rounded renderer does not change native control clipping');
assert(menu.effects[0].radii.join() === '16,16,16,16', 'Theme corner radii reach the rounded renderer');
values['rounded-frost'] = false; manager.refresh();
assert(!menu.clipped, 'Renderer changes leave native clipping alone');

assert(menu.style.includes('rgba(24,27,36,0.85)'), 'Rounded surfaces retain translucent styling');
assert(panel.effects.length === 1, 'Square panel keeps blur');
menu.radii = [0, 0, 0, 12];
manager.refresh();
assert(menu.effects.length === 0, 'One rounded corner is enough to suppress rectangular blur');
menu.radii = [0, 0, 0, 0];
manager.refresh();
assert(menu.effects.length === 1, 'Square theme shape can safely restore blur');
values['render-quality'] = 'off'; manager.refresh();
assert(menu.effects.length === 0 && panel.effects.length === 0 && menu.style.includes('rgba('), 'No-blur mode removes all capture effects but keeps tint');
values['render-quality'] = 'eco'; manager.refresh();
assert(menu.effects[0].quality === 'eco' && panel.effects[0].isNative && panel.effects[0].radius === 18, 'Eco applies a bounded blur to menus and native panel');
values['render-quality'] = 'high'; manager.refresh();
assert(overlays.every(actor => actor.effects.length === 0), 'High quality never upgrades tint-only overlays to live capture');
assert(menu.effects[0].quality === 'high', 'Live rendering-level change reaches the effect');
const getTheme = menu.get_theme_node;
menu.get_theme_node = undefined;
manager.refresh();
assert(menu.effects.length === 0, 'Unknown shape falls back to corner-safe translucency');
menu.get_theme_node = getTheme;
values['preserve-corners'] = false;
manager.refresh();
assert(menu.effects.length === 1 && dock.effects.length === 1, 'Legacy rectangular blur remains an explicit option');

const dynamic = new Actor('popup-menu-content'); root.children.push(dynamic); root.emit('child-added', dynamic);
const dynamicOverlay = new Actor('switcher-list'); root.children.push(dynamicOverlay); root.emit('child-added', dynamicOverlay);
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert(dynamic.effects.length === 1, 'Menus created after enable are discovered');
assert(dynamicOverlay.style.includes('rgba(25,28,35,0.85)') && dynamicOverlay.effects.length === 0,
    'Alt+Tab created after enable receives tint without a blur allocation');
values['shell-overlays'] = false; manager.refresh();
assert([...overlays, dynamicOverlay].every(actor => actor.style === 'border-radius: 8px;'),
    'Overlay preference restores original styles on existing and newly created actors');
values['shell-overlays'] = true; manager.refresh();
root.children = root.children.filter(child => child !== dynamic); root.emit('child-removed', dynamic);
assert(dynamic.effects.length === 0 && dynamic.signals.size === 0, 'Detached actor restored and disconnected');
values['material-hierarchy'] = true;
values['glass-edges'] = true;
values['gentle-transitions'] = true;
values['wallpaper-panel'] = true;
environment = {luminance: 1, animations: true};
manager.refresh();
assert(dialog.style.includes('rgba(24,27,36,0.93)') && dock.style.includes('rgba(24,27,36,0.75)'), 'Surface hierarchy reaches dialog and dock styling');
assert(menu.style.includes('border-color: rgba(') && menu.style.includes('transition-duration: 140ms'), 'Glass edges and native tint transitions reach menu material');
assert(!menu.style.includes('border: 1px solid'), 'Glass highlight preserves native border widths and layout');
values['glass-edges'] = false; manager.refresh();
assert(!menu.style.includes('border-color: rgba('), 'Turning glass edges off restores native Shell border styling');
values['glass-edges'] = true; manager.refresh();
assert(!workspaceDot.style.includes('transition-duration:') && !workspaceDot.style.includes('border: 1px'), 'Workspace geometry is untouched by new polish features');
assert(clock.style.includes('rgb(16,20,26)'), 'Bright wallpaper selects readable dark clock text in dark appearance');
environment = {luminance: 0, animations: false, lowPower: true, quality: 'eco'};
manager.refresh();
assert(clock.style.includes('rgb(246,247,249)') && menu.style.includes('transition-duration: 0ms'), 'Wallpaper changes and reduced motion update panel foreground and stop transitions');
assert(menu.effects[0].quality === 'eco', 'Comfort quality overrides Shell effects without changing saved settings');
menu.set_style('external-style: preserved;');
active = false; manager.refresh();
assert([...overlays, dynamicOverlay].every(actor => actor.style === 'border-radius: 8px;'),
    'Reduce transparency/accessibility suspension restores native overlay styling');
assert(menu.style === 'external-style: preserved;', 'Later external inline change survives restoration');
assert(panel.style === 'background-color: #131313 !important;' && panel.effects.length === 0, 'Suspension restores owned style and removes effects');
assert(clock.style === 'border-radius: 8px;' && trayIcon.style === 'border-radius: 8px;', 'Suspension restores original clock and tray styling');
active = true; manager.refresh();
root.emit('child-added', dynamic); // schedule a pending rescan for disable to cancel
manager.destroy();
assert(callbacks.size === 0, 'Disable cancels pending work');
for (const actor of [root, pointer, orphan, ...orphan.children, lateContent, menu, text, calendar, calendarCard, looseCalendar, banner, message, dock, panel, panelButton, workspaceLayout, workspaceDot, clock, trayIcon, panelPopup, panelPopupLabel, dialog, dynamic, ...overlays, switcherItem, level, dynamicOverlay])
    assert(actor.signals.size === 0 && actor.effects.length === 0, 'Disable releases actors and handlers');
assert(tracked.size === 0, 'Disable releases redraw-guard references for every surface');
for (const actor of [inlineSubmenu, ...inlineSubmenu.children, floatingSubmenu, floatingPointer, standaloneSubmenu, quickToggle])
    assert(actor.signals.size === 0 && actor.effects.length === 0 && actor.style === 'border-radius: 8px;',
        'Submenu and overlay materials restore native styles and release their effects/handlers');
print('Shell surface lifecycle and corner/panel/calendar/tray layer regression checks passed');
