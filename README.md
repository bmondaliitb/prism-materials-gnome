# Prism Materials

A GNOME Shell **50** extension for a soft, unified desktop, inspired by [Apple's material hierarchy](https://developer.apple.com/design/human-interface-guidelines/materials). Version **41** reuses frost snapshots while dragging/resizing windows to avoid repeated capture/filter/allocation bursts, retaining coordinated translucent edges.

## Install

```sh
make package
gnome-extensions install --force dist/prism@local.shell-extension.zip
```

Log out/in, then enable Prism and open preferences:

```sh
gnome-extensions enable prism@local
gnome-extensions prefs prism@local
```

Choose **Subtle, Balanced, Airy (default), Mist**, or **Custom**. Custom reveals the full material-strength range. Existing Glass and Crystal selections migrate to Custom at the same strength. The other controls are enable, appearance, automatic power saving, and reduce transparency. No application selection or per-surface setup is required.

Windows, separate app popups, Shell menus, notifications, dock, overlays, overview, and lock screen use one coordinated material family. The top bar and short-lived overlays retain inexpensive tint; overview and lock backgrounds use native cached wallpaper blur. GTK4 menus receive a managed user-stylesheet block; existing user CSS is preserved. Restart GTK4 apps after styling updates.

Dock and overview cards have a one-pixel translucent inset rim following native corners. App backdrops, Shell menus and GTK4 menus share subtle light/dark edge colors. These decorations add no blur passes, capture layers or timers. The dock rim preserves allocation and input geometry; disabling Prism restores its previous style. Native popup silhouettes and focus rings remain intact.

Cached backdrops are snapshots, refreshing on focus, geometry, popup reopening, or the panel menu's **Refresh cached backgrounds** action. Whole-window translucency also fades app text and images. Embedded toolkit regions cannot universally be styled independently; native unknown layouts are left intact. Fullscreen and minimized windows are excluded.

## Cleanup in version 38

Removed the sidebar launcher/C adapter and its binaries, per-app selection, old 4K/quality/finish presets, per-surface switches, independent opacity overrides, live blur timers, unused nine-tap filters, and obsolete demos/tests/documentation. Only seven settings remain: the five visible choices, Custom strength, and the upgrade marker. Material densities are derived from strength rather than duplicated in hidden settings.

The current preset values, popup alpha masking, rounded boundaries, input isolation, workspace optimization, redraw protection, accessibility overrides, and separate GDM support remain. Existing current profile/strength values survive the cleanup. Legacy preset identifiers are accepted only for upgrade migration. Old stored dconf entries are ignored, not read or recreated.

## Validation

```sh
make check check-runtime-api check-frost-gpu
```

Checks include the real compiled schema with a memory backend, native API/CSS parsers, window/popup lifecycle, focus and workspace behavior, input/corner safety, cached storage/geometry, actual GLSL pixel composition, installer rollback, and removed-setting/import audits. The package is rebuilt from an empty archive so retired modules cannot remain in it.

Live desktop rendering and battery draw remain unverified: this workspace's computer tool exposes no desktop windows and session D-Bus access is blocked.

## Documentation

- [Presets, settings and migration](docs/SIMPLE.md)
- [Rendering and power policy](docs/PERFORMANCE.md)
- [Shared material family](docs/MATERIALS.md)
- [Overview behavior](docs/OVERVIEW.md)
- [Input isolation](docs/INPUT.md)
- [Optional boot-login setup and undo](docs/LOGIN.md)

## Remove

```sh
gnome-extensions disable prism@local
gnome-extensions uninstall prism@local
```

Disabling restores owned styles and original app opacity and removes the GTK managed block. Restart GTK4 apps to reload native styles. The optional GDM companion is installed separately and has its own undo command in the login documentation.
