// Checks public methods in the actual installed GNOME/Mutter typelib; no stage needed.
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Shell from 'gi://Shell';
function check(type, names) {
    for (const name of names)
        if (typeof type.prototype[name] !== 'function') throw new Error(`${type.name}.${name} is not exposed to GJS`);
}
check(Clutter.PaintContext, ['get_framebuffer']);
check(Clutter.Actor, ['continue_pick', 'peek_stage_views', 'get_transformed_position', 'get_transformed_size', 'get_size', 'get_resource_scale', 'get_paint_opacity']);
check(Clutter.StageView, ['get_framebuffer', 'get_onscreen', 'get_layout', 'get_scale']);
check(Cogl.Framebuffer, ['draw_textured_rectangle', 'orthographic', 'set_viewport', 'blit', 'allocate', 'get_context', 'get_width', 'get_height', 'get_modelview_matrix', 'get_projection_matrix', 'get_viewport_x', 'get_viewport_y', 'get_viewport_width', 'get_viewport_height']);
check(Cogl.Pipeline, ['add_snippet', 'get_uniform_location', 'set_uniform_float', 'set_layer_texture', 'set_layer_combine', 'set_layer_filters', 'set_layer_wrap_mode', 'set_blend']);
check(Clutter.OffscreenEffect, ['get_pipeline', 'get_texture']);
check(Shell.GLSLEffect, ['add_glsl_snippet']);
for (const [type, method] of [[Cogl.Pipeline, 'new'], [Cogl.Snippet, 'new'], [Cogl.Texture2D, 'new_with_size'], [Cogl.Offscreen, 'new_with_texture']])
    if (typeof type[method] !== 'function') throw new Error(`Missing ${method}`);
print('Rounded-frost API contract matches the installed GNOME/Mutter typelib');
