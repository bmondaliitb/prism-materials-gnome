# Window and Shell translucency settings

Version 6 refines the controls introduced in version 5 in the **Windows and desktop surfaces** section in Prism preferences. New scope/category switches default off, so upgrading does not automatically change more of your desktop.

## Quick setup

```sh
make package
gnome-extensions install --force dist/prism@local.shell-extension.zip
```

Log out/in to reload the extension, then open Prism preferences. Click **Apply** on **Translucency everywhere** to:

- Target every eligible app, regardless of the selected-app list.
- Enable whole-window fading and turn off sidebar-only mode.
- Include background windows, dialogs, utility windows, and separate app popups.
- Enable supported Shell menus, top bar, dash/dock, and modal dialog backgrounds.

This preset preserves the opacity sliders. **Reduce transparency** continues to override it; the preset does not reset that comfort preference.

Alternatively, choose each category separately. The optional native GTK sidebar launcher is not required for whole-window or Shell translucency.

## What each setting does

| Setting | Scope |
| --- | --- |
| All applications | Every eligible normal app window, including unidentified apps; selected-app list is bypassed |
| Application dialogs and utility windows | Meta dialog, modal-dialog, utility, and toolbar window types |
| Application menus and popups | Separate compositor-managed menus, dropdowns, popup menus, tooltips, and combo windows |
| Shell menus and popups | Standard `popup-menu-content`/`quick-settings` backgrounds, including Shell right-click menus and panel popups |
| Top bar | GNOME panel background |
| Dash and dock | Standard `dash-background` widgets, including compatible Ubuntu Dock/Dash to Dock instances |
| Notification banners and tray | Standard notification banner backgrounds and nested message cards |
| Shell dialogs | Standard `modal-dialog` backgrounds |
| Shell background opacity | 40–100%, shared across enabled Shell surfaces; foreground labels/icons are not faded |
| Application popup opacity | 75–100%, separate from the normal window opacity; fades popup foreground as well |

The existing **Window opacity** applies to whole app surfaces when Whole-window translucency is on and Sidebar-only materials is off. **Focused window only** can still limit apps and transient children; disable it to affect background windows too. App popups explicitly use their own opacity even with sidebar-only mode enabled.

## Boundaries

An app-rendered menubar or Wayland popover may be part of its parent window or a subsurface that is not exposed as a separate `Meta.WindowActor`. The popup switch cannot target those independently. Whole-window fading affects them as part of the window. The Shell surface manager does not inject CSS into application toolkits.

Desktop backgrounds, drag-and-drop actors, unknown window types, lock/login surfaces, and nonstandard third-party dock/menu backgrounds are excluded. Fullscreen/minimized app windows remain excluded. Standard Shell menus and the dash can remain styled in the overview; application-window blur is suspended there.

The Shell manager watches actor additions/removals and style-class changes, with coalesced idle rescans. It covers newly created menus and standard dock actors without a polling loop or patching Shell menu prototypes. It saves inline styles and adds its own blur effect. Disabling a category, the global switch, Reduce transparency, locking, or disabling the extension removes owned effects and restores owned styles. Later inline changes by another extension are preserved at restoration when detected. Simultaneous theme/dock extensions may still conflict and require live testing.

This restoration concerns compositor/Shell changes. The optional native sidebar adapter's already-loaded CSS still requires restarting the application normally to unload it.

## Validation status

Strict schema validation, JavaScript parsing, window eligibility/opacity tests, and Shell actor lifecycle tests pass. Tests cover newly added menus, category isolation, unchanged foreground rows, no duplicate effects, detached actors, style restoration, external changes, pending-idle cleanup, all-app targeting, dialog/popup opt-ins, and desktop exclusion.

Live GNOME rendering remains unverified because the authoring environment blocks desktop/session access. Before relying on this build, check panel menus, Quick Settings, calendar, application right-click menus, dock autohide, overview, lock/unlock, theme changes, and disable/re-enable on GNOME Shell 50. Multiple blurred surfaces can increase GPU cost.

## Version 6: panel, popup, calendar, and tray fixes

The installed Yaru stylesheet contains `#panel` background rules with `!important`. Prism now applies its owned background declarations at the same importance, so ordinary theme paint does not silently force an opaque top bar. Existing inline styling is preserved and restored.

