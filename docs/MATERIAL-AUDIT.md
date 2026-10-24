# Material consistency audit: version 30

Reviewed app backdrops and popups, GTK4 menu CSS, Shell menus and inline submenus, Quick Settings overlays, notifications, dialogs, dock/OSD/switcher/tooltips, overview search and app folders, and lock/GDM password cards.

## Corrections

- **Expanded inline Shell submenus:** previously received an additional tinted material and blur inside their already painted menu. They now reveal the parent material. Separate floating popups across a BoxPointer boundary, standalone submenus, and Quick Settings overlay cards retain independent surfaces. This removes a redundant blur pass and avoids compounded opacity.
- **Shell edge highlights:** previously replaced native borders with a one-pixel border. They now change border color only, preserving native widths, rounding, spacing, and layout. The top bar and lightweight overlays remain excluded. Turning the option off restores the original theme border.
- **App edge highlights:** Glass edges off previously left a faint synthetic border. The owned backdrop now uses a transparent border, retaining the same bounds while removing the highlight in both appearances.
- **Disabled search details:** descriptions, search hints, and search icons now use the same subdued foreground alpha as disabled labels. Previously their explicit colors kept them relatively bright.
- **Style restoration:** Shell restoration now uses the same feedback guard as application, avoiding an unnecessary rescan triggered by Prism's own restoration writes.
- **Lock blur replacement:** if another component replaces/removes the native blur on an existing wallpaper actor, Prism restores and releases the old effect before tracking the replacement. Disable restores each effect's own saved values.

## Deliberate differences retained

The top bar has its own neutral tint and opacity. Desktop Shell surfaces follow Shell background opacity and optional hierarchy. Search boxes use 60% dark backing; app folders and password cards use 70% for legibility. Native app popups have their separate opacity control. These are different surface roles, rather than an expectation that every surface must have identical alpha.

Overview surfaces share wallpaper blur; lock screen reuses GNOME's native wallpaper effect; short-lived desktop overlays use tint only. The GDM companion remains a separate system installation and is unchanged by this audit. Existing settings are preserved, with no new blur pass, per-frame work, or timer.

## Validation

Regression checks cover inline/floating submenu boundaries, no extra submenu effect, standalone/Quick Settings coverage, untouched border geometry, edge opt-out in both appearances, native blur replacement/restoration, surface cleanup, CSS parsing, and existing rendering/installer behavior. Live desktop rendering is not available in the development workspace; these checks do not establish pixel-perfect appearance across themes and toolkits.
