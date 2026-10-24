import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {eligible, materialStyle} from './materials.js';

import {VisualBackdrop} from './backdrop.js';
import {BackdropRefreshEffect} from './backdropRefreshEffect.js';
import {RedrawGuard} from './redrawGuard.js';
import {clientSurfaceRoot} from './windowSurface.js';
import {FrostEffect} from './frostEffect.js';
import {GtkMenuStyle, gtkMenuCss} from './gtkMenus.js';
import {ShellSurfaces} from './shellSurfaces.js';
import {Experience} from './experience.js';
import {OverviewMaterial} from './overviewMaterial.js';
import {LockMaterial} from './lockMaterial.js';

export default class Prism extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._connections = [];
        this._windows = new Map();
        this._workspaceMotion = false;
        this._redrawGuard = new RedrawGuard(() => global.stage.queue_redraw());
        this._redrawGuard.setEnabled(this._settings.get_boolean('stable-redraws'));
        this._tracker = Shell.WindowTracker.get_default();
        this._gtkMenus = new GtkMenuStyle();
        this._gtkCss = undefined;
        this._button = new PanelMenu.Button(0.0, 'Prism Materials');
        this._button.add_child(new St.Icon({icon_name: 'weather-fog-symbolic', style_class: 'system-status-icon'}));
        this._toggle = new PopupMenu.PopupSwitchMenuItem('Window materials', this._settings.get_boolean('enabled'));
        this._toggle.connect('toggled', (_item, state) => this._settings.set_boolean('enabled', state));
        this._button.menu.addMenuItem(this._toggle);
        this._button.menu.addAction('Toggle for focused app', () => this._toggleApp());
        this._button.menu.addAction('Material settings', async () => {
            if (Main.sessionMode.isLocked) return;
            try { await this.openPreferences(); }
            catch (error) { console.error('Prism: could not open preferences', error); }
        });
        Main.panel.addToStatusArea(this.uuid, this._button);
        this._connect(this._settings, 'changed', () => {
            this._toggle.setToggleState(this._settings.get_boolean('enabled'));
            this._syncGtkMenus();
            this._refresh();
        });
        this._connect(this._interface, 'changed::color-scheme', () => { this._syncGtkMenus(); this._refresh(); });
        this._connect(global.display, 'notify::focus-window', () => this._refresh(false));
        this._connect(global.window_manager, 'map', (_wm, actor) => this._watch(actor));
        this._connect(Main.overview, 'showing', () => this._refresh());
        this._connect(Main.overview, 'hidden', () => this._refresh());
        this._connect(Main.sessionMode, 'updated', () => this._refresh());
        this._connect(global.stage, 'before-paint', () => {
            if (this._syncWorkspaceMotion() && !this._workspaceMotion) this._refresh();
        });
        this._experience = new Experience(this._settings, this._interface, () => {
            this._syncGtkMenus();
            this._refresh();
        });
        this._shellSurfaces = new ShellSurfaces(Main.uiGroup, Main.panel, this._settings,
            () => this._dark(), () => this._settings.get_boolean('enabled') &&
                !this._reduced() && !Main.sessionMode.isLocked,
            this._redrawGuard, () => this._context());
        this._overviewMaterial = new OverviewMaterial(Main.layoutManager, this._settings,
            () => this._settings.get_boolean('enabled') && !this._reduced() && !Main.sessionMode.isLocked,
            () => this._context());
        this._lockMaterial = new LockMaterial(Main.screenShield, this._settings,
            () => this._settings.get_boolean('enabled') && !this._reduced() && Main.sessionMode.isLocked,
            () => this._context());
        this._button.visible = !Main.sessionMode.isLocked;
        for (const actor of global.get_window_actors())
            this._watch(actor);
        this._syncGtkMenus();
    }

    _connect(object, signal, handler) {
        this._connections.push([object, object.connect(signal, handler)]);
    }

    _toggleApp() {
        const window = global.display.focus_window;
        const id = window && this._tracker.get_window_app(window)?.get_id();
        if (!id) return;
        const apps = this._settings.get_strv('applications');
        this._settings.set_strv('applications', apps.includes(id) ? apps.filter(app => app !== id) : [...apps, id]);
    }

    _watch(actor) {
        if (this._windows.has(actor)) return;
        const window = actor.meta_window;
        if (!window) return;
        const state = {actor, window, layer: null, surface: null, opacity: null,
            refreshEffect: null, signals: []};
        this._windows.set(actor, state);
        for (const signal of ['size-changed', 'position-changed', 'notify::fullscreen', 'notify::minimized'])
            state.signals.push([window, window.connect(signal, () => this._update(actor, state))]);
        state.signals.push([actor, actor.connect('destroy', () => {
            this._clear(state);
            for (const [object, id] of state.signals) object.disconnect(id);
            this._windows.delete(actor);
        })]);
        this._update(actor, state);
    }

    _dark() {
        const appearance = this._settings.get_string('appearance');
        return appearance === 'dark' || (appearance === 'auto' && this._interface.get_string('color-scheme') === 'prefer-dark');
    }

    _context() {
        const state = this._experience?.state ?? {};
        const automatic = this._settings.get_boolean('auto-comfort');
        const quality = this._settings.get_string('render-quality') ?? 'eco';
        return {...state, lowPower: automatic && state.lowPower,
            quality: automatic && state.lowPower && quality !== 'off' ? 'eco' : quality};
    }

    _reduced() {
        return this._settings.get_boolean('reduce-transparency') ||
            (this._settings.get_boolean('auto-comfort') && this._experience?.state.highContrast);
    }

    _syncGtkMenus(disabling = false) {
        try {
            const active = !disabling && this._settings.get_boolean('gtk-menus') &&
                this._settings.get_boolean('enabled') && !this._reduced();
            const css = active ? gtkMenuCss(this._dark(), this._settings.get_int('shell-opacity')) : null;
            if (!disabling && this._gtkCss === css) return;
            this._gtkMenus?.apply(css);
            this._gtkCss = css;
        } catch (error) {
            console.error('Prism: GTK menu styling could not be updated', error);
        }
    }

    _refresh(shell = true) {
        if (this._button) {
            this._button.visible = !Main.sessionMode.isLocked;
            if (Main.sessionMode.isLocked) this._button.menu.close();
        }
        this._syncWorkspaceMotion();
        this._redrawGuard?.setEnabled(this._settings.get_boolean('stable-redraws'));
        if (shell) this._shellSurfaces?.refresh();
        this._overviewMaterial?.refresh();
        this._lockMaterial?.refresh();
        for (const [actor, state] of this._windows) this._update(actor, state);
    }

    _syncWorkspaceMotion() {
        // GNOME 50 uses this controller for keyboard switches and touchpad
        // gestures, including cancellation. Observe it without wrapping methods.
        const active = Boolean(this._settings.get_boolean('smooth-workspaces') &&
            Main.wm?._workspaceAnimation?._switchData);
        if (Boolean(this._workspaceMotion) === active) return false;
        this._workspaceMotion = active;
        FrostEffect.setWorkspaceMotion(active);
        this._redrawGuard?.setSuspended(active);
        this._shellSurfaces?.setMotionPaused(active);
        return true;
    }

    _update(actor, state) {
        state.actor ??= actor;
        // Focus/geometry notifications during a slide must not tear down and
        // rebuild materials on the source windows used by animation clones.
        if (this._workspaceMotion && this._settings.get_boolean('enabled') && !this._reduced()) return;
        const s = this._settings;
        const w = state.window;
        const app = this._tracker.get_window_app(w)?.get_id();
        const type = w.get_window_type();
        const isPopup = [Meta.WindowType.MENU, Meta.WindowType.DROPDOWN_MENU, Meta.WindowType.POPUP_MENU,
            Meta.WindowType.TOOLTIP, Meta.WindowType.COMBO].includes(type);
        const isDialog = [Meta.WindowType.DIALOG, Meta.WindowType.MODAL_DIALOG,
            Meta.WindowType.UTILITY, Meta.WindowType.TOOLBAR].includes(type);
        const parent = w.get_transient_for?.();
        const ownerApp = app ?? (parent && this._tracker.get_window_app(parent)?.get_id());
        const sidebarMode = !isPopup && s.get_boolean('sidebar-materials');
        const context = this._context();
        const focused = global.display.focus_window === w || global.display.focus_window === parent;
        const active = s.get_boolean('enabled') && !this._reduced() &&
            !Main.overview.visible && !Main.sessionMode.isLocked && eligible({
                normal: type === Meta.WindowType.NORMAL || (isPopup && s.get_boolean('window-popups')) ||
                    (isDialog && s.get_boolean('window-dialogs')),
                fullscreen: w.is_fullscreen(), minimized: w.minimized,
                focused,
                focusOnly: s.get_boolean('focused-only') || context.lowPower,
                app: ownerApp,
                allApplications: s.get_boolean('all-applications'),
                applications: s.get_strv('applications'),
            });
        if (!active) { this._clear(state); return; }
        if (!state.surface) {
            state.surface = clientSurfaceRoot(actor.get_children(), child =>
                GObject.type_name_from_instance(child));
            if (!state.surface) return;
            state.opacity = state.surface.opacity;
        }
        const roundedFrost = s.get_boolean('preserve-corners') && s.get_boolean('rounded-frost');
        const quality = context.quality;
        const mode = quality === 'off' ? 'none' : 'frost';
        if (state.layer && state.effectMode !== mode) { state.layer.destroy(); state.layer = null; state.effect = null; }
        if (isPopup || (s.get_boolean('preserve-corners') && !roundedFrost)) {
            // Popup frost is attached to the client surface below; never put
            // a second frame-sized plate behind native arrows and margins.
            // Meta.WindowActor doesn't expose the client's alpha silhouette.
            // Keep native client corners instead of inserting a square backdrop.
            state.layer?.destroy();
            state.layer = null;
            state.effect = null;
        } else {
            if (!state.layer) {
                state.layer = new VisualBackdrop({reactive: false, can_focus: false, track_hover: false, clip_to_allocation: roundedFrost});
                state.effect = mode === 'none' ? null : new FrostEffect();
                state.effectMode = mode;
                state.layerStyle = null;
                state.paintKey = null;
                if (state.effect) state.layer.add_effect(state.effect);
                actor.insert_child_at_index(state.layer, 0);
            }
            const frame = w.get_frame_rect();
            const buffer = w.get_buffer_rect();
            state.layer.set_position(frame.x - buffer.x, frame.y - buffer.y);
            state.layer.set_size(frame.width, frame.height);
            const dark = this._dark();
            const radius = Math.max(0, Math.min(48, s.get_int('window-radius')));
            if (state.effect) {
                state.effect.radii = roundedFrost ? [radius, radius, radius, radius] : [0, 0, 0, 0];
                state.effect.quality = quality;
                state.effect.maxFps = s.get_int('backdrop-fps') ?? 30;
            }
            const style = materialStyle(s.get_string('preset'), dark, {
                focused, emphasis: s.get_boolean('focus-emphasis') && !isPopup && !isDialog,
                edges: s.get_boolean('glass-edges'),
                transitions: s.get_boolean('gentle-transitions') && context.animations !== false && !context.lowPower,
            }) + (roundedFrost ? ` border-radius: ${radius}px;` : '');
            if (state.layerStyle !== style) { state.layer.set_style(style); state.layerStyle = style; }
            if (state.effect) {
                state.effect.radius = Math.max(0, Math.min(80, s.get_int('blur-radius')));
                state.effect.brightness = dark ? 0.85 : 1.0;
                state.effect.veil = [...(dark ? [0.10, 0.11, 0.14] : [0.94, 0.95, 0.97]),
                    Math.max(0, Math.min(80, s.get_int('background-detail') ?? 25)) / 100];
            }
            const paintKey = JSON.stringify([style, state.effect?.radius,
                state.effect?.brightness, state.effect?.radii, state.effect?.veil, quality]);
            if (state.paintKey !== paintKey) {
                state.paintKey = paintKey;
                state.layer.queue_redraw?.();
            }
        }
        const popupFrost = isPopup && quality !== 'off' &&
            (!s.get_boolean('preserve-corners') || roundedFrost);
        if (state.popupEffect && !popupFrost) {
            state.surface.remove_effect(state.popupEffect);
            state.popupEffect = null;
            state.popupPaintKey = null;
        }
        if (popupFrost) {
            if (!state.popupEffect) {
                state.popupEffect = new FrostEffect();
                state.popupEffect.nativeShape = true;
                state.surface.add_effect(state.popupEffect);
            }
            const dark = this._dark();
            state.popupEffect.quality = quality;
            state.popupEffect.maxFps = s.get_int('backdrop-fps') ?? 30;
            state.popupEffect.radius = Math.max(0, Math.min(80, s.get_int('blur-radius')));
            state.popupEffect.clientTintOpacity = Math.max(75, Math.min(100, s.get_int('popup-opacity'))) / 100;
            state.popupEffect.brightness = dark ? 0.85 : 1;
            state.popupEffect.veil = [...(dark ? [0.10, 0.11, 0.14] : [0.94, 0.95, 0.97]),
                Math.max(0, Math.min(80, s.get_int('background-detail') ?? 25)) / 100];
            const key = JSON.stringify([quality, state.popupEffect.radius,
                state.popupEffect.brightness, state.popupEffect.veil, state.popupEffect.clientTintOpacity]);
            if (key !== state.popupPaintKey) {
                state.popupPaintKey = key;
                state.surface.queue_redraw?.();
            }
        }
        const hasFrost = Boolean(state.effect || state.popupEffect);
        // The frost layer is a child of MetaWindowActor. Without an effect on
        // the window actor itself, Mutter can cull/clip the windows below it and
        // our full-rectangle capture can contain stale damage tiles.
        if (hasFrost && !state.refreshEffect) {
            state.refreshEffect = new BackdropRefreshEffect();
            actor.add_effect(state.refreshEffect);
        } else if (!hasFrost && state.refreshEffect) {
            actor.remove_effect(state.refreshEffect);
            state.refreshEffect = null;
        }
        this._redrawGuard?.track(state.layer ?? state.surface, hasFrost);
        let opacity = Math.max(75, Math.min(100, s.get_int(isPopup ? 'popup-opacity' : 'translucency')));
        if (s.get_boolean('material-hierarchy') && isDialog) opacity = Math.max(96, opacity);
        // Native popup frost composites the translucent fill against the blur.
        // Fading the entire client afterwards leaks sharp background text back
        // through it. In this mode opacity controls the native fill in GLSL.
        state.surface.opacity = popupFrost ? state.opacity : !sidebarMode && (isPopup || s.get_boolean('force-translucency'))
            ? Math.round(state.opacity * opacity / 100)
            : state.opacity;
    }

    _clear(state) {
        if (state.layer) this._redrawGuard?.untrack(state.layer);
        if (state.surface) this._redrawGuard?.untrack(state.surface);
        if (state.popupEffect) state.surface?.remove_effect(state.popupEffect);
        state.popupEffect = null;
        state.popupPaintKey = null;
        if (state.surface) state.surface.opacity = state.opacity;
        if (state.refreshEffect) state.actor.remove_effect(state.refreshEffect);
        state.refreshEffect = null;
        state.layer?.destroy();
        state.layer = null;
        state.surface = null;
        state.effect = null;
    }

    disable() {
        FrostEffect.setWorkspaceMotion(false);
        FrostEffect.cancelPendingRefresh();
        this._experience?.destroy();
        this._experience = null;
        this._syncGtkMenus(true);
        this._gtkMenus = null;
        this._overviewMaterial?.destroy();
        this._overviewMaterial = null;
        this._lockMaterial?.destroy();
        this._lockMaterial = null;
        this._shellSurfaces?.destroy();
        this._shellSurfaces = null;
        for (const [object, id] of this._connections) object.disconnect(id);
        for (const state of this._windows.values()) {
            this._clear(state);
            for (const [object, id] of state.signals) object.disconnect(id);
        }
        this._windows.clear();
        this._redrawGuard?.destroy();
        this._redrawGuard = null;
        this._button.destroy();
        this._button = null;
        this._settings = null;
        this._interface = null;
        this._tracker = null;
        this._windows = null;
        this._connections = null;
    }
}
