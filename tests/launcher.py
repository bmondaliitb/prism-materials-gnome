"""Verify arbitrary commands, literal argument forwarding, and clear refusals."""
import subprocess
from pathlib import Path
launcher = str(Path('integration/prism-app').resolve())
result = subprocess.run([launcher, '/bin/echo', 'spaces stay together', '$(literal);'], capture_output=True, text=True)
assert result.returncode == 0, result.stderr
assert result.stdout == 'spaces stay together $(literal);\n'
for command in ['prism-nonexistent-test-command', 'flatpak', 'snap']:
    result = subprocess.run([launcher, command], capture_output=True, text=True)
    assert result.returncode != 0, command
with subprocess.Popen(['/bin/sleep', '10']) as process:
    try:
        result = subprocess.run([launcher, '/bin/sleep', '0'], capture_output=True, text=True)
        assert result.returncode != 0 and 'already running' in result.stderr, result.stderr
    finally:
        process.terminate()
print('Generic launcher argument forwarding and failure checks passed')
