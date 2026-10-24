#!/usr/bin/python3
"""Prepare as the desktop user; install/remove separately as root on Ubuntu GDM."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from gi.repository import Gio, GLib

REPO = Path(__file__).resolve().parent.parent
STATE = Path('/var/lib/prism-login-material')
EXTENSION = Path('/usr/share/gnome-shell/extensions/prism-login@local')
UUID = 'prism-login@local'
MARKER = '.prism-login-owned'
FILES = ('metadata.json', 'extension.js')
SOURCES = Path('/usr/share/gdm/dconf')
DATABASE = Path('/var/lib/gdm3/greeter-dconf-defaults')
DROPIN = '99-prism-materials'


def is_image(path):
    path = Path(path)
    if not path.is_file():
        return False
    with path.open('rb') as stream:
        content_type, _uncertain = Gio.content_type_guess(None, stream.read(4096))
    return content_type.startswith('image/')


def prepare(destination, wallpaper=None):
    if os.geteuid() == 0:
        raise RuntimeError('Prepare as your desktop user, so the correct wallpaper is selected.')
    settings = Gio.Settings.new('org.gnome.desktop.background')
    interface = Gio.Settings.new('org.gnome.desktop.interface')
    key = 'picture-uri-dark' if interface.get_string('color-scheme') == 'prefer-dark' else 'picture-uri'
    source = Path(wallpaper) if wallpaper else Gio.File.new_for_uri(settings.get_string(key)).get_path()
    if not source or not is_image(source):
        raise RuntimeError('Choose a local image with --wallpaper; slideshow XML and remote images are not supported.')
    destination = destination.resolve()
    if destination.exists():
        raise RuntimeError(f'{destination} already exists; choose a new bundle directory.')
    destination.mkdir(parents=True)
    for name in FILES:
        shutil.copyfile(REPO / 'integration/login' / name, destination / name)
    shutil.copyfile(source, destination / 'wallpaper')
    mode = settings.get_string('picture-options')
    size = 'contain' if mode == 'scaled' else 'auto' if mode in ('centered', 'wallpaper') else 'cover'
    (destination / 'config.json').write_text(json.dumps({'size': size}) + '\n')
    print(f'Prepared {destination}\nSelected wallpaper: {source}\nNo system settings changed.')


def command(*args, env=None):
    try:
        result = subprocess.run(args, env=env, cwd='/tmp', check=True, text=True,
                                capture_output=True, timeout=30)
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or 'No error details returned.').strip()
        raise RuntimeError(f'{Path(args[0]).name} failed (exit {error.returncode}): {detail}') from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f'{Path(args[0]).name} timed out after 30 seconds.') from error
    return result.stdout.strip()


def setting(schema, key, database=None):
    # Read the compiled system defaults through an isolated profile. Neither a
    # running greeter, a writable GDM home nor a session bus is required.
    with tempfile.TemporaryDirectory(prefix='prism-greeter-read-') as directory:
        root = Path(directory)
        profile = root / 'profile'
        profile.write_text(f'user-db:user\nfile-db:{database or DATABASE}\n')
        env = os.environ.copy()
        env.update(DCONF_PROFILE=str(profile), XDG_CONFIG_HOME=str(root),
                   XDG_RUNTIME_DIR=str(root), GSETTINGS_BACKEND='dconf')
        env.pop('DBUS_SESSION_BUS_ADDRESS', None)
        return unpack(command('/usr/bin/gsettings', 'get', schema, key, env=env))


def compile_database(expected=None):
    # Follow Ubuntu's generate-config layout, with an atomic compiled-file
    # replacement. Do not call generate-config: it also signals live services.
    original = DATABASE.stat() if DATABASE.exists() else None
    with tempfile.TemporaryDirectory(prefix='.prism-compile-', dir=DATABASE.parent) as directory:
        output = Path(directory) / 'database'
        command('/usr/bin/dconf', 'compile', str(output), str(SOURCES))
        for (schema, key), value in (expected or {}).items():
            if setting(schema, key, output) != value:
                raise RuntimeError(f'Compiled greeter setting did not match: {schema} {key}')
        output.chmod(0o644)
        if original:
            os.chown(output, original.st_uid, original.st_gid)
        os.replace(output, DATABASE)


def variant(value, kind='s'):
    return GLib.Variant(kind, value).print_(True)


def unpack(value):
    expected = GLib.VariantType.new('as') if value.strip() == '[]' else None
    return GLib.Variant.parse(expected, value, None, None).unpack()


def owned(directory):
    if directory.is_symlink() or not (directory / MARKER).is_file():
        raise RuntimeError(f'Refusing to change unowned or linked directory: {directory}')
    if any(path.is_symlink() for path in directory.iterdir()):
        raise RuntimeError(f'Refusing linked contents in {directory}')


def install(bundle):
    dropin = SOURCES / DROPIN
    if any(path.exists() or path.is_symlink() for path in (STATE, EXTENSION, dropin)):
        raise RuntimeError('An installation or conflicting directory exists; remove the owned installation first.')
    schema = Gio.SettingsSchemaSource.get_default().lookup('com.ubuntu.login-screen', True)
    if not schema or not schema.has_key('background-picture-uri') or not SOURCES.is_dir():
        raise RuntimeError('Ubuntu greeter wallpaper settings are unavailable.')
    metadata = json.loads((bundle / 'metadata.json').read_text())
    if metadata.get('uuid') != UUID or metadata.get('session-modes') != ['gdm']:
        raise RuntimeError('Invalid greeter companion bundle.')
    if not is_image(bundle / 'wallpaper'):
        raise RuntimeError('Invalid wallpaper image.')
    size = json.loads((bundle / 'config.json').read_text())['size']
    if size not in ('cover', 'contain', 'auto'):
        raise RuntimeError('Invalid background size.')
    enabled = list(dict.fromkeys([*setting('org.gnome.shell', 'enabled-extensions'), UUID]))
    disabled = [item for item in setting('org.gnome.shell', 'disabled-extensions') if item != UUID]
    wallpaper = (STATE / 'wallpaper').as_uri()
    contents = ('# Managed by Prism Login Material; remove with tools/login-material.py --remove\n'
                '[com/ubuntu/login-screen]\n'
                f'background-picture-uri={variant(wallpaper)}\n'
                f'background-size={variant(size)}\n'
                "background-repeat='no-repeat'\n\n"
                '[org/gnome/shell]\n'
                f'enabled-extensions={variant(enabled, "as")}\n'
                f'disabled-extensions={variant(disabled, "as")}\n'
                'disable-user-extensions=false\n')
    # Validate the bundle and read existing defaults before system mutation.
    STATE.mkdir(mode=0o755)
    (STATE / MARKER).touch()
    EXTENSION.mkdir(mode=0o755, parents=True)
    (EXTENSION / MARKER).touch()
    try:
        shutil.copyfile(bundle / 'wallpaper', STATE / 'wallpaper')
        (STATE / 'wallpaper').chmod(0o644)
        for name in FILES:
            shutil.copyfile(bundle / name, EXTENSION / name)
            (EXTENSION / name).chmod(0o644)
        snapshot = STATE / 'settings.json'
        snapshot.write_text(json.dumps({'backend': 'ubuntu-system-defaults', 'dropin': contents}))
        snapshot.chmod(0o600)
        with dropin.open('x') as stream:
            stream.write(contents)
        dropin.chmod(0o644)
        compile_database({('com.ubuntu.login-screen', 'background-picture-uri'): wallpaper,
                          ('com.ubuntu.login-screen', 'background-size'): size,
                          ('org.gnome.shell', 'enabled-extensions'): enabled,
                          ('org.gnome.shell', 'disabled-extensions'): disabled,
                          ('org.gnome.shell', 'disable-user-extensions'): False})
    except Exception:
        # Compilation commits atomically only after validation. On failure the
        # previous database remains intact, with no session settings to undo.
        if dropin.exists() and not dropin.is_symlink() and dropin.read_text() == contents:
            dropin.unlink()
        shutil.rmtree(EXTENSION)
        shutil.rmtree(STATE)
        raise
    print('Installed. Takes effect at the next boot/login screen. GDM was not restarted.')


def remove():
    owned(STATE)
    owned(EXTENSION)
    snapshot = json.loads((STATE / 'settings.json').read_text())
    if snapshot.get('backend') != 'ubuntu-system-defaults':
        raise RuntimeError('Legacy installation found; its saved settings were preserved for manual recovery.')
    dropin = SOURCES / DROPIN
    if dropin.is_symlink() or not dropin.is_file() or dropin.read_text() != snapshot['dropin']:
        raise RuntimeError(f'Refusing to remove a missing or externally edited drop-in: {dropin}')
    dropin.unlink()
    try:
        compile_database()
    except Exception:
        dropin.write_text(snapshot['dropin'])
        dropin.chmod(0o644)
        raise
    shutil.rmtree(EXTENSION)
    shutil.rmtree(STATE)
    print('Removed owned files and recompiled current greeter defaults. GDM was not restarted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--prepare', type=Path, metavar='BUNDLE')
    action.add_argument('--install', type=Path, metavar='BUNDLE')
    action.add_argument('--remove', action='store_true')
    parser.add_argument('--wallpaper', type=Path, help='Optional explicit local wallpaper for --prepare')
    args = parser.parse_args()
    try:
        if args.prepare:
            prepare(args.prepare, args.wallpaper)
        else:
            if os.geteuid() != 0:
                raise RuntimeError('System installation/removal requires sudo; preparation does not.')
            install(args.install.resolve()) if args.install else remove()
    except (RuntimeError, OSError, ValueError, subprocess.CalledProcessError, GLib.Error) as error:
        print(f'Prism login: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
