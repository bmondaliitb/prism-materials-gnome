UUID = prism@local
.PHONY: check package
check:
	glib-compile-schemas --strict --dry-run $(UUID)/schemas
	gjs tools/check-syntax.js $(UUID)/extension.js $(UUID)/prefs.js $(UUID)/materials.js $(UUID)/shellSurfaces.js $(UUID)/gtkMenus.js $(UUID)/frostEffect.js $(UUID)/frostShader.js $(UUID)/backdrop.js $(UUID)/windowSurface.js $(UUID)/frostGeometry.js $(UUID)/frostBlur.js
	gjs -m tests/materials.js
	gjs -m tests/lifecycle.js
	gjs -m tests/shell-surfaces.js
	gjs -m tests/gtk-menus.js
	gjs -m tests/frost.js
	gjs -m tests/input.js
	/usr/bin/python3 tests/gtk-menu-css.py
package: check
	glib-compile-schemas --strict $(UUID)/schemas
	mkdir -p dist
	cd $(UUID) && zip -qr ../dist/$(UUID).shell-extension.zip metadata.json extension.js prefs.js materials.js shellSurfaces.js gtkMenus.js frostEffect.js frostShader.js backdrop.js windowSurface.js frostGeometry.js frostBlur.js schemas

.PHONY: adapter
adapter:
	$(CC) -shared -fPIC -O2 -Wall -Wextra -Werror -o integration/libprism-gtk.so integration/prism-gtk.c -ldl

.PHONY: check-adapter
check-adapter: adapter
	/usr/bin/python3 tests/css.py
	mkdir -p /tmp/prism-adapter-test
	$(CC) -shared -fPIC -Wall -Wextra -Werror -o /tmp/prism-adapter-test/libgtk-mock.so tests/fixtures/gtk-mock.c
	$(CC) -o /tmp/prism-adapter-test/check tests/fixtures/gtk-mock-main.c -L/tmp/prism-adapter-test -lgtk-mock -Wl,-rpath,/tmp/prism-adapter-test
	PRISM_GTK_CSS=$(CURDIR)/integration/sidebar.css LD_PRELOAD=$(CURDIR)/integration/libprism-gtk.so /tmp/prism-adapter-test/check
	TEST_NAVIGATION=1 PRISM_GTK_CSS=$(CURDIR)/integration/sidebar.css LD_PRELOAD=$(CURDIR)/integration/libprism-gtk.so /tmp/prism-adapter-test/check
	TEST_UNKNOWN=1 PRISM_GTK_CSS=$(CURDIR)/integration/sidebar.css LD_PRELOAD=$(CURDIR)/integration/libprism-gtk.so /tmp/prism-adapter-test/check
	TEST_MISSING_CONTENT=1 PRISM_GTK_CSS=$(CURDIR)/integration/sidebar.css LD_PRELOAD=$(CURDIR)/integration/libprism-gtk.so /tmp/prism-adapter-test/check

.PHONY: check-frost-gpu
check-frost-gpu:
	gjs -m tests/frost.js
	python3 tests/frost-gpu.py

.PHONY: check-runtime-api
check-runtime-api:
	GI_TYPELIB_PATH=/usr/lib/gnome-shell:/usr/lib/x86_64-linux-gnu/mutter-18 LD_LIBRARY_PATH=/usr/lib/gnome-shell:/usr/lib/x86_64-linux-gnu/mutter-18 gjs -m tests/runtime-api.js
