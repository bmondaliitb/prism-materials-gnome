import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// GDM runs separately from the desktop. This small companion only decorates
// the native prompt; Ubuntu's supported greeter setting supplies the wallpaper.
export default class PrismLogin extends Extension {
    enable() {
        this._watched = new Map();
        this._styles = new Map();
        this._highContrast = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.interface'});
        this._contrastId = this._highContrast.connect('changed::high-contrast', () => this._refresh());
        this._watch(Main.layoutManager.screenShieldGroup);
        this._refresh();
        this._queue();
    }

    _watch(actor) {
        if (this._watched.has(actor)) return;
        this._watched.set(actor, [
            actor.connect('child-added', (_parent, child) => { this._watch(child); this._queue(); }),
            actor.connect('child-removed', (_parent, child) => this._unwatch(child)),
            actor.connect('destroy', () => this._unwatch(actor)),
        ]);
        for (const child of actor.get_children()) this._watch(child);
    }

    _unwatch(actor) {
        for (const child of actor.get_children()) this._unwatch(child);
        this._restore(actor);
        for (const id of this._watched.get(actor) ?? []) actor.disconnect(id);
        this._watched.delete(actor);
    }

    _queue() {
        if (this._source) return;
        this._source = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._source = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        if (this._highContrast.get_boolean('high-contrast')) {
            for (const actor of [...this._styles.keys()]) this._restore(actor);
            return;
        }
        const prompt = Main.screenShield?._dialog?._authPrompt;
        if (!prompt || this._styles.has(prompt)) return;
        const original = prompt.get_style();
        const base = original?.trim() ?? '';
        const applied = `${base}${base && !base.endsWith(';') ? ';' : ''} background-color: rgba(25,28,35,0.70); border-radius: 28px; padding: 24px; border: 1px solid rgba(255,255,255,0.14);`;
        this._styles.set(prompt, {original, applied});
        prompt.set_style(applied);
    }

    _restore(actor) {
        const saved = this._styles.get(actor);
        if (saved && actor.get_style() === saved.applied) actor.set_style(saved.original);
        this._styles.delete(actor);
    }

    disable() {
        if (this._source) GLib.source_remove(this._source);
        this._source = 0;
        this._highContrast.disconnect(this._contrastId);
        for (const actor of [...this._watched.keys()]) this._unwatch(actor);
        for (const actor of [...this._styles.keys()]) this._restore(actor);
        this._highContrast = null;
    }
}
