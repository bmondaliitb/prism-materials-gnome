# Rounded frosted glass — version 9

The previous Preserve native rounded corners mode intentionally disabled rectangular blur on rounded surfaces. That fixed square patches by falling back to clear translucency. A material preset alone could not restore the missing blur.

Version 9 adds an **experimental Rounded frosted glass** renderer. Keep Preserve native rounded corners on and enable Rounded frosted glass. It is on by default for upgrades, and can be disabled independently to return to the safe translucent fallback.

## How it renders

The effect copies the already-rendered backdrop on the GPU **before** redirecting the target actor into its own texture. It applies a weighted 48-sample Gaussian disk filter to that background, composites the actor texture over it, and applies an antialiased rounded-rectangle mask. Opaque text remains opaque. Shell surfaces use their theme's actual four corner radii; clipping bounds the material's paint volume. The previous clip state is restored when changing effects or disabling Prism.

This is separate from wrapping a clipping effect around Shell.BlurEffect: that can redirect the actor before the background is sampled, leaving the blur with an empty buffer to sample. The built-in rectangular blur remains in use for square Shell surfaces. Unknown Shell shapes keep the no-blur fallback.

Application materials use the same renderer on a dedicated backdrop actor, leaving the actual client surface and shadows alone. Client silhouettes are not available through this integration. **Application backdrop corner radius** defaults to 12 px and can be adjusted to match a client's corners. This is a configurable approximation, not automatic per-app shape detection.

Capture/allocation failures are caught, reported once per effect, and fall back to native translucent paint. Native compositor rendering, multiscreen orientation, animated surfaces, fractional scaling, and interactions with other effects still need live verification. Sampling cost grows with active blurred area; focused-window mode limits work.

## GTK item menus

The managed GTK stylesheet now targets `popover.menu.background > contents` and defines the native popover palette variables. Transparent wrapper rules prevent nested default backgrounds from masking the material. It also styles both legacy `modelbutton` and current `button.model` row nodes. GTK documents the modern row structure in its [PopoverMenu CSS node reference](https://docs.gtk.org/gtk4/class.PopoverMenu.html#css-nodes).

Match GTK4 app menus must be enabled, and GTK4 apps must fully restart to reload the stylesheet after upgrading. App-menu CSS uses the selected appearance and Shell background opacity. It does not add a toolkit blur effect. A GTK popup embedded in an app surface is not independently addressable by the Shell renderer, so its menu remains dark/translucent even when the Shell window menu has its own live frost.

## Install and try

```sh
make package
gnome-extensions install --force dist/prism@local.shell-extension.zip
```

Log out/in to load the new extension. In preferences:

1. Keep **Preserve native rounded corners** on.
2. Enable **Rounded frosted glass**.
3. Choose **Frosted** or **Soft** and keep the desired Shell surface switches on.
4. Enable **Match GTK4 app menus**, then fully restart Files to load the corrected dark menu CSS.

A very solid fill can conceal most of the background detail even with blur active. Try Shell background opacity around 65–75% when assessing the frost, then adjust to taste. Application windows have their own opacity control. Sidebar-only mode still preserves opaque content.

If rounded frost causes rendering issues, turn it off to keep the earlier corner-safe translucent fallback. That switch does not change the native theme or the managed GTK menu styling.

## Evidence

- The GObject subclass imports and registers against the installed GNOME 50 Shell/Mutter typelibs.
- The capture tests cover GPU storage reuse, capture before redirection, coordinate/scale handling, partial offscreen bounds, uniform shapes, and failure fallback.
- A surfaceless Mesa GLES2 test compiles and executes the actual shader snippet. On a sharp test pattern, central pixel-detail deviation falls from 127.5 to 19.1. Corners are transparent, the center remains filled, opaque foreground stays opaque, and paint opacity is not applied twice.
- GTK's installed CSS parser accepts the corrected menu stylesheet in light and dark variants.

Run `make check-frost-gpu` for the isolated shader pixel test. It requires EGL/GLES2 with a surfaceless Mesa software renderer. These checks do **not** establish that framebuffer capture, texture orientation, or effect composition works in a live GNOME session; that remains unverified because this environment cannot connect to the desktop.

## Version 10: GNOME 50 stage-view compatibility fix

Live journal evidence from this machine showed that enabling corner preservation selected rounded frost, but every capture failed with `TypeError: context.get_stage_view is not a function`. That method exists in Mutter's C implementation but is not exposed by the installed Clutter.PaintContext typelib. The previous mock context incorrectly supplied it, so the failure was missed.

The renderer now uses the public actor.peek_stage_views() API and matches the current paint framebuffer against those views. This provides monitor layout and scale without the unavailable PaintContext method. Unknown framebuffers still take the explicit safe fallback rather than guessing a monitor.

Regression tests now use a PaintContext without get_stage_view, cover matching among multiple scaled views, and check unmatched/offstage behavior. `make check-runtime-api` checks every required public capture/pipeline method against the installed GNOME 50 typelibs without constructing a graphics context. The shader's actual software GPU pixel test also passes. Live end-to-end rendering after this update remains unverified until the new package is loaded on the desktop.

## Version 11: keep visual clipping separate from input

The rounded renderer explicitly forwards native pointer picking and no longer changes clip-to-allocation on existing Shell controls. Shader masking remains visual. Native window surfaces are identified by actual Mutter GObject type rather than child position, and decorative backdrops never contribute pick geometry. See [input isolation and diagnostic limits](INPUT.md). Earlier references to changing a Shell control's clip flag are superseded by this update.

## Version 12: capture offscreen popup targets

The StageView framebuffer matching added in version 10 was still too restrictive. Live logs showed that nested offscreen popup/animation buffers failed that check. The renderer now projects actor-local coordinates through the current framebuffer's modelview/projection matrices and viewport; the shader receives a sampling basis rather than a monitor-only rectangle. See [popup fixes and validation](POPUPS.md). Earlier statements requiring StageView identity matching are superseded.
