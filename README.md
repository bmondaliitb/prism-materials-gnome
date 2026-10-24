# Prism Materials

A complete visual direction and experimental GNOME Shell 50 extension for soft, layered window materials, inspired by [Apple’s materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials).

**New in version 20:** panel foreground styling is restricted to actual labels and icons; workspace dots, buttons, and layout widgets retain their native styling. Panel shadows have been removed. The top bar uses GNOME's native background blur instead of the custom rounded shader, avoiding custom clipping of panel controls. Eco caps its native blur radius at 18 px, Balanced at 32 px, and High at 80 px. The independent 25% tint default is retained.

**Version 19:** lowered the top bar default tint to 25% and allowed 0–100%. Previously customized opacity values are preserved; set **Top bar background opacity** to 25% to use the lighter tint.

**Version 18:** introduced an independent neutral top bar material and opacity control. Menus, dock, and dialogs retain their separate Shell opacity.

**Version 17:** **Stable backdrop redraws** (on by default) disables clipped monitor redraws while live frosted surfaces are visible, addressing remaining hover-triggered patches. Full repaints during updates can cost more GPU bandwidth; Eco remains available. No continuous repaint loop is added. See [rendering notes](docs/PERFORMANCE.md).

**Version 16:** hover-triggered refreshes no longer invalidate unchanged window and Shell backdrops. Captures use exact effect bounds so blur does not sample stale pixels from allocation padding.

**Version 15:** live window frost marks its top-level compositor actor as backdrop-dependent. The guard does not add another offscreen rendering pass and is removed in Translucency-only mode.

**Version 14:** choose **Rendering level** in Material settings: Eco (default for integrated GPUs), Balanced, High, or Translucency only (no blur/capture). Changes apply immediately after this version is loaded. See [rendering budgets](docs/PERFORMANCE.md).

**Version 13:** [lower-cost frosted glass](docs/PERFORMANCE.md): bounded reduced-resolution blur, reusable GPU buffers, and less work on focus and hover.

**Version 12:** [popup consistency fixes](docs/POPUPS.md): offscreen frost capture uses the active framebuffer matrices, custom popup wrappers keep native tint when no replacement surface exists, and GTK menu styling is self-contained for theme forwarding.

Open **[the interactive design preview](docs/preview.html)** in a browser. It is self-contained and works offline. Choose Clear, Frosted, or Soft, adjust blur, switch light/dark appearance, change the backdrop, and toggle the effect. This is an illustration of the intended visual language, not a screenshot of the extension running.

The **[design specification](docs/DESIGN.md)** covers materials, interactions, scope, accessibility, architecture, limitations, and the release checklist.

## Try the extension

The packaged prototype is `dist/prism@local.shell-extension.zip`. It targets GNOME Shell **50** only and has not been tested in a live Shell session. Build checks do not establish runtime compatibility.

```sh
make package
gnome-extensions install --force dist/prism@local.shell-extension.zip
```

Log out and back in so GNOME discovers the extension, then:

```sh
gnome-extensions enable prism@local
gnome-extensions prefs prism@local
```

1. Focus an application, open the Prism fog icon in the panel, and choose **Toggle for focused app**. The initial app list is empty. Use All applications to bypass it, or the Translucency everywhere preset for broader coverage.
2. If the app already has transparent backgrounds, Prism supplies the backdrop blur.
3. For an opaque app, enable **Whole-window translucency** in preferences. Start with **92%** opacity. This also fades text, images, and controls.
4. Whole-window translucency requires turning off **Sidebar-only materials**. Choose a finish and appearance. **Focused window only** is enabled by default.
5. Use **Reduce transparency** or the panel toggle to restore compositor opacity and Shell styles immediately.

The Shell extension alone cannot identify or replace opaque GTK, Qt, or Electron toolbar and sidebar backgrounds independently. The optional GTK4 adapter detects supported sidebar/content widgets across apps. The browser design illustrates a cooperative app with translucent regions. Genuine refraction, per-region vibrancy, and universal rounded clipping are not implemented.

## Remove

```sh
gnome-extensions disable prism@local
gnome-extensions uninstall prism@local
```

Disable restores saved surface opacity and removes material actors and signal handlers. No system files are edited. The optional Match GTK4 app menus feature adds a managed block to your user GTK4 stylesheet; existing customizations are preserved.

## Development

- `prism@local/extension.js`: window tracking, backdrop actors, panel controls, restoration.
- `prism@local/materials.js`: visual tokens and selection policy.
- `prism@local/shellSurfaces.js`: dynamic Shell menu, panel, dash/dock, and dialog backgrounds.
- `prism@local/gtkMenus.js`: matched GTK4 menu styles and managed inline user CSS block.
- `prism@local/frostEffect.js`: experimental GPU backdrop capture and rounded frost.
- `prism@local/frostShader.js`: native-resolution rounded composite.
- `prism@local/frostBlur.js`: downsampling and separable blur with a fixed pixel budget.
- `prism@local/prefs.js`: native libadwaita settings.
- `prism@local/schemas/`: local GSettings schema.
- `docs/preview.html`: responsive interactive visual concept.
- `tests/`: material policy and lifecycle checks.

Run `make check` for strict schema validation, JavaScript syntax checks, and isolated policy/lifecycle tests. Run `make package` to rebuild the installable archive. These checks use `gjs`, `glib-compile-schemas`, and `zip`.

Installed Shell typelibs and isolated Mesa shader tests are available. Live compositing, preferences rendering, and desktop frame times still require the manual checks in the specification before release.

## If you see no effect

Check **Applications** first. An empty list affects no app windows when All applications is off. Shell surfaces have independent switches. The preferences now provide an installed-app picker and a status message.

In sidebar-only mode, launch the selected native app with `./integration/prism-app EXECUTABLE`. The adapter needs a supported libadwaita split view. Unknown layouts remain unchanged. To deliberately use whole-window fading instead, disable Sidebar-only materials and enable Whole-window translucency; this also fades content.

An investigation on this machine found Prism installed and present in GNOME’s enabled-extension list, but `applications` was empty and `force-translucency` was false. No Prism runtime exception appeared in the inspected journal. Direct Shell D-Bus access was blocked, so this diagnosis does not establish that live compositing works. The installed Shell 50 library does expose the required `radius`, `brightness`, and `mode` blur properties.

The earlier version 2 fixed the preferences group title markup and added the app picker and empty-selection status. To update, install the rebuilt package using the command above, log out/in to reload its code, and reopen preferences. Updating preserves your settings.
