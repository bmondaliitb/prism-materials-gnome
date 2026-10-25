# Version 25: workspace animation cost

GNOME 50 workspace slides paint Clutter.Clone instances of windows. Changing clone transforms previously bypassed the backdrop frame limit and caused fresh captures/filtering throughout the animation. Animation/screenshot clone paints can also supply projection matrices unsuitable for live capture; the inspected Shell journal included an Invalid backdrop projection error from this path. Actual compositor frame times could not be measured here.

Smooth workspace transitions defaults on. A before-paint observer reads GNOME 50's workspace animation controller state (including keyboard switches, gestures, and cancellation). On state changes only, it freezes custom frost on its existing material image, pauses the native panel blur, suspends Prism's owned DISABLE_CLIPPED_REDRAWS flag, and defers window material rebuilds caused by changing focus/geometry. Live capture and native panel blur resume after motion and a fresh capture is forced. Saved appearance settings are unchanged. There is no frame timer for this feature and no wrapping/replacement of Shell animation methods.

This depends on the private GNOME 50 controller `_workspaceAnimation._switchData`; if unavailable the observer stays inactive. Independently, clone paints always reuse their last capture rather than reading live backdrop matrices. A clone with no prior capture uses the native/translucent fallback during motion. Frozen material can look less responsive during the slide, and the top bar temporarily uses plain translucent tint. The native animation itself is retained.

Tests cover zero new capture/filter work across simulated motion paints, native panel pause/restoration, full-redraw flag suspension/restoration, deferred window styling, cancellation/end policy, and unchanged quality preferences. Live gesture/frame-rate verification remains necessary on the desktop.

# Version 24: 4K rendering improvements

Custom FrostEffect now captures its backdrop before chaining into the native offscreen paint path. It no longer forcibly marks the foreground ACTOR_DIRTY every paint, allowing GNOME to reuse unchanged foreground textures. Actual foreground changes still use the compositor's supplied dirty flag.

Backdrop refresh limit defaults to 30 fps, with 0 for unlimited and a range up to 60. Stationary custom frost reuses captured and filtered backgrounds inside that interval. Geometry, transform, scale, blur radius, and rendering quality changes bypass the limit. One shared trailing refresh requests the last background update if no later external frame arrives; a shared epoch makes all custom effects refresh together to avoid mutual timer feedback. This is not a continuous animation loop. Rapidly moving surfaces still capture at the compositor rate to avoid dragging stale images across the desktop. This limit does not throttle native top-bar blur or the foreground frame rate.

Each effect retains up to four framebuffer capture/filter records. Alternating monitor targets, including differently scaled monitors, can reuse their own storage instead of repeatedly reallocating one texture. This trades some retained GPU memory for fewer allocations; the cache is bounded, not desktop-wide or persistent after effect collection.

The **4K / integrated GPU preset** is opt-in and sets Eco, 30 fps, Focused window only on, Gentle tint transitions off, and Top bar blur off. The top bar keeps its neutral tint and foreground colors. Stable backdrop redraws remains unchanged: disabling clipping is still costly on 4K, but removing that workaround can reintroduce partial-frame artifacts. These improvements do not remove full-resolution capture/compositing cost. No live GPU timings or frame-rate guarantee are available.

Tests exercise capture limiting, unchanged foreground flags, immediate geometry/quality invalidation, final refresh without timer feedback, per-framebuffer storage reuse, and native-panel blur removal. A simulated 120 stationary paint requests over one second performs about 30 captures; this is a code-path count, not a measured desktop benchmark. All blur-profile shader tests remain in place.

# Version 22: suppressing text-band artifacts

Blur uses successive 2× downsample passes rather than jumping directly to a coarse texture. Its final reduction also accounts for blur radius and tap count so Gaussian taps do not skip whole reduced-image texels. This reduces aliasing and repeated text-row bands without increasing sample count per directional blur pass. The final Gaussian targets remain within the selected quality budget, but early prefilter targets can be larger than that budget (up to about a quarter of capture area); more small render passes and intermediate storage are the tradeoff for better filtering.

