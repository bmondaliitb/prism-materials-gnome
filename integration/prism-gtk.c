/* SPDX-License-Identifier: GPL-3.0-or-later
 * Optional GTK4 launcher adapter. No GTK private structures or ABI offsets.
 * Symbols are resolved from the GTK library already loaded by the application.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef void *Ptr;
static Ptr (*first_child)(Ptr), (*next_sibling)(Ptr), (*parent)(Ptr);
static const char *(*type_name)(Ptr);
static void (*add_class)(Ptr, const char *), (*remove_class)(Ptr, const char *);
static int ready;
#define RESOLVE(var, name) do { *(void **)(&(var)) = dlsym(RTLD_NEXT, name); if (!(var)) return 0; } while (0)
static int initialize(void) {
    if (ready) return 1;
    RESOLVE(first_child, "gtk_widget_get_first_child");
    RESOLVE(next_sibling, "gtk_widget_get_next_sibling");
    RESOLVE(parent, "gtk_widget_get_parent");
    RESOLVE(type_name, "g_type_name_from_instance");
    RESOLVE(add_class, "gtk_widget_add_css_class");
    RESOLVE(remove_class, "gtk_widget_remove_css_class");
    ready = 1;
    return 1;
}
/* Detect semantic widgets, never an app name, sidebar width, or screen position.
 * Stop at the first primary split: nested content stays an opaque reading surface. */
static int mark_split(Ptr widget, Ptr window) {
    const char *name = type_name(widget);
    const char *sidebar_symbol = NULL, *content_symbol = NULL;
    if (!strcmp(name, "AdwOverlaySplitView")) {
        sidebar_symbol = "adw_overlay_split_view_get_sidebar";
        content_symbol = "adw_overlay_split_view_get_content";
    } else if (!strcmp(name, "AdwNavigationSplitView")) {
        sidebar_symbol = "adw_navigation_split_view_get_sidebar";
        content_symbol = "adw_navigation_split_view_get_content";
    }
    if (sidebar_symbol) {
        Ptr (*get_sidebar)(Ptr) = dlsym(RTLD_NEXT, sidebar_symbol);
        Ptr (*get_content)(Ptr) = dlsym(RTLD_NEXT, content_symbol);
        Ptr sidebar = get_sidebar ? get_sidebar(widget) : NULL;
        Ptr content = get_content ? get_content(widget) : NULL;
        if (sidebar && content) {
            add_class(sidebar, "prism-sidebar");
            add_class(content, "prism-content");
            for (Ptr p = parent(sidebar); p && p != widget; p = parent(p))
                add_class(p, "prism-sidebar-host");
            /* Transparent ancestors must not leave other app regions unpainted. */
            Ptr child = widget;
            for (Ptr p = parent(child); p && p != window; child = p, p = parent(p)) {
                add_class(p, "prism-underlay");
                for (Ptr sibling = first_child(p); sibling; sibling = next_sibling(sibling))
                    if (sibling != child) add_class(sibling, "prism-content");
            }
            return 1;
        }
    }
    for (Ptr child = first_child(widget); child; child = next_sibling(child))
        if (mark_split(child, window)) return 1;
    return 0;
}
static int apply(Ptr window) {
    const char *path = getenv("PRISM_GTK_CSS");
    if (!path || !initialize()) return 0;
    const char *name = type_name(window);
    Ptr (*get_data)(Ptr, const char *);
    void (*set_data)(Ptr, const char *, Ptr);
    RESOLVE(get_data, "g_object_get_data");
    RESOLVE(set_data, "g_object_set_data");
    if (!mark_split(window, window)) { remove_class(window, "prism-window"); return 0; }
    if (get_data(window, "prism-profile-applied")) { add_class(window, "prism-window"); return 1; } /* Unknown layouts remain opaque. */
    Ptr (*provider_new)(void), (*get_display)(Ptr);
    void (*load_path)(Ptr, const char *), (*add_provider)(Ptr, Ptr, unsigned), (*unref)(Ptr);
    RESOLVE(provider_new, "gtk_css_provider_new");
    RESOLVE(get_display, "gtk_widget_get_display");
    RESOLVE(load_path, "gtk_css_provider_load_from_path");
    RESOLVE(add_provider, "gtk_style_context_add_provider_for_display");
    RESOLVE(unref, "g_object_unref");
    Ptr provider = provider_new();
    load_path(provider, path);
    add_provider(get_display(window), provider, 610); /* Above app CSS, below user CSS. */
    unref(provider);
    add_class(window, "prism-window");
    set_data(window, "prism-profile-applied", (Ptr)1);
    fprintf(stderr, "Prism: semantic sidebar detected in %s; content opacity preserved\n", name);
    return 1;
}
void gtk_window_present(Ptr window) {
    void (*real_present)(Ptr) = dlsym(RTLD_NEXT, "gtk_window_present");
    apply(window);
    if (real_present) real_present(window);
}
