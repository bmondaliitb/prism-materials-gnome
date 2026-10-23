# Automatic sidebar materials

Version 4 removes application-name profiles. The optional native GTK4 adapter detects a standard **AdwOverlaySplitView** or **AdwNavigationSplitView** in any launched app, finds its sidebar and content through the toolkit’s public getters, and styles those actual widgets. It does not use app IDs, window titles, screen positions, or guessed widths.

This is generic support for those widget patterns, not universal support for every desktop app. GNOME Shell only sees rendered window surfaces. It cannot discover semantic sidebar boundaries or remove opaque pixels inside arbitrary apps.

## Install and launch

From the project directory:

```sh
make package adapter
gnome-extensions install --force dist/prism@local.shell-extension.zip
```

Log out/in to load the updated extension. Select the desired app in Prism’s Applications settings, and keep **Sidebar-only materials** on. This prevents whole-window fading for every selected app, even if the older whole-window setting remains on.

Close the target app, then launch its native executable through the adapter:

```sh
./integration/prism-app papers /absolute/path/to/document.pdf
./integration/prism-app nautilus
./integration/prism-app any-other-native-executable --its-normal-options
```

The command accepts executable names and paths and forwards arguments without a shell. Existing single-instance app processes must be closed first; they cannot inherit the launcher environment. The launcher detects an already-running executable and refuses without terminating anything. Files can remain in the background; finish file operations before quitting it.

No effect on an app with an unsupported layout is expected. The adapter deliberately leaves its backgrounds alone. It reports a successful semantic match in the launching terminal. App selection in the Shell extension is still required for backdrop blur; the launcher does not modify your settings.

## What changes

The launcher uses a process-local `LD_PRELOAD` adapter built from `integration/prism-gtk.c`. On GTK’s window-present call it searches for the first supported primary split view and marks:

- The actual sidebar with a translucent native sidebar tint.
- Internal sidebar wrappers and the path to the window as transparent.
- The actual content pane and unrelated siblings along that path as opaque.

Text, images, document pages, selection highlights, and controls keep their own alpha. Nested splits inside the primary content are deliberately left on that opaque content surface. This prevents a nested navigation pane from making part of a reading surface transparent unexpectedly.

No global CSS, app installation, or system theme is edited. Start an app normally to omit the adapter. Close and restart it normally to remove previously applied styling. The Shell’s Sidebar-only switch changes its opacity policy; it does not inject CSS into existing app processes.

## Support boundaries

| App/window layout | Behavior |
| --- | --- |
| Native GTK4 with AdwOverlaySplitView | Detect primary sidebar and content |
| Native GTK4 with AdwNavigationSplitView | Detect primary sidebar and content |
| Any app name using either pattern | Same behavior; no app whitelist |
| Unknown or incomplete widget layout | No stylesheet activation; no whole-window fading in sidebar mode |
| Generic GtkPaned | Unchanged: two panes do not necessarily mean a sidebar |
| GTK3, Qt, Electron, browser apps, custom rendering | No selective material integration |
| Flatpak/Snap launchers | Rejected; cannot use the host adapter inside their sandbox |

Detection runs when the app calls `gtk_window_present`. Re-presented windows are rescanned. If the supported layout disappears, the root styling is removed on the next presentation. Widgets added later without another presentation are not currently detected; there is no polling or per-frame scan.

At narrow widths, a collapsed sidebar overlays opaque app content rather than the desktop. Existing custom backgrounds or high-priority user CSS can also hide transparency. High-contrast mode makes the root and sidebar opaque.

Turning off Prism removes compositor blur but does not unload the stylesheet from an already-running app. The adapter does not yet synchronize its CSS with the Shell’s focus, overview, or Reduce transparency state; restart normally for complete restoration.

## Verification

`make check-adapter` compiles with warnings treated as errors, parses CSS with the installed GTK4 parser, and runs the actual preload adapter against a mock toolkit in four configurations: overlay split, navigation split, unrecognized layout, and incomplete split. Tests use an arbitrary app-window type and verify content protection, provider reuse, original call forwarding, and root-style restoration when the split disappears.

The Shell tests also verify that arbitrary desktop IDs retain full surface opacity in sidebar mode and that whole-window mode remains available when that mode is explicitly disabled. These are isolated tests, not evidence of live rendering. Desktop and isolated-display sockets remain blocked in the authoring environment, so real-app visual validation is still pending.
