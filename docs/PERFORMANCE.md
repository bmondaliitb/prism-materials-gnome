# Version 13: bounded blur work

Rounded frost previously performed a 48-sample disk blur at full display resolution on every paint. This multiplied texture fetches across large or overlapping windows, including on high-DPI monitors. Its shader also evaluated trigonometric functions and exponentials per fragment.

The new renderer captures the live backdrop, downsamples in two stages, and applies separate horizontal and vertical 9-tap Gaussian passes. Each blur target is at most 262,144 pixels. Reduction starts at 4× per dimension and increases automatically for larger captures. The final native-resolution composite makes one filtered backdrop lookup; foreground text and rounded-edge coverage remain full resolution. Gaussian weights are precomputed.

At 4× reduction, the four preparation passes plus final backdrop lookup use approximately 3.375 texture samples per full-size pixel, compared with 48 previously. This is a work-count estimate, **not a measured desktop speedup**. Framebuffer copies, foreground painting, driver overhead, and other extensions still cost time. Rounded frost retains live updates; it does not freeze or throttle the background. Its texture is deliberately softer at small radii because of downsampling; radius zero bypasses the filters.

Capture storage is rounded to 64-pixel allocation increments where the framebuffer permits, avoiding repeated large allocations during small resize steps. Extra captured pixels contain valid background. Filter targets and pipelines are reused, and final shader uniform locations are cached.

Other fixes:

- Focus changes no longer read GTK configuration files or rescan Shell surfaces.
- Unchanged generated GTK CSS does not perform file IO on unrelated settings changes. Disable still removes owned styles.
- Menu-row hover changes do not trigger a scan of every watched Shell actor.
- Prism's own inline style writes do not schedule redundant refreshes.
- Moving a window does not reapply unchanged backdrop CSS.

Validation: `make check`, `make check-runtime-api`, and `make check-frost-gpu`. Tests cover actual GLSL compilation and multi-pass rendering on surfaceless Mesa, broad-edge blur in both directions, rounded alpha, foreground opacity, buffer reuse, high-resolution pixel budgets, and refresh behavior. These do not measure GNOME frame times or prove integration with the live compositor. Native Shell.BlurEffect for square surfaces is unchanged.

Install `dist/prism@local.shell-extension.zip` with `gnome-extensions install --force`, then log out/in to load version 13. Existing settings are preserved. For desktops still under heavy load with many translucent windows, **Focused window only** reduces the number of simultaneous app backdrops; **Reduce transparency** suspends materials immediately.
