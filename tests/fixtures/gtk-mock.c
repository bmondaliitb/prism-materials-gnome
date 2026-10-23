#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
typedef struct Node { const char *type; struct Node *child, *sibling, *parent; int root, sidebar, host, content, applied; } Node;
static Node content = {.type="AdwToolbarView"};
static Node sidebar = {.type="AdwToolbarView"};
static Node host = {.type="GtkWidget", .child=&sidebar, .sibling=&content};
static Node split = {.type="AdwOverlaySplitView", .child=&host};
static Node chrome = {.type="GtkLabel"};
static Node outer = {.type="GtkBox", .child=&split};
static Node root = {.type="ArbitraryThirdPartyWindow", .child=&outer};
static Node dialog = {.type="AdwAboutDialog"};
static int presentations, providers;
void *gtk_widget_get_first_child(Node *n) { return n->child; }
void *gtk_widget_get_next_sibling(Node *n) { return n->sibling; }
void *gtk_widget_get_parent(Node *n) { return n->parent; }
const char *g_type_name_from_instance(Node *n) { return n->type; }
void gtk_widget_add_css_class(Node *n, const char *s) {
    if (!strcmp(s,"prism-window")) n->root=1;
    if (!strcmp(s,"prism-sidebar")) n->sidebar=1;
    if (!strcmp(s,"prism-content")) n->content=1;
    if (!strcmp(s,"prism-sidebar-host")) n->host=1;
}
void gtk_widget_remove_css_class(Node *n, const char *s) { if (!strcmp(s,"prism-window")) n->root=0; }
void *adw_overlay_split_view_get_sidebar(void *n) { (void)n; return &sidebar; }
void *adw_overlay_split_view_get_content(void *n) { (void)n; return getenv("TEST_MISSING_CONTENT") ? NULL : &content; }
void *adw_navigation_split_view_get_sidebar(void *n) { return adw_overlay_split_view_get_sidebar(n); }
void *adw_navigation_split_view_get_content(void *n) { return adw_overlay_split_view_get_content(n); }
void *g_object_get_data(Node *n, const char *key) { (void)key; return n->applied ? n : NULL; }
void g_object_set_data(Node *n, const char *key, void *p) { (void)key; n->applied = p != NULL; }
void *gtk_css_provider_new(void) { return &root; }
void *gtk_widget_get_display(void *n) { return n; }
void gtk_css_provider_load_from_path(void *p, const char *path) { (void)p; assert(strstr(path,"sidebar.css")); }
void gtk_style_context_add_provider_for_display(void *d, void *p, unsigned priority) { (void)d; (void)p; assert(priority==610); providers++; }
void g_object_unref(void *p) { (void)p; }
void gtk_window_present(void *w) { (void)w; presentations++; }
void run_test(void) {
    outer.parent=&root; split.parent=&outer; split.sibling=&chrome; chrome.parent=&outer; host.parent=&split; sidebar.parent=&host; content.parent=&split;
    if (getenv("TEST_NAVIGATION")) split.type="AdwNavigationSplitView";
    if (getenv("TEST_UNKNOWN")) split.type="GtkPaned";
    gtk_window_present(&root);
    if (getenv("TEST_UNKNOWN") || getenv("TEST_MISSING_CONTENT")) {
        assert(root.root==0 && sidebar.sidebar==0 && content.content==0 && providers==0 && presentations==1);
        puts("Unsupported or incomplete layout left untouched");
        return;
    }
    assert(chrome.content==1);
    assert(root.root==1 && sidebar.sidebar==1 && host.host==1 && content.content==1);
    gtk_window_present(&root);
    assert(root.root==1 && providers==1);
    gtk_window_present(&dialog);
    assert(dialog.root==0 && providers==1 && presentations==3);
    split.type="GtkPaned";
    gtk_window_present(&root);
    assert(root.root==0 && providers==1 && presentations==4);
    split.type="AdwOverlaySplitView";
    gtk_window_present(&root);
    assert(root.root==1 && providers==1 && presentations==5);
    puts("Arbitrary app: real panes detected, other regions protected, unsupported windows skipped, provider applied once");
}
