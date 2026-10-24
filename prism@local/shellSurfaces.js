import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {FrostEffect} from './frostEffect.js';
import {shellSurfaceKind, shellSurfaceRole} from './materials.js';
import {surfaceOpacity, panelIsDark} from './experience.js';

// Event-driven discovery also covers menus/docks created after Prism is enabled.
export class ShellSurfaces {
    constructor(root, panel, settings, isDark, permitted, redrawGuard = null, context = () => ({})) {
        this._context = context;
        this._redrawGuard = redrawGuard;
        this._settings = settings;
        this._panel = panel;
        this._isDark = isDark;
        this._permitted = permitted;
        this._watched = new Map();
        this._applied = new Map();
        this._parents = new Map();
        this._destroying = false;
        this._source = 0;
        this._watch(root);
        this._watch(panel);
        this.refresh();
    }

    _watch(actor, parent = null) {
        if (this._watched.has(actor)) return;
        const ids = [];
        this._watched.set(actor, ids);
        this._parents.set(actor, parent);
        ids.push(actor.connect('child-added', (_actor, child) => {
            this._watch(child, actor);
            this._queue();
        }));
        ids.push(actor.connect('child-removed', (_actor, child) => {
            this._unwatch(child);
            this._queue();
        }));
        ids.push(actor.connect('destroy', () => this._forget(actor)));
        // Non-St actors have no theme/style properties.
        if (typeof actor.get_style_class_name === 'function') {
            ids.push(actor.connect('notify::style-class', () => this._queue()));
            ids.push(actor.connect('notify::name', () => this._queue()));
            const changed = () => {
                // Hovering a label/row must not rescan the entire Shell tree.
                // Our own writes already have the intended state applied.
                if (this._settingStyle) return;
                const classes = actor.get_style_class_name?.() ?? '';
                if (actor === this._panel || this._applied.has(actor) ||
                    shellSurfaceKind(classes) || shellSurfaceRole(classes)) this._queue();
            };
            ids.push(actor.connect('notify::style', changed));
            ids.push(actor.connect('style-changed', changed));
        }
        for (const child of actor.get_children()) this._watch(child, actor);
    }