Shell popup menus use a BoxPointer that can paint a separate Cairo arrow/background beneath `popup-menu-content`. Prism now clears that backing paint and requests a border repaint, leaving a single material on the actual menu surface. Candidate popups, date-menu roots, submenus, and Quick Settings submenu surfaces are recognized too.

Calendar and tray cards can have their own opaque backgrounds. Recognized calendar/event/weather/clock/message containers inside a menu or banner now reveal the parent material. They do not receive extra blur effects. Unrelated widgets with the same card classes outside these surfaces are left alone, and menu rows, labels, icons, and controls are not faded.

**Notification banners and tray** is a new independent switch. The **Translucency everywhere** preset includes it. After updating and logging out/in, enable it or reapply the preset. Existing top-bar and menu settings are preserved. For a more visible effect, try **Shell background opacity = 65%**; 85% is intentionally more solid.

Regression tests cover the theme-importance override, BoxPointer cleanup and repaint, scoped calendar clearing, independent notification banners, restoration, and event-driven refresh. The previous version did not handle all these painted layers. The corrected code has not been visually verified in a live GNOME session.

## Versions 7–8: native corners and matched application menus

**Preserve native rounded corners** now defaults on. Rounded/unknown Shell shapes retain translucent native paint without rectangular blur. Application windows keep their client silhouette with opacity only and no Prism backdrop. Square Shell shapes may still use blur. This supersedes earlier references to blur on all eligible surfaces.

**Match GTK4 app menus** adds a managed GTK4 user stylesheet import to harmonize item menus with the Shell title-bar context menu. It is included in the Translucency everywhere preset. Restart GTK4 apps after enabling/disabling the option or changing Prism's palette/opacity. See [menu styling and restoration](MENUS.md) for scope and file behavior.

## Version 9: experimental rounded frost

Rounded frosted glass now supplies GPU-captured, blurred, rounded materials for known Shell surfaces and app backdrops. The prior no-blur behavior remains available by disabling that switch. Modern GTK item menus get corrected dark background/row styling, but embedded app popovers cannot receive separate Shell blur. See [implementation boundaries and the actual shader pixel test](FROST.md).

## Independent top bar material (version 18)

Version 20 corrects the scope of foreground styling: only actual St.Label and St.Icon instances beneath the panel receive color overrides. Workspace dots, drawing areas, layout containers, and panel buttons retain their original styles. All Prism panel text/icon shadows are removed. The panel uses native Shell.BlurEffect in background mode rather than the custom rounded-frost shader; this avoids custom masking of the whole panel and its children. In Eco its radius is capped at 18 px, Balanced at 32 px, High at 80 px, and Translucency only removes it. If corner safety is enabled and the panel is rounded or its shape is unknown, it retains tint without rectangular blur. The 25% neutral tint and independent opacity remain. Tests cover untouched workspace widgets, the native panel renderer, foreground color restoration, and removal of inherited shadows. Live panel geometry cannot be verified from this workspace.

Version 19 lowers the default tint opacity to 25% and allows 0–100%. The panel backdrop brightness is now 1 in both palettes to preserve the background's brightness. Contrasting text and symbolic icons receive subtle opposing-color shadows. Explicitly customized opacity values are retained; set Top bar background opacity to 25% manually to adopt the new appearance. At 0%, blur still applies when enabled, but there is no panel tint.

The top bar now uses `panel-opacity`, default 60%, independently of `shell-opacity` (menus, dock, notifications, and dialogs). Preferences expose **Top bar background opacity**. The light tint is neutral gray RGB(218,222,228); the dark tint is charcoal RGB(32,34,38). Light foreground RGB(246,247,249) is used in dark mode, and dark foreground RGB(16,20,26) in light mode. Dark-panel backdrop brightness is 0.7 to moderate bright wallpaper beneath the lighter tint coverage.

Foreground colors are applied to panel descendants as well as the panel itself because themes can assign colors directly to buttons and symbolic icons. Popup descendants are excluded. Button backgrounds, hover styling, input behavior, and actor opacity are retained. Full-color tray images retain their image colors. Original inline styles are restored when panel materials are disabled. At very low opacity, readability remains dependent on wallpaper; 60% is the recommended starting point. Live visual verification is still required.