Background detail reduction blends the filtered background toward a neutral material color in the final shader, with no extra texture fetch or pass. It defaults to 25%, ranges from 0–80%, and affects custom rounded frost only. It does not alter opaque foreground pixels, native top-bar blur, or no-blur mode. Dense terminal-like row patterns are covered by GPU pixel tests for all quality levels. Live screenshot matching is still unverified.

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
# Battery and Power Saver policy (version 31)

With **Automatic comfort** enabled, simply unplugging no longer forces focused-window-only materials. Battery operation keeps every enabled/eligible window's translucency, uses Eco rendering, and caps custom backdrop refresh at 20 fps. Power Saver is detected separately from the power profile and also applies when plugged in: custom refresh is capped at 12 fps, only the focused window and its focused transient children retain live window blur, and other eligible windows retain their translucent tint without capture. The top bar and dock keep tint but remove their persistent blur in Power Saver. Transient Shell menus/dialogs retain bounded Eco blur at the effective refresh cap; lightweight overlays remain tint only.

These policies preserve saved rendering quality, refresh limit, opacity, window selection, and top-bar/dock blur preferences. Explicit **Focused window only** still restricts which windows receive materials; turn it off to enable background-window materials. Manual Translucency only remains blur-free. A saved refresh limit below the automatic cap is retained; unlimited is capped while automatic saving applies. Leaving battery/Power Saver restores the saved settings' behavior. Turning Automatic comfort off bypasses these automatic adjustments.

The caps apply to stationary custom framebuffer captures, not app rendering, window movement, native panel blur, or desktop frame rate. Geometry changes can still require immediate recapture. Native overview/lock wallpaper blur remains cached and follows Eco quality; it does not gain a live screen capture. Ordinary battery mode still permits native panel blur if enabled. Full-monitor redraw protection remains necessary for live frost and can still cost bandwidth at 4K; this update is a policy improvement, not a measured power-consumption guarantee.

Tests cover independent UPower/profile detection, battery materials on background windows, Power Saver tint without capture/culling protection, focused-window refresh caps, manual settings, AC restoration, and panel/dock/menu policy changes. Live battery draw and desktop smoothness remain unverified.

## Cached frost (version 32)

Choose **Rendering level → Cached frost · frozen background** for genuine blurred backdrops without continuously refreshing their content. This uses the existing Eco-sized filter and caches its result per framebuffer/geometry. Elapsed time, unrelated background content changes, and other effects' shared refresh epochs do not trigger new captures or filters. No trailing refresh timer is scheduled for a frozen snapshot. Window focus changes, geometry/scale/blur changes, recreated windows, and reopened Shell popups refresh the relevant snapshot. Moving/resizing can still require fresh captures each frame; this mode primarily reduces stationary-window work.

Scrolling content, video, or changing apps behind a stationary window will not update its cached backdrop until one of those refresh events. Foreground apps keep rendering and receiving input normally. Soft/Clear/Frosted material finishes still control the app tint, so Soft can be combined with Cached frost. Translucency only remains the absolute lowest-cost option because it removes both blur and backdrop capture. Cached frost performs initial captures and filtering and still needs normal compositing.

The top bar retains tint with native live blur disabled in this mode. Overview and lock wallpaper blur use their existing native cached path at Eco quality. Shell surfaces using custom frost freeze their snapshots. Battery keeps the cached policy; explicit Power Saver still removes background-window blur and panel/dock blur. Switching to Eco/Balanced/High resumes live backdrop updates without rewriting other preferences.

Stable backdrop redraw protection remains enabled when selected and frosted surfaces are mapped, preserving the earlier fix for square trails. It can still cause full-monitor painting during updates, so this feature reduces capture/filter work rather than eliminating all compositor costs. Tests cover reuse over 120 simulated paints and shared epochs, no frozen refresh timers, explicit invalidation, blur-setting changes, live-mode restoration, popup reopen, and rendering-policy integration. Actual GPU power draw remains unmeasured.
