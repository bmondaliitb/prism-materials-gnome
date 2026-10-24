# Version 17: stable backdrop redraws

The earlier window-level culling guard does not disable monitor-level clipped redraws. The remaining hover patches are consistent with reading pixels outside the current monitor damage clip. Version 17 adds **Comfort and behavior → Stable backdrop redraws**, enabled by default, as a compatibility workaround.

While at least one Prism frosted actor is mapped, the mode enables Clutter's `DISABLE_CLIPPED_REDRAWS` draw flag. Frames repaint completely instead of combining partial redraws with old composited framebuffer tiles. No animation timer, idle repaint loop, or continuous-redraw flag is used. Changing guard state queues a single full redraw to clear existing patches. Switching off blur, hiding the last frosted actor, disabling this setting, or disabling Prism releases the flag if Prism set it. Pre-existing and unrelated flags are preserved. Draw flags are process-global; extensions independently changing this same flag while Prism owns it cannot be coordinated by Clutter's non-reference-counted API.

This affects all monitors while active and can increase GPU bandwidth on updates, especially for a permanently frosted top panel. Eco limits blur filtering cost but does not remove the cost of full repaints. Turn this setting off to restore damage clipping, or select Translucency only to avoid capture entirely. There is no change to pointer picking or window input regions.

Lifecycle tests verify mapped/hidden actors, multiple surfaces, no repeated repaint requests, live setting changes, disable cleanup, and preservation of existing flags. Runtime checks confirm the required API exists. Live hover rendering remains unverified here; this workaround addresses the partial-frame sampling path rather than claiming all possible compositor artifacts are eliminated.

# Version 16: hover redraw improvements

Hover/theme notifications previously queued redraws on all styled Shell surfaces even when no material parameter changed. Window refreshes similarly invalidated their backdrop unconditionally. Version 16 compares the material parameters before explicitly queuing redraws. Native hover painting and live backdrop capture on compositor paints remain active.

Version 16 also removes the 64-pixel capture expansion introduced in version 13. Pixels outside the actual effect bounds may not have been repainted in the current frame, so including them in the blur can introduce stale colors or visible redraw patches near edges. Captures now use their exact bounds. Stable geometry still reuses textures; resizing may allocate more often, a tradeoff for sampling valid bounds.

Regression tests cover hover notifications without unrelated material invalidation, parameter changes that still repaint, and capture bounds without extra padding. Shader and runtime API checks also pass. Live GNOME hover behavior has not been reproduced or verified from this workspace.

# Version 14: selectable rendering levels

Version 15 adds a lightweight effect to each top-level window actor while its live frost capture is active. Mutter's culling pass treats actors with effects as backdrop-dependent and avoids propagating partial redraw clips through them. This prevents old framebuffer tiles appearing as dark square trails after windows move or update. The guard does no drawing and creates no framebuffer; it does require Mutter to repaint the obscured content needed by the blur. It is removed with the frost effect and is never installed in Translucency-only mode.

Choose **Material → Rendering level** in preferences. Eco is the new default, including for existing installations that have not set this new preference. No other settings are reset. Once version 14 is loaded, level changes apply live.

| Level | Minimum reduction per dimension | Maximum blur pixels per surface | Samples per directional pass |
| --- | --- | --- | --- |
| Eco | 8× | 65,536 | 5 |
| Balanced | 4× | 262,144 | 9 |
| High | 2× | 524,288 | 9 |
| Translucency only | No capture or blur | 0 | 0 |

Eco trades fine background detail for lower filter cost. Balanced matches version 13's rounded blur. High retains more detail at greater GPU cost. All blur levels keep foreground and rounded-edge compositing at native resolution. Square Shell surfaces now use the same bounded renderer, so the selection applies to panels as well as rounded menus and app backdrops. Corner-safety settings still take precedence when a surface shape is unknown.

Translucency only removes the capture effects on windows and Shell surfaces while keeping their tint/opacity styling. GTK app menu CSS is unchanged by rendering level; embedded GTK menus still do not have an independent blur.

These are per-surface budgets, not a desktop-wide cost limit. Full-resolution capture and compositing still cost GPU bandwidth in all blur modes. Many overlapping windows can remain expensive; **Focused window only** reduces app backdrop count. No frame-rate guarantee has been measured on the live integrated GPU. Tests cover each shader profile, target budgets, live profile changes, and removal/restoration of effects in no-blur mode.

Install the version 14 package, then log out/in once to load its new code and settings schema.

---

# Version 13: bounded blur work

Rounded frost previously performed a 48-sample disk blur at full display resolution on every paint. This multiplied texture fetches across large or overlapping windows, including on high-DPI monitors. Its shader also evaluated trigonometric functions and exponentials per fragment.

The new renderer captures the live backdrop, downsamples in two stages, and applies separate horizontal and vertical 9-tap Gaussian passes. Each blur target is at most 262,144 pixels. Reduction starts at 4× per dimension and increases automatically for larger captures. The final native-resolution composite makes one filtered backdrop lookup; foreground text and rounded-edge coverage remain full resolution. Gaussian weights are precomputed.

At 4× reduction, the four preparation passes plus final backdrop lookup use approximately 3.375 texture samples per full-size pixel, compared with 48 previously. This is a work-count estimate, **not a measured desktop speedup**. Framebuffer copies, foreground painting, driver overhead, and other extensions still cost time. Rounded frost retains live updates; it does not freeze or throttle the background. Its texture is deliberately softer at small radii because of downsampling; radius zero bypasses the filters.

Version 13 rounded capture storage to 64-pixel increments to reduce allocations during resizing. Version 16 removes this expansion because pixels outside the effect bounds can be stale during partial redraws. Filter targets and pipelines are reused, and final shader uniform locations are cached.

Other fixes:

- Focus changes no longer read GTK configuration files or rescan Shell surfaces.
- Unchanged generated GTK CSS does not perform file IO on unrelated settings changes. Disable still removes owned styles.
- Menu-row hover changes do not trigger a scan of every watched Shell actor.
- Prism's own inline style writes do not schedule redundant refreshes.
- Moving a window does not reapply unchanged backdrop CSS.

Validation: `make check`, `make check-runtime-api`, and `make check-frost-gpu`. Tests cover actual GLSL compilation and multi-pass rendering on surfaceless Mesa, broad-edge blur in both directions, rounded alpha, foreground opacity, buffer reuse, high-resolution pixel budgets, and refresh behavior. These do not measure GNOME frame times or prove integration with the live compositor. In version 13, native Shell.BlurEffect for square surfaces was unchanged; version 14 replaces it with the budgeted renderer.

Install `dist/prism@local.shell-extension.zip` with `gnome-extensions install --force`, then log out/in to load version 13. Existing settings are preserved. For desktops still under heavy load with many translucent windows, **Focused window only** reduces the number of simultaneous app backdrops; **Reduce transparency** suspends materials immediately.