    _queue() {
        if (this._destroying || this._source) return;
        this._source = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._source = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _restore(actor) {
        const saved = this._applied.get(actor);
        if (!saved) return;
        this._redrawGuard?.untrack(actor);
        if (saved.effect) actor.remove_effect(saved.effect);
        // Preserve an external extension's later inline change, if there is one.
        if (actor.get_style() === saved.appliedStyle) actor.set_style(saved.style);
        this._applied.delete(actor);
        actor._border?.queue_repaint?.();
    }

    _forget(actor) {
        this._restore(actor);
        for (const id of this._watched.get(actor) ?? []) actor.disconnect(id);
        this._watched.delete(actor);
        this._parents.delete(actor);
    }

    _unwatch(actor) {
        for (const child of actor.get_children()) this._unwatch(child);
        this._forget(actor);
    }

    _hasMenuSurface(actor) {
        for (const child of actor.get_children()) {
            const classes = child.get_style_class_name?.() ?? '';
            if (shellSurfaceKind(classes) === 'menus' && shellSurfaceRole(classes) === 'surface') return true;
            if (this._hasMenuSurface(child)) return true;
        }
        return false;
    }

    _describe(actor) {
        if (actor === this._panel) return {kind: 'panel', role: 'surface'};
        const classes = actor.get_style_class_name?.() ?? '';
        const role = shellSurfaceRole(classes);
        const kind = shellSurfaceKind(classes);
        if (role === 'pointer') return {kind, role: this._hasMenuSurface(actor) ? 'pointer' : 'pointer-fill'};
        if (kind) return {kind, role};
        // Color actual text/icons only. Workspace dots and layout/drawing
        // widgets rely on their native theme geometry and must stay untouched.
        for (let parent = this._parents.get(actor); parent; parent = this._parents.get(parent)) {
            if (parent === this._panel) return actor instanceof St.Label || actor instanceof St.Icon
                ? {kind: 'panel', role: 'foreground'} : {kind: null, role: null};
            if (shellSurfaceKind(parent.get_style_class_name?.() ?? '')) break;
        }
        if (role === 'inset') {
            // Only clear cards inside a menu/banner; never globally flatten UI cards.
            for (let parent = this._parents.get(actor); parent; parent = this._parents.get(parent)) {
                const owner = shellSurfaceKind(parent.get_style_class_name?.() ?? '');
                if (owner === 'menus' || owner === 'notifications') return {kind: owner, role};
            }
        }
        return {kind: null, role: null};
    }

    _radii(actor, kind) {
        // St reports the theme's actual per-corner radii. If shape is unknown,
        // prefer no blur to painting a rectangle outside a rounded surface.
        if (typeof actor.get_theme_node !== 'function') return kind === 'panel' ? [0, 0, 0, 0] : null;
        if (actor.get_stage && !actor.get_stage()) return null;
        try {
            const node = actor.get_theme_node();
            return [0, 1, 2, 3].map(corner => Math.max(0, node.get_border_radius(corner)));
        } catch {
            return null;
        }
    }

    refresh() {
        const active = this._permitted();
        const dark = this._isDark();
        const context = this._context();
        const tint = dark ? '24,27,36' : '240,244,252';
        const alpha = Math.max(40, Math.min(100, this._settings.get_int('shell-opacity'))) / 100;
        const panelAlpha = Math.max(0, Math.min(100, this._settings.get_int('panel-opacity'))) / 100;
        const panelTint = dark ? '32,34,38' : '218,222,228';
        const panelDark = this._settings.get_boolean('wallpaper-panel')
            ? panelIsDark(dark, panelAlpha, context.luminance) : dark;
        const panelForeground = panelDark ? '246,247,249' : '16,20,26';
        for (const actor of this._watched.keys()) {
            if (typeof actor.get_style !== 'function') continue;
            const {kind, role} = this._describe(actor);
            if (!active || !kind || !this._settings.get_boolean(`shell-${kind}`)) {
                this._restore(actor);
                continue;
            }
            let saved = this._applied.get(actor);
            if (saved && saved.role !== role) { this._restore(actor); saved = null; }
            if (!saved) {
                saved = {style: actor.get_style(), role, effect: null, type: null};
                this._applied.set(actor, saved);
            } else if (actor.get_style() !== saved.appliedStyle) {
                saved.style = actor.get_style();
            }
            const radii = role === 'surface' ? this._radii(actor, kind) : null;
            const safe = this._settings.get_boolean('preserve-corners');
            const rounded = radii?.some(radius => radius > 0);
            const quality = context.quality ?? this._settings.get_string('render-quality') ?? 'eco';
            const type = role !== 'surface' || quality === 'off' ? null
                : kind === 'panel' ? ((!safe || (radii && !rounded)) ? 'native-panel' : null)
                : (safe && rounded && this._settings.get_boolean('rounded-frost')) ? 'frost'
                : (!safe || (radii && !rounded)) ? 'frost' : null;
            if (saved.type !== type) {
                if (saved.effect) actor.remove_effect(saved.effect);
                saved.effect = type === 'frost' ? new FrostEffect()
                    : type === 'native-panel' ? new Shell.BlurEffect({mode: Shell.BlurMode.BACKGROUND}) : null;
                saved.type = type;
                saved.paintKey = null;
                if (saved.effect) actor.add_effect(saved.effect);
            }
            if (type === 'frost') {
                saved.effect.radii = safe ? radii : [0, 0, 0, 0];
                saved.effect.quality = quality;
            }
            if (saved.effect) {
                const limit = type === 'native-panel' ? (quality === 'eco' ? 18 : quality === 'balanced' ? 32 : 80) : 80;
                saved.effect.radius = Math.max(0, Math.min(limit, this._settings.get_int('blur-radius')));
                saved.effect.brightness = kind === 'panel' ? 1 : (dark ? 0.85 : 1);
                const paintKey = JSON.stringify([saved.effect.radius, saved.effect.brightness,
                    saved.effect.radii, quality]);
                // A hover/theme notification may reach refresh without changing
                // the material. It must not invalidate every other backdrop.
                if (saved.paintKey !== paintKey) {
                    saved.paintKey = paintKey;
                    actor.queue_redraw?.();
                }
            }
            this._redrawGuard?.track(actor, Boolean(saved.effect));
            // Theme !important rules (notably Yaru #panel) otherwise keep opaque paint.
            // BoxPointer paints its own Cairo background beneath popup-menu-content.
            const materialAlpha = surfaceOpacity(kind, alpha, this._settings.get_boolean('material-hierarchy'));
            const background = role === 'surface'
                ? (kind === 'panel' ? `rgba(${panelTint},${panelAlpha})` : `rgba(${tint},${materialAlpha})`) : 'transparent';
            const pointer = role === 'pointer' ? '-arrow-background-color: transparent !important;'
                : role === 'pointer-fill' ? `-arrow-background-color: rgba(${tint},${materialAlpha}) !important;` : '';
            const base = saved.style?.trim() ?? '';
            const foreground = role === 'foreground' ? `color: rgb(${panelForeground}) !important;` : '';
            const fill = role === 'foreground' ? ''
                : `background-image: none !important; background-color: ${background} !important; ${pointer}`;
            const edge = role === 'surface' && kind !== 'panel' && this._settings.get_boolean('glass-edges')
                ? `border: 1px solid rgba(${dark ? '255,255,255,0.18' : '255,255,255,0.5'});` : '';
            const transition = role === 'surface' ? `transition-duration: ${this._settings.get_boolean('gentle-transitions') && context.animations !== false && !context.lowPower ? 140 : 0}ms;` : '';
            saved.appliedStyle = `${base}${base && !base.endsWith(';') ? ';' : ''} ${fill} ${foreground} ${edge} ${transition}`;
            if (actor.get_style() !== saved.appliedStyle) {
                this._settingStyle = true;
                try { actor.set_style(saved.appliedStyle); }
                finally { this._settingStyle = false; }
                actor._border?.queue_repaint?.();
            }
        }
    }

    destroy() {
        this._destroying = true;
        if (this._source) GLib.source_remove(this._source);
        for (const actor of [...this._watched.keys()]) this._forget(actor);
        this._settings = null;
        this._panel = null;
        this._isDark = null;
        this._permitted = null;
        this._context = null;
    }
}
