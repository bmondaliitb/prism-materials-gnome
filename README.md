# Prism Materials

A complete visual direction and experimental GNOME Shell 50 extension for soft, layered window materials, inspired by [Apple’s materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials).

**New in version 33:** a shared material palette now connects app backdrops, Shell surfaces, and GTK4 menus. Menu and switcher highlights use the same interaction strengths as overview search, with readable foregrounds in both appearances. Role-specific opacity, native geometry, and rendering policies are preserved. See [material family](docs/MATERIALS.md).

**Version 32:** **Rendering level → Cached frost · frozen background** reuses an Eco-blurred backdrop without live recapture while geometry stays unchanged. Window focus/material changes and reopened Shell popups refresh it; the top bar uses tint only. This trades live background updates for less capture/filter work. See [performance behavior](docs/PERFORMANCE.md).

**Version 31:** Automatic comfort distinguishes battery from Power Saver. Battery retains enabled window materials with Eco blur at up to 20 fps. Power Saver keeps background-window tint, limits live window blur to the focused window at up to 12 fps, and keeps the top bar/dock translucent without blur. Saved appearance and selection settings remain unchanged. See [power policy](docs/PERFORMANCE.md).

**Version 30:** a material consistency audit removes stacked blur/tint in inline submenus, preserves native Shell border geometry, makes Glass edges off remove app highlights, dims disabled search details/icons consistently, and fixes restoration after a lock-screen blur effect is replaced. See [audit findings](docs/MATERIAL-AUDIT.md).

**Version 29:** the lock screen keeps your desktop wallpaper clear at the clock and shows a translucent password card over bounded native wallpaper blur. An optional Ubuntu GDM installer prepares the same wallpaper and card for the boot/logout login screen. See [setup and undo](docs/LOGIN.md).

**Version 28:** matching materials for Alt+Tab, volume/brightness indicators, standard Shell tooltips, the overview search field, and app folders. **Lightweight Shell overlays** defaults on and uses tint only, without adding blur or desktop capture. Overview additions share the existing wallpaper backdrop.

**Version 27:** overview search-result boxes now use a dark translucent material with translucent hover, selection, and pressed highlights. They share the overview wallpaper blur without adding per-result capture or blur effects.

**Version 26:** the Meta-key overview gains a translucent wallpaper material, enabled by default, with separate **Overview wallpaper blur** and **Overview background opacity** controls. Only wallpaper actors are blurred using native cached actor blur; search, app labels, and previews remain crisp. See [overview behavior](docs/OVERVIEW.md).

**Version 25:** added **Smooth workspace transitions**, freezing frost during slides and restoring live effects afterward without changing saved quality.

**Version 24:** cached unchanged foreground textures, introduced a 30 fps stationary backdrop limit, and added **Comfort and behavior → 4K / integrated GPU preset → Apply**. See [performance details](docs/PERFORMANCE.md).

**Version 23:** restored frost for separate app dropdowns and menus directly on their native client surface, preserving transparent margins without a second backing plate.

**Version 22:** improved downsampling to suppress text bands and introduced **Background detail reduction**, default 25%, for calmer frosted backgrounds. Native panel blur is unaffected.

**Version 21:** six optional finishing features under **Comfort and behavior**: material hierarchy, active-window emphasis, glass edge highlights, gentle tint transitions, automatic comfort, and wallpaper-aware panel colors. See [behavior and limits](docs/EXPERIENCE.md).

**Version 20:** restricted panel foreground styling to actual labels/icons and switched the top bar to native GNOME blur. Workspace dots and layouts keep their native styling; the independent 25% panel tint remains.

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

Disable restores saved surface opacity and removes material actors and signal handlers. The desktop extension edits no system files. The optional Match GTK4 app menus feature adds a managed block to your user GTK4 stylesheet; existing customizations are preserved. The separately installed GDM companion has its own [system installer and undo command](docs/LOGIN.md).

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
