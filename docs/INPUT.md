# Input isolation — version 11

A front window receiving pointer input intended for it is independent of how translucent its pixels are. A user report of the underlying window reacting is a possible click-through/input-targeting problem. Prism must not turn visible client content into an input hole or put decorative actors into the pointer target path.

This update hardens three areas:

- Decorative backdrops use a dedicated VisualBackdrop class with no pick geometry. They remain non-reactive, cannot take keyboard focus, and do not track hover.
- Rounded frost explicitly forwards the native pick context; its visual alpha mask does not act as an input mask.
- Prism no longer changes clip-to-allocation on existing Shell controls. Such clipping also affects native picking and can cut off descendants. The shader still masks visual output; external shadows/paint-volume mapping need further live validation.

The application opacity code also no longer assumes the first child is the client surface. Other extensions and compositor-owned decorations can occupy that position. It locates Mutter's Wayland surface container or X11 surface actor by its actual native GObject type. Unknown layouts are left unchanged. The client surface's input region, reactivity, focus handling, and event dispatch are not rewritten.

The preferences action also now handles GNOME's void-returning openPreferences API; the journal showed a separate TypeError from assuming a Promise return.

## Validation and remaining diagnosis

Tests verify native surface selection with a preceding decoration, no pick geometry from decorative backdrops, no decorative hover/focus capability, forwarding the original pick context exactly once, unchanged native Shell clipping, and preservation of the existing material lifecycle. Required picking APIs are checked against this machine's installed GNOME/Mutter typelib. These tests pass, but do not reproduce a live two-window input sequence.

The exact cause of the reported intermittent issue is **not confirmed**. If it persists after installing the updated package and logging out/in, distinguish actual click/scroll delivery from seeing an underlying hover state through the glass. Whether it happens in content, only at corners, or while a popup is open is needed to narrow it down. Native client-declared input holes and areas outside rounded client shapes must retain their original behavior; Prism does not replace them with a blanket rectangular input region.
