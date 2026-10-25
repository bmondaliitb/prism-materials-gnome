# Cached rendering and power — version 38

Prism has one bounded cached blur pipeline. A backdrop is captured before its decorative actor is redirected offscreen, progressively reduced in 2× steps, filtered with two separable five-tap passes, and composited with one backdrop sample at native resolution. The reduced target budget is 65,536 pixels with at least 8× reduction; radius-aware reduction prevents sparse samples from leaving text bands. Early downsample targets can be larger than the final budget.

Each effect keeps at most four framebuffer-specific capture/filter records, accommodating monitor and offscreen changes without repeatedly reallocating one buffer. Exact capture bounds, affine framebuffer projection, native popup alpha coverage, and per-corner masking preserve earlier redraw/corner fixes.

## Snapshot lifetime

Unchanged paints reuse the snapshot. Focus changes, menu reopening, geometry/scale changes and explicit invalidation capture a fresh image. The panel menu provides Refresh cached backgrounds. Material density changes update blending uniforms/styles without adding filter passes. Moving/resizing can still recapture every frame; stationary video or scrolling behind a window does not update its frozen backdrop.

The obsolete live-refresh clock, shared trailing timer, rate limits and selectable quality kernels are removed. Cached frost has no refresh timer. Static wallpaper blur in overview/lock uses GNOME's native ACTOR-mode cache; the top bar and short-lived overlays use tint only.

## Workspace motion and redraw protection

Workspace and clone paints reuse existing captures without reading animation framebuffer matrices. Window material changes are deferred during workspace motion. Broad redraw protection is suspended during the slide and restored afterward.

Redraw protection remains necessary: custom backdrop capture is not integrated with Mutter's damage tracking, so clipped updates can otherwise produce stale square tiles. While mapped frosted surfaces are present, Prism owns the clipped-redraw disable flag only if it added it, preserving flags that predate the extension. This can increase monitor repaint bandwidth at 4K. Cached filtering reduces capture/filter work, not all compositing costs.

## Power and accessibility

The default cached path is the same on battery and AC. Automatic power saving observes the explicit Power Saver profile: the focused window retains frost, background windows keep tint without capture, and the dock keeps tint without blur. Transient Shell menus retain their cached material. No unused battery-status proxy or live-blur fps cap remains.

Automatic high contrast and manual Reduce transparency restore native styles and app opacity. Disabling automatic power saving bypasses its Power Saver/high-contrast adjustments; manual Reduce transparency still works. Missing optional power-profile services are tolerated.

## Verification

`make check-frost-gpu` compiles the actual remaining shaders on surfaceless Mesa and tests corners, opacity, native popup margins/shadows/text, broad-edge blur, terminal-like patterns, and full opaque-app composition for every desktop preset. Unit checks cover cache reuse, storage bounds, projection/resize, clone safety, failures, uniforms, progressive targets, restoration, and Power Saver transitions. Tests are not live frame-time or power measurements.
