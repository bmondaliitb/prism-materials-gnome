# Popup consistency fixes — version 12

The journal showed repeated rounded-frost fallback errors: `Could not match the current framebuffer to an actor stage view`. Some popup and animation surfaces render into nested offscreen buffers. These buffers are not monitor framebuffers, so the prior identity check rejected them and left only clear/translucent paint.

Version 12 computes capture coordinates from the active framebuffer's modelview matrix, projection matrix, and viewport. It projects the actor's local corners into the current render target, captures the valid bounds, and supplies the background sampling basis to the shader. This removes the StageView matching requirement and supports translated/scaled offscreen targets without guessing a monitor origin. Capture failure still falls back safely and is logged; live native composition remains unverified.

A separate Shell-menu problem was possible with third-party popups: clearing a BoxPointer's backing without finding a recognized replacement content actor could leave a clear menu. Prism now clears that backing only when a known content surface exists. Otherwise it tints the native BoxPointer paint directly, preserving its shape and foreground. If a replacement surface appears or disappears, Prism updates that ownership decision. Unknown pointer-backed menus get matching tint, but no unverified rounded blur geometry is imposed on their custom shape.

The GTK journal also showed Snap apps trying to import a missing `prism-managed-menus.css` beside a copied GTK stylesheet. Prism now embeds its owned menu rules in a marked block in `gtk.css` instead of relying on that relative import. Existing import-based installations migrate automatically and existing user rules are preserved. The generated file remains for inspection, but the active block has no file dependency. This helps apps that forward/copy user gtk.css; it does not grant sandbox access to host configuration.

## Upgrade

Install the updated `dist/prism@local.shell-extension.zip` and log out/in so the new modules load. Keep the desired popup/menu switches and Match GTK4 app menus enabled. Fully restart GTK apps to load the updated self-contained stylesheet.

Shell menus, separate compositor-managed app popups, and toolkit-embedded menus remain distinct paths. Embedded GTK menus receive matched tint/style without their own Shell blur. Qt, Electron, GTK3, and custom app menu implementations are not universally themed by the GTK4 stylesheet. Independent popup/window/Shell opacity settings are still respected.

## Tests

Regression checks cover a framebuffer that is deliberately not a StageView, offscreen coordinate transforms using real Graphene matrices, scaling, GPU texture reuse, and capture failure. The actual GLSL pixel test still shows detail deviation dropping from 127.5 to 19.1 with transparent rounded corners and preserved foreground alpha.

Shell tests cover a wrapper without recognized content, adding a content surface later, and removing it again: none of those states may leave the menu without either native tinted backing or a Prism material. GTK tests cover inline-style generation, migration from the old import, preservation of user edits, and parsing the complete self-contained stylesheet.

These checks confirm the corrected branches and shader math. They do not prove that every right-click menu on the desktop now matches; real-app rendering still needs confirmation after reloading the extension.
