# Lock screen and Ubuntu login screen (version 29)

These are separate Shell sessions. Prism runs in the user's normal and `unlock-dialog` modes. The boot/logout greeter belongs to the GDM account and uses a small, separately installed companion. GNOME's [session-mode documentation](https://gjs.guide/extensions/topics/session-modes.html) describes the user/unlock lifecycle.

## Lock screen: Super+L

Install the normal extension package and log out/in once. The unified materials include the lock screen. The clock page shows the native desktop wallpaper with blur radius zero and brightness one. GNOME's background manager continues handling wallpaper changes, dark/light wallpaper selection, and monitors, using the same source as the desktop. No desktop windows are captured or revealed.

When the native password panel appears, its backing becomes a dark 70% translucent rounded card. Text, fields, gestures, verification, keyboard focus, and native opacity animations remain controlled by GNOME. The existing wallpaper blur is reused at 18 logical px, multiplied by the native resource scale. The removed quality ladder is no longer consulted. There is no added effect, blur animation, per-frame update, or repeating timer.

The feature follows global enable, Reduce transparency, and automatic high-contrast handling. Suspending materials restores native wallpaper filtering and owned panel styles. Later external inline styles are preserved. Monitor/scale updates and recreated lock dialogs are handled through native signals. Prism's desktop indicator is hidden while locked; desktop window and overview materials remain suspended.

## Boot/logout login: Ubuntu GDM

The optional installer supports the Ubuntu 26.04 / GNOME 50 installation inspected here, which exposes `com.ubuntu.login-screen` wallpaper settings. It does not patch system themes, authentication, PAM, or GNOME source. Other distributions are not supported by this helper.

Prepare a bundle **as your normal desktop user**, so it selects the correct light/dark wallpaper:

```sh
/usr/bin/python3 tools/login-material.py --prepare dist/prism-login-setup
```

A bundle was prepared during development; if it already exists, install that one or choose a new output directory. Use `--wallpaper /absolute/path/to/image.jpg` to select an explicit image. Preparation reads the selected wallpaper setting and copies the image and companion extension into the bundle. It changes no system settings. Local image files are supported; slideshow XML, remote URIs, and solid-color-only desktops require an explicit image.

Install the prepared bundle **from this repository directory**:

```sh
sudo /usr/bin/python3 tools/login-material.py --install dist/prism-login-setup
```

This privileged step cannot run from the restricted development workspace. It copies the image to `/var/lib/prism-login-material/wallpaper`, installs the minimal `prism-login@local` companion under `/usr/share/gnome-shell/extensions`, and adds an owned `/usr/share/gdm/dconf/99-prism-materials` defaults file. It compiles `/var/lib/gdm3/greeter-dconf-defaults`, matching the layout used by Ubuntu's `/usr/share/gdm/generate-config`. Other defaults files remain untouched, and existing system-default extension entries are preserved.

The installer reads and validates the compiled defaults through an isolated read-only profile, then replaces the compiled database atomically. It does not write through a GDM session bus, change account permissions, signal services, or restart the login manager. Changes appear on the next boot/login screen. Explicit per-seat user overrides can take precedence over system defaults; this helper leaves that user database untouched.

The first version of this helper tried to write the old static `gdm` account's home settings. That was incompatible with the dynamic greeter and per-seat configuration used by current GDM. The corrected installer bypasses that mechanism entirely; failures now include subprocess stderr. A failed original attempt that cleaned up its directories can be retried with the same install command. If an incomplete or legacy installation exists, the installer refuses to overwrite it.

The greeter shows the same image file, with cover sizing for a zoomed desktop wallpaper or contain sizing for a scaled one. Crop can differ across monitor arrangements because Ubuntu's greeter uses a single CSS background. The password card uses the same dark 70% translucent fill as the lock screen, with no extra blur or screen capture. Native high-contrast mode restores the card's original styling. The GDM wallpaper is a snapshot, not a live cross-account sync: prepare a new bundle and remove/reinstall to change it later. Lock-screen wallpaper updates remain automatic.

Undo the greeter change:

```sh
sudo /usr/bin/python3 tools/login-material.py --remove
```

Removal deletes the unchanged owned defaults file and recompiles all remaining current defaults, preserving changes made in other configuration files since installation. It then removes the owned companion and image. If compilation fails, the defaults file is restored and the installation remains intact. Externally edited or symlinked owned files are refused rather than overwritten. The previous/current administrator-configured GDM background returns at the next boot/login screen. The greeter companion is independent of the desktop extension; switching off the latter does not uninstall the former.

## Verification

Tests cover clock/prompt states, untouched prompt opacity, native blur reuse, quality caps, scale/monitor changes, settings/accessibility restoration, dialog destruction, pending-idle cleanup, and the companion's dynamic prompt/high-contrast lifecycle. Installer tests compile real dconf databases and read actual GNOME/Ubuntu settings through isolated profiles in temporary directories. They check install/remove, preserved defaults and external changes, validation before atomic replacement, install/remove failure recovery, refusal of unowned/symlinked directories, and subprocess diagnostics. JavaScript syntax, installed GI APIs, and all existing checks pass. Live lock rendering, authentication interaction, and a real privileged GDM installation remain unverified in this workspace.
