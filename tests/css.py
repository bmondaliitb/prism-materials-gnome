"""Parse the integration stylesheet with the installed GTK4 CSS parser."""
from pathlib import Path
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk
provider = Gtk.CssProvider()
errors = []
provider.connect('parsing-error', lambda _p, _s, error: errors.append(str(error)))
provider.load_from_data(Path('integration/sidebar.css').read_bytes())
assert not errors, '\n'.join(errors)
print('GTK4 sidebar stylesheet parses without errors')
