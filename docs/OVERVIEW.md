# Overview and search

Pressing Meta reveals the native wallpaper source under a dark veil derived from the selected desktop preset. Airy's veil is 26%. Search results/field use a dark translucent material; app folders use a stronger fill. Text, icons, native focus outlines, foreground opacity and control geometry remain intact.

Wallpaper actors are created lazily per monitor, below controls, and reused across hide/show. GNOME's BackgroundManager follows wallpaper changes; monitor changes rebuild owned resources. Native ACTOR-mode blur is fixed at 18 px on wallpaper actors, without desktop-window capture or custom blur effects on each result. Background brightness remains 0.65 for GNOME's light overview labels.

Search and folder styling is scoped to the owned overview class. Native folder modal shading, name editing and app interaction remain. Global disable, Reduce transparency and automatic high contrast remove the scope, restore root styling and release wallpaper resources. Decorative actors cannot receive pointer, hover or keyboard focus.

Tests cover lazy allocation, monitor lifecycle, stable native blur, density changes without foreground changes, external-class preservation and cleanup. Live appearance remains unverified in this workspace.
