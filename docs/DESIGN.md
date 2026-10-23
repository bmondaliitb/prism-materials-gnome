# Prism: window materials for GNOME

## Intent

Make the desktop feel calm, tactile, and connected to its backdrop while preserving the hierarchy of application content. The defining impression is diffuse color behind a steady reading surface, with a fine light edge. Avoid animated shine, strong transparency, or decorative glass on every component.

Apple’s [materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) distinguishes standard materials for content from Liquid Glass for controls and navigation, and emphasizes legibility and restrained use. Prism adapts those principles to GNOME rather than claiming to reproduce Apple’s proprietary rendering.

The complete design consists of a responsive interactive concept, native preferences, a panel control, a window-selection policy, and an experimental compositor implementation. The prototype provides real backdrop blur; its visual behavior still needs verification in GNOME Shell 50.

## Material system

| Finish | Intent | Blur radius | Dark/light tint alpha |
| --- | --- | ---: | ---: |
| Clear | Light atmosphere for simple, already translucent apps | 18 | 0.06 |
| Frosted | Everyday default; moderate background separation | 36 | 0.16 |
| Soft | Stronger background separation | 56 | 0.28 |

Dark tint uses RGB 24, 27, 36; light tint uses RGB 240, 244, 252. A one-pixel white boundary uses alpha 0.12 in dark appearance and 0.32 in light appearance. Background brightness is 0.85 for dark and 1.0 for light. These are starting tokens to calibrate on hardware, not contrast guarantees.

The blur slider ranges from 0 to 80. Selecting a finish resets the radius to its default; moving the slider customizes the current finish. Appearance supports light, dark, and follow desktop. Follow desktop reads the GNOME color-scheme preference; it does not sample background luminance.

The extension leaves original client rendering and shadows in place. It supplies a tinted, blurred plane underneath the client surface. It does not recolor text or impose new content layout.

## Visual composition

The browser concept uses an atmospheric peach, violet, and slate backdrop, with a floating file browser. Its navigation rail is lightly separated from the content area; folder icons and foreground labels stay sharp. A 16 px window radius, delicate upper highlight, and diffuse shadow illustrate the desired app-integrated result.

The preview page uses a near-black canvas, a compact Prism mark, a large editorial introduction, and a desktop stage beside the settings card. The stage is the dominant element. Settings form one vertical sequence: finish, appearance, blur, and application scope. At smaller widths the settings move beneath the stage; the outer page and file browser reduce their spacing.

Preview controls modify only the illustration. The files, dock icons, and navigation entries are decorative. Native preferences are the actual extension controls and follow libadwaita styling.

**Important fidelity boundary:** the browser illustration shows sharp foreground text on translucent surfaces. That requires app-provided alpha. Whole-window opacity in the extension also fades foreground content. The preview deliberately labels this distinction.

## First use and daily interaction

Installation starts with the extension switch on, no selected apps, Frosted, automatic appearance, radius 36, and focused-window mode. Whole-window translucency is off. No windows change until an app is selected.

The panel menu contains:

1. **Window materials** — globally suspend or resume the effect.
2. **Toggle for focused app** — add or remove its desktop ID from the selection list.
3. **Material settings** — open native preferences.

The selection list persists. Preferences accept comma-separated desktop IDs with an explicit Apply action; whitespace and duplicates are removed. An empty list means no applications. Desktop IDs come from Shell’s window tracker, so Wayland and XWayland can share the policy when Shell identifies the app.

Native preferences expose material finish, appearance, blur radius, optional whole-window opacity, focused-window mode, reduce transparency, and selected applications. Numeric opacity is clamped to 75–100%; 92% is the starting value when explicitly enabled.

The current panel action toggles the remembered focused app; it does not include an app picker. A future revision should show the app name and selection status inline once live-shell behavior is verified.

## State behavior

| Condition | Behavior |
| --- | --- |
| Selected normal focused window | Material active |
| Unselected app or unrecognized desktop ID | Original rendering |
| Background window with focused-only enabled | Restore original rendering |
| Focused-only disabled | All selected normal windows eligible |
| Fullscreen or minimized | Restore original rendering |
| Overview visible | Suspend materials |
| Lock screen | Suspend; Shell may also disable the extension for session mode |
| Reduce transparency | Remove materials and restore original opacity |
| Global switch off | Remove materials and restore original opacity |
| Window destroyed | Remove tracking and owned resources |
| Extension disabled | Disconnect signals, remove actors and panel item, restore saved opacity |

Maximized and tiled windows remain eligible; no new window rounding is imposed. Dialogs, popovers, menus, desktop windows, docks, and the lock screen are outside scope.

## Accessibility and comfort

Keep original app text rendering unless the user explicitly enables whole-window opacity. Expose that consequence beside the switch and opacity control. Do not assert universal contrast compliance: background content, themes, and app alpha vary.

Reduce transparency suspends all effects. This is an extension preference, not an OS-wide accessibility preference. Native preferences inherit GTK keyboard navigation, focus indicators, scaling, and theme behavior. The browser concept supplies visible focus indicators, labels, accessible switch/pressed states, and a reduced-motion media query. There is no runtime animation or pointer-following highlight.

Before release, inspect light/dark backgrounds, high-contrast themes, 100–200% scaling, keyboard-only operation, screen reader labels, dense text, and video backgrounds. Use opaque application rendering whenever the material reduces readability.

## Compositor architecture

`extension.js` tracks each window actor independently, never by PID. It subscribes to map, focus, window geometry, fullscreen/minimized, settings, overview, and session changes. It does not run a continuous timer.

For an eligible window:

