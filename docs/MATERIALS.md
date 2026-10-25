# One material family (version 33)

The design uses a common visual vocabulary with different densities for different roles. It follows the semantic-material approach described by Apple's [NSVisualEffectView guidance](https://developer.apple.com/documentation/appkit/nsvisualeffectview): select a material for its purpose, with foreground legibility and system appearance kept in mind. Prism is an approximation across GNOME's separate rendering paths, rather than an implementation of Apple's private compositor.

## Shared vocabulary

`surfacePalette()` in materials.js supplies the shared palette for owned application backdrops, Shell materials, and generated GTK4 menus. Dark backgrounds use RGB(25,28,35), matching overview boxes, lightweight overlays, and password cards. Light backgrounds retain RGB(240,244,252). Standard foregrounds are RGB(242,242,242) for dark materials and RGB(28,30,40) for light ones. Shell and GTK menu edges share a 14% light or dark highlight appropriate to appearance; Shell border widths remain native.

`MATERIAL_STATES` defines hover (12%), focus/selection (16%), pressed (22%), and disabled foreground (40%) levels. GTK4 rows use these directly; the scoped Shell stylesheet uses the same levels for popup rows and switcher items, matching overview search. Native keyboard focus rings and control geometry remain. Colors on nested status/checked controls are not broadly overwritten.

Shell interaction rules are scoped to owned palette classes on material surfaces, with separate light/dark variants. They are removed with the material, including on accessibility suspension, and original preexisting classes are preserved. The top bar is excluded from these row rules, retaining its independent neutral tint and wallpaper-aware label/icon treatment. Overlays keep a dark backing even in light application appearance because their native symbols and level bars use light foregrounds.

## Deliberate hierarchy

Search boxes retain 60% backing, while folders and password cards retain 70%. Desktop Shell surfaces use the selected Shell opacity plus optional hierarchy adjustments. App finishes retain their Clear/Frosted/Soft density and independent window opacity. This makes the surfaces related without imposing identical opacity or new rounded corners everywhere.

Blur, Cached frost, battery policy, manual quality choices, native corner preservation, and input behavior are unchanged. The update adds CSS and palette reuse rather than GPU effects or refresh timers. The GDM companion already uses the same dark password-card palette and does not need reinstalling for this update.

## Applying and limits

Install the updated extension and log out/in. If **Match GTK4 app menus** is enabled, fully restart GTK4 apps to load their regenerated user CSS. GTK3/Qt/Electron and inaccessible sandboxed toolkit styling remain outside that optional stylesheet's scope. Native application content stays under application control.

Checks cover shared GTK/Shell palette values, interaction-level generation, appearance changes, scope cleanup and preexisting-class preservation, native CSS parsers, and the existing lifecycle/rendering checks. Live appearance across themes and toolkits remains unverified in this workspace.
