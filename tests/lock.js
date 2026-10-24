import GLib from 'gi://GLib';
function assert(value, message) { if (!value) throw new Error(message); }
class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties); this.children = []; this.signals = new Map();
        this.next = 0; this.style = null;
    }
    connect(name, callback) { this.signals.set(++this.next, [name, callback]); return this.next; }
    disconnect(id) { this.signals.delete(id); }
    emit(name, child) { for (const [signal, callback] of [...this.signals.values()]) if (name === signal) callback(this, child); }
    get_style() { return this.style; }
    set_style(style) { this.style = style; }
    get_children() { return this.children; }
    get_effect() { return this.effect; }
}
const [, bytes] = GLib.file_get_contents('prism@local/lockMaterial.js');
const source = new TextDecoder().decode(bytes).replace(/^import .*;\n/gm, '').replace('export class', 'class');
const callbacks = new Map(); let id = 0;
const loop = {PRIORITY_DEFAULT_IDLE: 0, SOURCE_REMOVE: false,
    idle_add: (_priority, callback) => { callbacks.set(++id, callback); return id; },
    source_remove: sourceId => callbacks.delete(sourceId)};
const theme = new Actor({scale_factor: 1});
const Material = new Function('GLib', 'St', 'global', source + '\nreturn LockMaterial;')(
    loop, {ThemeContext: {get_for_stage: () => theme}}, {stage: {}});
const shield = new Actor();
const values = {'lock-material': true, 'render-quality': 'eco', 'blur-radius': 36};
const settings = {get_boolean: key => values[key], get_string: key => values[key], get_int: key => values[key]};
let permitted = false;
const material = new Material(shield, settings, () => permitted, () => ({quality: values['render-quality']}));
function makeDialog() {
    const dialog = new Actor({_backgroundGroup: new Actor(), _promptBox: new Actor({visible: false, opacity: 0})});
    dialog._backgroundGroup.children = [new Actor({effect: {radius: 90, brightness: 0.65}})];
    return dialog;
}
const dialog = makeDialog(); shield._dialog = dialog;
permitted = true; material.refresh();
const background = dialog._backgroundGroup.children[0];
assert(background.effect.radius === 0 && background.effect.brightness === 1,
    'Clock uses the unchanged native wallpaper source without blur or dimming');
assert(dialog._promptBox.opacity === 0 && dialog._promptBox.style.includes('rgba(25,28,35,0.70)'),
    'Native prompt animation opacity is preserved while its backing is translucent');
dialog._promptBox.visible = true; dialog._promptBox.emit('notify::visible');
assert(background.effect.radius === 18 && background.effect.brightness === 0.78,
    'Password view reuses the native wallpaper blur with the Eco cap');
material.refresh(); material.refresh();
assert(background.effect.radius === 18 && material._effects.size === 1 && callbacks.size === 0,
    'Repeated refresh does not allocate effects, accumulate styling, or poll');
values['render-quality'] = 'off'; material.refresh();
assert(background.effect.radius === 0, 'Translucency-only mode adds no wallpaper blur');
values['render-quality'] = 'balanced'; material.refresh();
assert(background.effect.radius === 32, 'Balanced quality has its own bounded native blur');
theme.scale_factor = 2; background.effect.radius = 180; background.effect.brightness = 0.65;
theme.emit('notify::scale-factor');
for (const [sourceId, callback] of [...callbacks]) { callbacks.delete(sourceId); callback(); }
assert(background.effect.radius === 64, 'Native resource scale is respected');
const monitor = new Actor({effect: {radius: 180, brightness: 0.65}});
dialog._backgroundGroup.children.push(monitor); dialog._backgroundGroup.emit('child-added', monitor);
for (const [sourceId, callback] of [...callbacks]) { callbacks.delete(sourceId); callback(); }
assert(monitor.effect.radius === 64 && material._effects.size === 2, 'New monitor backgrounds are updated without recreating wallpapers');
const originalEffect = background.effect;
const replacementEffect = {radius: 120, brightness: 0.5};
background.effect = replacementEffect; material.refresh();
assert(originalEffect.radius === 180 && originalEffect.brightness === 0.65 && replacementEffect.radius === 64,
    'A replaced native blur releases and restores the old effect before tracking its replacement');
background.effect = originalEffect; material.refresh();
assert(replacementEffect.radius === 120 && replacementEffect.brightness === 0.5,
    'Replacement blur settings are restored independently of the original native effect');
values['lock-material'] = false; material.refresh();
assert(background.effect.radius === 180 && monitor.effect.radius === 180 && background.effect.brightness === 0.65,
    'Opt-out restores the latest native scale-dependent blur values');
assert(dialog._promptBox.style === null && dialog.signals.size === 0, 'Opt-out restores the prompt and disconnects dialog observers');
values['lock-material'] = true; material.refresh();
dialog._promptBox.set_style('external-style: kept;');
permitted = false; material.refresh();
assert(dialog._promptBox.style === 'external-style: kept;' && background.effect.radius === 180,
    'Accessibility suspension restores blur and preserves later external prompt styling');
shield._dialog = makeDialog(); permitted = true; material.refresh();
shield._dialog.emit('destroy');
assert(material._effects.size === 0 && material._dialog === null, 'Destroyed dialog releases all saved references');
material._queue(); material.destroy();
assert(callbacks.size === 0 && theme.signals.size === 0 && shield.signals.size === 0,
    'Disable cancels idle work and disconnects all lifetime signals');
print('Lock material wallpaper, native blur reuse, prompt opacity, monitor/scale, restoration, and cleanup checks passed');

const [, greeterBytes] = GLib.file_get_contents('integration/login/extension.js');
const greeterSource = new TextDecoder().decode(greeterBytes).replace(/^import .*;\n/gm, '')
    .replace('export default class', 'class');
const contrast = new Actor(); let highContrast = false;
contrast.get_boolean = () => highContrast;
const greeterRoot = new Actor(), greeterShield = {};
const Greeter = new Function('GLib', 'Gio', 'Extension', 'Main', greeterSource + '\nreturn PrismLogin;')(
    loop, {Settings: class {constructor() { return contrast; }}}, class {},
    {layoutManager: {screenShieldGroup: greeterRoot}, screenShield: greeterShield});
const greeter = new Greeter(); greeter.enable();
const authPrompt = new Actor({opacity: 255, reactive: true});
greeterShield._dialog = {_authPrompt: authPrompt};
greeterRoot.children.push(authPrompt); greeterRoot.emit('child-added', authPrompt);
for (const [sourceId, callback] of [...callbacks]) { callbacks.delete(sourceId); callback(); }
assert(authPrompt.style.includes('rgba(25,28,35,0.70)') && authPrompt.opacity === 255 && authPrompt.reactive,
    'GDM companion decorates a late-created prompt without changing opacity or interaction');
highContrast = true; contrast.emit('changed::high-contrast');
assert(authPrompt.style === null, 'GDM high contrast restores the native authentication surface');
highContrast = false; contrast.emit('changed::high-contrast');
assert(authPrompt.style.includes('rgba('), 'GDM material returns after high contrast is disabled');
greeter._queue(); greeter.disable();
assert(authPrompt.style === null && authPrompt.signals.size === 0 && greeterRoot.signals.size === 0 &&
    contrast.signals.size === 0 && callbacks.size === 0, 'GDM companion restores styles and releases every handler/idle');
print('GDM companion prompt, high-contrast, dynamic construction, and cleanup checks passed');
