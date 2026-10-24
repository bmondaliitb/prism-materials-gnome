import GLib from 'gi://GLib';
import {shellSurfaceKind, shellSurfaceRole} from '../prism@local/materials.js';
const [, bytes] = GLib.file_get_contents('prism@local/shellSurfaces.js');
const source = new TextDecoder().decode(bytes).replace(/^import .*;\n/gm, '').replace('export class', 'class');
const callbacks = new Map(); let sourceId = 0;
const loop = {PRIORITY_DEFAULT_IDLE: 0, SOURCE_REMOVE: false,
    idle_add: (_priority, callback) => { callbacks.set(++sourceId, callback); return sourceId; },
    source_remove: id => callbacks.delete(id)};
const Manager = new Function('GLib', 'Shell', 'shellSurfaceKind', 'shellSurfaceRole', 'FrostEffect', source + '\nreturn ShellSurfaces;')(
    loop, {BlurMode: {BACKGROUND: 1}, BlurEffect: class {}}, shellSurfaceKind, shellSurfaceRole, class {isFrost = true;});
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
const dock = new Actor('dash-background'), panel = new Actor(), dialog = new Actor('modal-dialog');
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
const root = new Actor('', [pointer, orphan, dock, panel, dialog, looseCalendar, banner]);
let active = false;
const values = {'shell-menus': true, 'shell-panel': true, 'shell-dock': false, 'shell-dialogs': false,
    'shell-opacity': 85, 'blur-radius': 36};
const settings = {get_boolean: key => values[key], get_int: key => values[key], get_string: key => values[key]};
const manager = new Manager(root, panel, settings, () => true, () => active);
assert(menu.effects.length === 0, 'Global suspension prevents Shell styling');
active = true; manager.refresh();
assert(menu.effects.length === 1 && panel.effects.length === 1, 'Enabled surfaces receive blur');
assert(panel.style.includes('background-color: rgba(24,27,36,0.85) !important;'), 'Panel opacity overrides theme important paint');
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
assert(menu.redraws === hoverRedraws[0] + 1 && panel.redraws === hoverRedraws[1] + 1,
    'Real blur parameter changes invalidate each affected backdrop once');
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
assert(menu.effects[0].quality === 'eco' && panel.effects[0].quality === 'eco', 'Eco applies to square panel and menu surfaces');
values['render-quality'] = 'high'; manager.refresh();
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
for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
assert(dynamic.effects.length === 1, 'Menus created after enable are discovered');
root.children = root.children.filter(child => child !== dynamic); root.emit('child-removed', dynamic);
assert(dynamic.effects.length === 0 && dynamic.signals.size === 0, 'Detached actor restored and disconnected');
menu.set_style('external-style: preserved;');
active = false; manager.refresh();
assert(menu.style === 'external-style: preserved;', 'Later external inline change survives restoration');
assert(panel.style === 'background-color: #131313 !important;' && panel.effects.length === 0, 'Suspension restores owned style and removes effects');
active = true; manager.refresh();
root.emit('child-added', dynamic); // schedule a pending rescan for disable to cancel
manager.destroy();
assert(callbacks.size === 0, 'Disable cancels pending work');
for (const actor of [root, pointer, orphan, ...orphan.children, lateContent, menu, text, calendar, calendarCard, looseCalendar, banner, message, dock, panel, dialog, dynamic])
    assert(actor.signals.size === 0 && actor.effects.length === 0, 'Disable releases actors and handlers');
print('Shell surface lifecycle and corner/panel/calendar/tray layer regression checks passed');
