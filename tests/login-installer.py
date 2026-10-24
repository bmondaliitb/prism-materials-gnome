#!/usr/bin/python3
"""Compile and read real GDM defaults entirely in temporary directories."""
import importlib.util
import base64
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('login_material', 'tools/login-material.py')
login = importlib.util.module_from_spec(spec)
spec.loader.exec_module(login)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='prism-login-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bundle = self.root / 'bundle'
        with patch.object(login.os, 'geteuid', return_value=1000):
            image = self.root / 'source.png'
            image.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII='))
            login.prepare(self.bundle, image)
        for target, value in [('STATE', self.root / 'state'), ('EXTENSION', self.root / 'extension'),
                              ('SOURCES', self.root / 'sources'), ('DATABASE', self.root / 'database')]:
            patcher = patch.object(login, target, value)
            patcher.start(); self.addCleanup(patcher.stop)
        login.SOURCES.mkdir()
        self.base = login.SOURCES / '90-admin'
        self.base.write_text("[com/ubuntu/login-screen]\nbackground-picture-uri='file:///old.png'\n\n"
                             "[org/gnome/shell]\nenabled-extensions=['existing@local']\n")
        login.compile_database()
        self.before = login.DATABASE.read_bytes()

    def test_install_remove_preserves_previous_settings(self):
        login.install(self.bundle)
        self.assertEqual(login.setting('org.gnome.shell', 'enabled-extensions'),
                         ['existing@local', login.UUID])
        self.assertEqual(login.setting('com.ubuntu.login-screen', 'background-picture-uri'),
                         (login.STATE / 'wallpaper').as_uri())
        self.assertEqual((login.STATE / 'wallpaper').read_bytes(), (self.bundle / 'wallpaper').read_bytes())
        self.assertEqual(json.loads((login.EXTENSION / 'metadata.json').read_text())['session-modes'], ['gdm'])
        login.remove()
        self.assertEqual(login.DATABASE.read_bytes(), self.before)
        self.assertFalse(login.STATE.exists())
        self.assertFalse(login.EXTENSION.exists())

    def test_remove_preserves_external_changes(self):
        login.install(self.bundle)
        self.base.write_text("[com/ubuntu/login-screen]\nbackground-picture-uri='file:///new.png'\n\n"
                             "[org/gnome/shell]\nenabled-extensions=['existing@local', 'new@local']\n")
        login.remove()
        self.assertEqual(login.setting('org.gnome.shell', 'enabled-extensions'),
                         ['existing@local', 'new@local'])
        self.assertEqual(login.setting('com.ubuntu.login-screen', 'background-picture-uri'), 'file:///new.png')

    def test_failed_install_rolls_back(self):
        with patch.object(login, 'compile_database', side_effect=RuntimeError('Simulated compile failure')), self.assertRaises(RuntimeError):
            login.install(self.bundle)
        self.assertEqual(login.DATABASE.read_bytes(), self.before)
        self.assertFalse((login.SOURCES / login.DROPIN).exists())
        self.assertFalse(login.STATE.exists())
        self.assertFalse(login.EXTENSION.exists())

    def test_refuses_unowned_or_linked_installation(self):
        login.EXTENSION.mkdir()
        with self.assertRaises(RuntimeError):
            login.install(self.bundle)
        with self.assertRaises(RuntimeError):
            login.owned(login.EXTENSION)
        (login.EXTENSION / login.MARKER).symlink_to(self.bundle / 'wallpaper')
        with self.assertRaises(RuntimeError):
            login.owned(login.EXTENSION)

    def test_compile_validation_leaves_previous_database_intact(self):
        with self.assertRaises(RuntimeError):
            login.compile_database({('com.ubuntu.login-screen', 'background-picture-uri'): 'wrong'})
        self.assertEqual(login.DATABASE.read_bytes(), self.before)

    def test_remove_failure_restores_dropin_and_keeps_installation(self):
        login.install(self.bundle)
        applied = login.DATABASE.read_bytes()
        with patch.object(login, 'compile_database', side_effect=RuntimeError('Simulated failure')), self.assertRaises(RuntimeError):
            login.remove()
        self.assertTrue((login.SOURCES / login.DROPIN).exists())
        self.assertTrue(login.STATE.exists())
        self.assertTrue(login.EXTENSION.exists())
        self.assertEqual(login.DATABASE.read_bytes(), applied)

    def test_command_reports_captured_error(self):
        error = subprocess.CalledProcessError(1, ['dconf'], stderr='Permission denied: test path')
        with patch.object(login.subprocess, 'run', side_effect=error), self.assertRaisesRegex(RuntimeError, 'Permission denied: test path'):
            login.command('/usr/bin/dconf', 'compile')


if __name__ == '__main__':
    unittest.main()
