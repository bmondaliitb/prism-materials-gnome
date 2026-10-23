# Match application item menus to the Shell window menu

The menu opened from a window title bar is rendered by GNOME Shell. The menu opened over a file is rendered by GTK inside Files. The two surfaces use different theme systems, so changing Shell popup backgrounds alone does not change the item menu.

Version 8 adds **Match GTK4 app menus** in **Windows and desktop surfaces**. It styles native GTK4 `popover.menu` surfaces with the same light/dark palette and background opacity used by Prism's Shell menus. It adds a translucent fill, fine border, rounded 18 px outer corners, rounded 12 px row highlights, and subtle separators. Native menu actions, icons, text sizing, keyboard handling, and app contents are retained. No rectangular backdrop shader is placed behind GTK menus.

## Use

Install `dist/prism@local.shell-extension.zip`, then log out/in to load the updated code. Open Prism preferences:

1. Enable **Shell menus and popups**.
2. Enable **Match GTK4 app menus**. The Translucency everywhere preset also enables this option.
3. Keep **Preserve native rounded corners** enabled.
4. Fully quit and reopen Files and any other GTK4 apps whose menus should change.

No special app launcher or sidebar adapter is needed for this option. The palette follows Prism's Appearance setting, and alpha follows Shell background opacity. Restart GTK4 apps after changing either, because user GTK stylesheets are loaded at app startup. For the dark appearance in the reference screenshot, select Dark and start with the existing Shell opacity of 85%.

## Managed user styling

The option writes `~/.config/gtk-4.0/prism-managed-menus.css` and prepends one explicitly marked import to `~/.config/gtk-4.0/gtk.css`. It applies to GTK4 menu popovers across apps that load this user configuration. Existing rules remain intact. Disabling the option or extension removes the owned import and owned generated file. Existing app processes must restart to stop using previously loaded CSS too.

Prism refuses to replace a symlinked stylesheet or an unrelated file at its generated path; failures are logged in the Shell journal. It does not modify system themes, GTK installations, app executables, or document rendering. GTK3, Qt, Electron, and sandboxed apps without access to the host GTK4 configuration are outside this feature's scope.

## Rounded-corner correction

The earlier backdrop blur painted a full rectangle even around rounded CSS or client surfaces. **Preserve native rounded corners**, enabled by default, now avoids that paint:

- Rounded Shell surfaces use their native rounded translucent backgrounds with no rectangular background-blur effect.
- Shell surfaces with zero radius, such as the normal top bar, can retain blur.
- Unknown Shell shapes use the safe no-blur fallback.
- App windows retain their original client alpha silhouette, with no square Prism backdrop behind them.

This deliberately preserves translucency while giving up backdrop blur where it cannot be clipped safely. Disabling Preserve native rounded corners restores the old rectangular blur path and can bring the square patches back. There is no claim of a shape-aware blur shader in this version.

## Checks

The build validates schemas and JavaScript, parses dark/light generated styles using the installed GTK4 CSS parser, and tests that enabling/updating/removing imports preserves existing and subsequent user edits. It also tests refusal to overwrite symlinks or unowned files. Window tests cover corner-safe opacity restoration without a backdrop; Shell tests cover theme radii, asymmetric rounding, unknown shapes, and removing/restoring blur on setting changes.

A real Files screenshot after applying the new style has not been verified in this environment. The implementation matches the reference's material treatment; native Shell and GTK layouts can still differ in spacing and typography.

## Version 9 correction

The GTK menu stylesheet now sets the actual popover palette and clears nested wrapper backgrounds. It targets both legacy modelbutton nodes and current button.model menu rows. Fully restart Files after upgrading to load it. High-contrast rendering is left to the system theme.

The earlier no-blur corner fallback now has an opt-in/off **Rounded frosted glass** renderer, enabled by default. It supplies masked backdrop blur for Shell surfaces and configurable application backdrops; embedded GTK item menus still receive matched translucency without independent blur. See [rounded frost and validation](FROST.md).

## Version 12: self-contained GTK rules

The active managed menu styling is now embedded directly in gtk.css between Prism markers. This fixes the relative-import failures observed when Snap theme forwarding copied gtk.css without the adjacent generated file. Old import blocks migrate automatically, and removing the feature removes only Prism's owned block. Sandboxed apps still need access to the forwarded configuration and must restart to reload it. See [popup consistency fixes](POPUPS.md).