1. Save the original client surface opacity.
2. Insert a non-reactive `St.Widget` as the first child of the window actor, below the original surface.
3. Attach `Shell.BlurEffect` in `BACKGROUND` mode. This samples content already painted behind it; see the [Shell API](https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/class.BlurEffect.html).
4. Size the layer to the frame rectangle and offset it relative to the buffer rectangle so client shadows do not enlarge the effect plane.
5. Apply appearance tokens and, only if requested, lower the saved surface opacity.
6. Remove the layer and restore opacity whenever eligibility ends.

The backdrop and window share their parent’s transforms and stacking. User input continues to reach the original surface. Preferences use a local GSettings schema. No network, telemetry, application injection, theme modification, or persistent background service is involved.

The prototype assumes the original first child is the client surface. This must be checked on native Wayland and XWayland windows on the target Shell before general use. GNOME internal actor layouts are not a cross-version compatibility guarantee.

## Limitations and planned refinements

- Opaque windows hide the material until whole-window translucency is enabled. That approximation cannot preserve full text opacity.
- The extension has no knowledge of internal sidebar/toolbar rectangles. Region-specific materials require cooperative applications or a separate toolkit integration.
- Real Liquid Glass refraction, adaptive luminance, chromatic dispersion, and vibrant text are not provided by this prototype.
- The backdrop is rectangular. Client rounded corners can reveal its corners; universal shape masking is not implemented. The preview’s rounded geometry is a target, not a shipped compositor feature.
- GPU cost grows with blur radius, visible area, and the number of eligible windows. Focused-only mode limits work; there is no measured performance target or battery-aware policy yet.
- Other extensions that modify the same actor or surface opacity can conflict. Restoration uses the opacity saved when Prism activates.
- Background repaint correctness during video, overlapping windows, and moves needs live validation. No forced repaint loop is added without evidence that one is necessary.
- Public distribution needs a stable reverse-domain UUID, license choice, GNOME extension review, and a verified support matrix. `prism@local` is a development identifier.

## Verification and release gates

Automated checks validate the GSettings schema, parse JavaScript, test eligibility policy, check material fallback tokens, and exercise isolated update/restoration behavior with mocked compositor actors. They cannot validate GPU output or GNOME internal APIs.

Before describing the extension as production-ready, complete:

- Install and enable on a disposable GNOME Shell 50 session; inspect the journal for exceptions.
- Open native preferences and verify every control writes and restores settings correctly, including external app-list changes.
- Test transparent and opaque GTK, Qt, Electron, and XWayland clients.
- Move, resize, tile, maximize, minimize, restore, fullscreen, and close windows repeatedly.
- Open and exit overview, lock/unlock, and switch workspaces and monitors.
- Toggle selected apps, material presets, opacity, focus mode, and reduce transparency repeatedly.
- Disable/re-enable while windows are open; verify original opacity, zero orphaned backdrop actors, and no duplicate signal handlers.
- Check client shadows and corners on fractional scaling and mixed-DPI monitors.
- Run bright, dark, moving, and video backgrounds; assess text and rendering artifacts.
- Measure frame times and power on integrated graphics with one and several eligible windows.

Current status: packaged experimental implementation; automated checks pass. Native rendering and browser visual inspection were unavailable in the authoring environment. No installation or desktop settings change has been performed.

## Version 4 implementation update

The optional [generic GTK4 adapter](SIDEBARS.md) detects sidebar/content widgets through standard libadwaita split-view APIs across app names. The earlier Papers/Files profiles have been removed. The Shell preserves full foreground opacity for every selected app in sidebar-only mode. Unknown layouts remain unchanged; this is not universal support for arbitrary toolkits. Mock attachment tests cover both supported split widgets and unknown/incomplete layouts; native visual validation remains outstanding.

## Version 5 implementation update

[Desktop surface settings](SURFACES.md) add all-app targeting, explicit application dialog/popup categories, and dynamic Shell menu/panel/dock/dialog materials. These are optional settings; the one-click Translucency everywhere preset enables them and whole-window fading. Earlier statements excluding dialogs and Shell surfaces describe the original prototype and are superseded by this update. Fullscreen, lock, desktop, and unsupported app subsurfaces remain excluded. Native visual verification is still pending.

## Version 6 implementation update

The surface manager now handles theme `!important` backgrounds, popup BoxPointer paint, scoped calendar/tray inner backgrounds, and an independent notification-banner switch. Theme and inline-style changes trigger coalesced refreshes. Only the root material gets blur; pointer chrome and recognized inner card backgrounds are cleared, preserving foreground opacity. See [surface settings](SURFACES.md) for upgrade instructions and remaining validation limits.

## Versions 7–8 implementation update

The [corner and menu changes](MENUS.md) preserve native shapes by disabling rectangular backdrop blur on rounded/unknown Shell surfaces and removing rectangular app backdrops in corner-safe mode. There is no rounded blur shader. Generic GTK4 item-menu styling is now available through a managed user CSS import, independent of the optional sidebar adapter. This is the first feature that edits the user GTK4 stylesheet; it preserves other rules and removes its own import when disabled. No system theme files are edited. Native visual validation remains pending.

## Version 9 implementation update

A separate [rounded frost renderer](FROST.md) now captures and blurs the backdrop before actor redirection, masks known Shell corner radii, and supports a configurable app-backdrop radius. It is experimental: its real GLSL pixel test passes, but live GNOME capture/composition is unverified. Disabling Rounded frosted glass restores the earlier corner-safe translucent fallback. The GTK menu stylesheet also now targets modern button.model rows and the native popover palette; it provides matched translucency without independent embedded-menu blur.
