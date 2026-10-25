# Shared material family

The runtime shares a dark RGB(25,28,35) palette and light RGB(240,244,252) palette across app backdrops, Shell materials and generated GTK4 menus. Standard foregrounds are RGB(242,242,242) and RGB(28,30,40). Shell and GTK edges share a 14% light/dark highlight; native Shell border widths and geometry remain unchanged.

Hover, focus/selection, pressed and disabled-foreground levels are 12%, 16%, 22% and 40%. Shell row styling is scoped to owned palette classes, preserving preexisting classes on restoration. Native focus rings and nested status controls remain. Overlays use a dark backing for native light symbols; the panel retains its independent neutral tint and wallpaper-aware label/icon contrast.

[Desktop presets](SIMPLE.md) derive coordinated densities from one strength value. Dialogs/notifications retain stronger separation and the dock is airier. Search/folder/password-card fills remain role-specific rather than adopting identical alpha everywhere. Input regions and native application layout remain under their existing owners.

The material implementation uses one cached rendering path. No separate finish/quality/edge/hierarchy controls remain. Global enable, reduced transparency and automatic accessibility/power behavior govern the material family together. GTK4 apps need restart to load their managed stylesheet; unsupported toolkit/sandbox styling is left alone.
