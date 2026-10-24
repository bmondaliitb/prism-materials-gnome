import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {PRESETS} from './materials.js';

export default class PrismPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(680, 760);
        const page = new Adw.PreferencesPage({title: 'Prism', icon_name: 'weather-fog-symbolic'});
        window.add(page);
        const intro = new Adw.PreferencesGroup({title: 'A softer kind of desktop', description: 'Layered materials, quiet edges, and just enough of the world behind your windows.'});
        page.add(intro);
        const enabled = new Adw.SwitchRow({title: 'Window materials'});
        settings.bind('enabled', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        intro.add(enabled);
        const status = new Adw.ActionRow({title: 'No applications selected', subtitle: 'Add an application below to make materials visible.'});
        intro.add(status);
        const group = new Adw.PreferencesGroup({title: 'Material', description: 'Blur appears through transparent app backgrounds. Opaque apps need whole-window translucency.'});
        page.add(group);
        const combo = (title, key, values, labels) => {
            const row = new Adw.ComboRow({title, model: Gtk.StringList.new(labels)});
            const sync = () => row.selected = Math.max(0, values.indexOf(settings.get_string(key)));
            sync();
            row.connect('notify::selected', () => {
                settings.set_string(key, values[row.selected]);
                if (key === 'preset') settings.set_int('blur-radius', PRESETS[values[row.selected]].radius);
            });
            const id = settings.connect(`changed::${key}`, sync);
            window.connect('close-request', () => { settings.disconnect(id); return false; });
            group.add(row);
        };
        combo('Material finish', 'preset', ['clear', 'frosted', 'soft'], ['Clear · a little atmosphere', 'Frosted · everyday balance', 'Soft · stronger separation']);
        combo('Rendering level', 'render-quality', ['eco', 'balanced', 'high', 'off'],
            ['Eco · integrated GPU (default)', 'Balanced · smoother frost', 'High · finer detail', 'Translucency only · no blur']);
        group.add(new Adw.ActionRow({title: 'Rendering cost', subtitle: 'Eco uses smaller blur textures and fewer samples for windows and Shell surfaces. Translucency only removes blur and backdrop capture. GTK app menus keep their CSS styling.'}));
        combo('Appearance', 'appearance', ['auto', 'light', 'dark'], ['Follow desktop', 'Light', 'Dark']);
        for (const [title, key, min, max, subtitle] of [
            ['Blur radius', 'blur-radius', 0, 80, 'Higher values soften more background detail'],
            ['Background detail reduction', 'background-detail', 0, 80, '25% reduces distracting text and patterns behind rounded frost. Higher values give a quieter background. Foreground text stays unchanged; the native top bar is unaffected.'],
            ['Backdrop refresh limit', 'backdrop-fps', 0, 60, '30 fps reduces capture work on stationary frost. Foreground stays at normal frame rate; movement and resizing refresh immediately. 0 is unlimited. Native top-bar blur is unaffected.'],
            ['Application backdrop corner radius', 'window-radius', 0, 48, 'Matches the blur backdrop to client corners; 12 px is a starting value, not automatic shape detection.'],
            ['Window opacity', 'translucency', 75, 100, '92% recommended; only used with whole-window translucency'],
        ]) {
            const row = new Adw.SpinRow({title, subtitle, adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: 1, page_increment: 5})});
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }
        const behavior = new Adw.PreferencesGroup({title: 'Comfort and behavior'});
        page.add(behavior);
        const performance = new Adw.ActionRow({title: '4K / integrated GPU preset',
            subtitle: 'Eco, 30 fps backdrop limit, focused app only, no tint animations, and a translucent top bar without blur. Keeps stable redraw protection.'});
        const applyPerformance = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
        applyPerformance.connect('clicked', () => {
            settings.set_string('render-quality', 'eco');
            settings.set_int('backdrop-fps', 30);
            settings.set_boolean('focused-only', true);
            settings.set_boolean('gentle-transitions', false);
            settings.set_boolean('panel-blur', false);
        });
        performance.add_suffix(applyPerformance);
        behavior.add(performance);
        for (const [title, subtitle, key] of [
            ['Material hierarchy', 'Airier dock, stronger dialogs and notifications. Whole-window dialogs stay at least 96% opaque.', 'material-hierarchy'],
            ['Active-window emphasis', 'Clearer backdrop edges on the focused app, quieter tint on inactive apps. Most visible when Focused window only is off.', 'focus-emphasis'],
            ['Glass edge highlights', 'Fine highlights on application backdrops and Shell menus, without extra blur passes.', 'glass-edges'],
            ['Gentle tint transitions', '140 ms native color transitions. Respects GNOME animations and is suspended on battery or power saver with Automatic comfort enabled.', 'gentle-transitions'],
            ['Automatic comfort', 'Restore native styling in system high contrast. Use Eco and focused app backdrops only on battery or power saver, without changing saved preferences.', 'auto-comfort'],
            ['Wallpaper-aware panel colors', 'Estimate clock and icon contrast from the wallpaper’s top band when it changes. Uses the primary wallpaper, not windows behind the panel; unsupported images fall back to appearance colors.', 'wallpaper-panel'],
            ['Stable backdrop redraws', 'Prevents partial-redraw patches while frosted surfaces are visible. Repaints full monitor frames on updates, which can use more GPU power. No continuous repainting.', 'stable-redraws'],
            ['Smooth workspace transitions', 'Reuse existing frost during workspace slides and pause top-bar blur until they finish. Restores live effects afterward; no change to saved rendering quality.', 'smooth-workspaces'],
            ['Preserve native rounded corners', 'Keeps material inside rounded boundaries. Disable Rounded frosted glass below to fall back to clear translucency.', 'preserve-corners'],
            ['Rounded frosted glass', 'GPU blur for rounded Shell surfaces and app backdrops. Separate app popups use their native alpha shape; embedded popovers cannot be targeted independently. Capture failures fall back to translucency.', 'rounded-frost'],
            ['Sidebar-only materials', 'Keeps every selected app at full opacity. The Prism launcher detects supported GTK4 sidebars; unknown layouts stay unchanged.', 'sidebar-materials'],
            ['Whole-window translucency', 'For opaque apps. Also fades text, images, and controls.', 'force-translucency'],
            ['Focused window only', 'Keeps background windows solid and reduces GPU work.', 'focused-only'],
            ['Reduce transparency', 'Suspends all materials and restores original window opacity.', 'reduce-transparency'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            behavior.add(row);
        }
        const surfaces = new Adw.PreferencesGroup({title: 'Windows and desktop surfaces',
            description: 'Shell controls keep their text opaque. App-window and app-popup opacity also fades their content. Disable Sidebar-only materials to fade whole application windows.'});
        page.add(surfaces);
        const everywhere = new Adw.ActionRow({title: 'Translucency everywhere',
            subtitle: 'Enable all categories and whole-window fading, including app text. Reduce transparency still takes precedence.'});
        const applyEverywhere = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
        applyEverywhere.connect('clicked', () => {
            for (const key of ['enabled', 'all-applications', 'force-translucency', 'window-dialogs',
                'window-popups', 'shell-menus', 'shell-panel', 'shell-dock', 'shell-dialogs', 'shell-notifications', 'gtk-menus', 'overview-material'])
                settings.set_boolean(key, true);
            settings.set_boolean('sidebar-materials', false);
            settings.set_boolean('focused-only', false);
        });
        everywhere.add_suffix(applyEverywhere);
        surfaces.add(everywhere);
        for (const [title, subtitle, key] of [
            ['All applications', 'Apply to every eligible app, including apps outside the selection list.', 'all-applications'],
            ['Application dialogs and utility windows', 'Include compositor-managed dialogs, toolbars, and utility windows.', 'window-dialogs'],
            ['Application menus and popups', 'Include separate compositor-managed right-click menus, dropdowns, and tooltips. Embedded Wayland popovers cannot be targeted separately.', 'window-popups'],
            ['Match GTK4 app menus', 'Adds a self-contained managed block to your user GTK4 stylesheet so item menus match Shell menus. Restart GTK4 apps after changing this or the palette/opacity. Does not affect GTK3, Qt, Electron, or sandboxed apps without config access.', 'gtk-menus'],
            ['Shell menus and popups', 'Right-click menus, panel menus, calendar, and Quick Settings using standard Shell menu backgrounds.', 'shell-menus'],
            ['Top bar', 'GNOME panel background; labels and indicators remain opaque.', 'shell-panel'],
            ['Top bar blur', 'Turn off to keep its neutral translucency without a permanently active background blur. Useful on 4K displays.', 'panel-blur'],
            ['Overview material', 'Shows wallpaper through a translucent veil and search-result boxes when pressing Meta. Text, icons, and window previews stay crisp.', 'overview-material'],
            ['Overview wallpaper blur', 'Cached blur of the wallpaper only, avoiding live desktop capture. Respects rendering quality and Translucency only.', 'overview-blur'],
            ['Dash and dock', 'Standard dash backgrounds, including Ubuntu Dock and Dash to Dock when they use the standard class.', 'shell-dock'],
            ['Notification banners and tray', 'Notification banner backgrounds and their nested message cards.', 'shell-notifications'],
            ['Shell dialogs', 'Standard GNOME modal dialog backgrounds.', 'shell-dialogs'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            surfaces.add(row);
        }
        for (const [title, key, min, subtitle] of [
            ['Overview background opacity', 'overview-opacity', 0, '35% recommended. Controls the dark neutral veil over the wallpaper; lower values reveal more wallpaper.'],
            ['Top bar background opacity', 'panel-opacity', 0, '25% blends with the background. 0% removes the tint while keeping enabled blur. Clock text and symbolic icons use contrasting foreground colors.'],
            ['Shell background opacity', 'shell-opacity', 40, 'Applies to enabled menu, dock, notification, and dialog backgrounds. The top bar has its own control.'],
            ['Application popup opacity', 'popup-opacity', 75, 'Separate app popups only. With frost, adjusts translucent fills while preserving opaque labels; without frost, fades the whole popup including text.'],
        ]) {
            const row = new Adw.SpinRow({title, subtitle,
                adjustment: new Gtk.Adjustment({lower: min, upper: 100, step_increment: 1, page_increment: 5})});
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            surfaces.add(row);
        }
        const apps = new Adw.PreferencesGroup({title: 'Applications', description: 'Opt in from the Prism panel menu, or enter desktop IDs separated by commas. The list is used when All applications is off.'});
        page.add(apps);
        const entry = new Adw.EntryRow({title: 'Desktop IDs', text: settings.get_strv('applications').join(', '), show_apply_button: true});
        entry.connect('apply', () => settings.set_strv('applications', [...new Set(entry.text.split(',').map(x => x.trim()).filter(Boolean))]));
        const updateStatus = () => {
            const selected = settings.get_strv('applications');
            entry.text = selected.join(', ');
            status.title = settings.get_boolean('all-applications') ? 'All applications enabled' : selected.length ? `${selected.length} application(s) selected` : 'No applications selected';
            status.subtitle = (selected.length || settings.get_boolean('all-applications')) && settings.get_boolean('sidebar-materials')
                ? 'Use the Prism launcher for automatic GTK4 sidebar detection. Content stays opaque.'
                : (selected.length || settings.get_boolean('all-applications'))
                ? (settings.get_boolean('force-translucency') ? 'Whole-window translucency is on. Focus a selected app to see the effect.' : 'Opaque apps hide the blur. Use the Prism app launcher in sidebar mode.')
                : 'Add an application below to make materials visible.';
        };
        updateStatus();
        const scopeSignal = settings.connect('changed::all-applications', updateStatus);
        window.connect('close-request', () => { settings.disconnect(scopeSignal); return false; });
        const appSignal = settings.connect('changed::applications', updateStatus);
        const sidebarSignal = settings.connect('changed::sidebar-materials', updateStatus);
        window.connect('close-request', () => { settings.disconnect(sidebarSignal); return false; });
        const opacitySignal = settings.connect('changed::force-translucency', updateStatus);
        window.connect('close-request', () => { settings.disconnect(opacitySignal); return false; });
        const installed = Gio.AppInfo.get_all().filter(app => app.should_show() && app.get_id())
            .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));
        if (installed.length) {
            // Desktop names can contain markup; keep this app picker plain text.
            const picker = new Adw.ComboRow({title: 'Choose an application',
                model: Gtk.StringList.new(installed.map(app => app.get_display_name()))});
            const add = new Gtk.Button({label: 'Add', valign: Gtk.Align.CENTER});
            add.connect('clicked', () => {
                const id = installed[picker.selected]?.get_id();
                const selected = settings.get_strv('applications');
                if (id && !selected.includes(id)) settings.set_strv('applications', [...selected, id]);
            });
            picker.add_suffix(add);
            apps.add(picker);
        }
        window.connect('close-request', () => { settings.disconnect(appSignal); return false; });
        apps.add(entry);
    }
}
