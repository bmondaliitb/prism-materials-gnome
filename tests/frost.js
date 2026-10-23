import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import {framebufferCapture} from '../prism@local/frostGeometry.js';
import {backdropRect, FROST_DECLARATIONS, FROST_CODE} from '../prism@local/frostShader.js';
function assert(value, message) { if (!value) throw new Error(message); }
const normal = backdropRect(10, 20, 100, 80, {x: 0, y: 0}, 1, 1920, 1080);
assert(normal.width === 100 && normal.x === 10 && normal.offsetX === 0, 'Unclipped capture');
const clipped = backdropRect(-10, 20, 100, 80, {x: 0, y: 0}, 1, 1920, 1080);
assert(clipped.width === 90 && clipped.offsetX === -10, 'Partially offscreen capture maps UVs');
const scaled = backdropRect(1930, 10, 100, 80, {x: 1920, y: 0}, 2, 3840, 2160);
assert(scaled.x === 20 && scaled.width === 200, 'Mixed-monitor layout and scale');
assert(backdropRect(-500, 0, 10, 10, {x: 0, y: 0}, 1, 100, 100) === null, 'Offscreen actor does not allocate');
const [, bytes] = GLib.file_get_contents('prism@local/frostEffect.js');
const source = new TextDecoder().decode(bytes).replace(/^import .*;\n/gm, '').replace('export const FrostEffect', 'const FrostEffect');
const uniforms = new Map();
const pipeline = {get_uniform_location: name => name,
    set_uniform_float: (name, components, count, values) => {
        assert(values.length === components * count, 'Uniform vector shape'); uniforms.set(name, values);
    }, set_layer_texture() {}, set_layer_combine() {}, set_layer_filters() {}, set_layer_wrap_mode() {}, set_blend() {}};
let fallback = false, copies = 0, originalCalls = 0;
class Parent {
    constructor() { this._init(); }
    _init() {}
    get_actor() { return this._actor; }
    get_pipeline() { return pipeline; }
    get_texture() { return {get_width: () => 100, get_height: () => 80}; }
    vfunc_pre_paint() { return true; }
    vfunc_paint() { originalCalls++; }
    vfunc_paint_target() { originalCalls++; }
}
class Texture {
    constructor(width, height) { this.width = width; this.height = height; }
    get_width() { return this.width; } get_height() { return this.height; }
}
const types = {Texture2D: {new_with_size: (_ctx, w, h) => new Texture(w, h)},
    Offscreen: {new_with_texture: () => ({allocate() {}})},
    PipelineFilter: {LINEAR: 0}, PipelineWrapMode: {CLAMP_TO_EDGE: 0}};
const Effect = new Function('Clutter', 'Cogl', 'GObject', 'Mtk', 'Shell', 'FROST_DECLARATIONS', 'FROST_CODE', 'framebufferCapture', 'BlurBuffer', 'console', source + '\nreturn FrostEffect;')(
    {EffectPaintFlags: {ACTOR_DIRTY: 1}}, types, {registerClass: (_meta, cls) => cls}, {Rectangle: class {x=0; y=0;}},
    {GLSLEffect: Parent}, FROST_DECLARATIONS, FROST_CODE, framebufferCapture, class {render(texture) { return texture; }}, {error: () => fallback = true});
const effect = new Effect();
effect._actor = {get_transformed_position: () => [10, 20], get_transformed_size: () => [100, 80],
    get_size: () => [100, 80], get_resource_scale: () => 1, get_paint_opacity: () => 255};
let projectionScale = 1;
const framebuffer = {get_context() {}, get_width: () => 1920, get_height: () => 1080, blit: () => { copies++; },
    get_modelview_matrix: () => {
        const matrix = new Graphene.Matrix(); matrix.init_translate(new Graphene.Point3D({x:10,y:20,z:0})); return matrix;
    },
    get_projection_matrix: () => {
        const matrix = new Graphene.Matrix(); matrix.init_ortho(0,1920/projectionScale,1080/projectionScale,0,-1,1); return matrix;
    }, get_viewport_x: () => 0, get_viewport_y: () => 0,
    get_viewport_width: () => 1920, get_viewport_height: () => 1080};
// Model the actual API. This framebuffer is intentionally NOT any StageView's.
const context = {get_framebuffer: () => framebuffer};
effect._actor.peek_stage_views = () => [{get_framebuffer: () => ({}), get_scale: () => 1}];
assert(effect.vfunc_pre_paint(null, context), 'Capture precedes offscreen paint');
effect.vfunc_paint_target(null, context);
assert(copies === 1 && uniforms.get('prismActive')[0] === 1 && !fallback, 'Public PaintContext without private stage-view API activates frost');
projectionScale = 2;
assert(effect.vfunc_pre_paint(null, context) && Math.abs(effect._capture.scale - 2) < 0.001 && effect._capture.rect.width >= 200,
    'Active framebuffer matrices supply scale without a StageView match');
projectionScale = 1;
effect.vfunc_pre_paint(null, context);
const originalTexture = effect._texture;
effect.vfunc_pre_paint(null, context);
assert(effect._texture === originalTexture, 'Stable bounds reuse GPU storage');
effect._actor.get_size = () => [101,81];
effect.vfunc_pre_paint(null, context);
assert(effect._texture === originalTexture, 'Small live resize reuses capture storage');
effect._actor.get_size = () => [100,80];
effect.vfunc_paint(null, context, 0);
assert(originalCalls === 2, 'Parent paint pipeline preserved');
let pickCalls = 0;
const pickContext = {};
effect._actor.continue_pick = context => { assert(context === pickContext, 'Original native pick context retained'); pickCalls++; };
effect.vfunc_pick(pickContext);
assert(pickCalls === 1, 'Frost effect forwards native pointer picking exactly once');

assert(!effect.vfunc_pre_paint(null, {get_framebuffer() { throw new Error('capture failure'); }}), 'Capture failure falls back');
assert(fallback, 'Fallback is reported');
// Projection and modelview both come from the active offscreen target.
const offscreen = {...framebuffer, get_width: () => 320, get_height: () => 200,
    get_viewport_width: () => 320, get_viewport_height: () => 200,
    get_projection_matrix: () => { const m = new Graphene.Matrix(); m.init_ortho(0,320,200,0,-1,1); return m; }};
const capture = framebufferCapture(offscreen, 100, 80);
assert(Math.abs(capture.rect.x - 10) <= 1 && Math.abs(capture.rect.y - 20) <= 1 && Math.abs(capture.basis[0] - 100) < 0.01,
    'Nested offscreen coordinates remain independent of monitor origin');
const [, blurBytes] = GLib.file_get_contents('prism@local/frostBlur.js');
const blurSource = new TextDecoder().decode(blurBytes).replace(/^import .*;\n/gm, '').replace(/export /g, '');
let draws = 0, allocations = 0;
const filterTypes = {...types,
    Pipeline: {new: () => ({...pipeline, add_snippet() {}})},
    Snippet: {new: () => ({})}, SnippetHook: {FRAGMENT: 0},
    Offscreen: {new_with_texture: () => ({allocate() { allocations++; }, set_viewport() {}, orthographic() {},
        draw_textured_rectangle() { draws++; }})}};
const filters = new Function('Cogl', blurSource + '\nreturn {BlurBuffer, blurSize, FILTER_DECLARATIONS, DOWNSAMPLE_CODE, BLUR_CODE};')(filterTypes);
for (const [w, h] of [[1920,1080], [3840,2160], [7680,4320], [1,1]]) {
    const size = filters.blurSize(w,h);
    assert(size.width * size.height <= 262144, 'Blur pixel budget stays bounded at high resolution');
}
const blur = new filters.BlurBuffer({});
const input = new Texture(3840,2160);
const output = blur.render(input, 56);
assert(output.get_width() < 3840 && draws === 4 && allocations === 4, 'Blur uses four small passes');
assert(blur.render(input, 36) === output && allocations === 4, 'Frame and radius changes reuse intermediate storage');
assert(draws === 8, 'Live backdrop is updated without stale caching');
GLib.file_set_contents('/tmp/prism-frost-shader.json', JSON.stringify({declarations: FROST_DECLARATIONS, code: FROST_CODE,
    filterDeclarations: filters.FILTER_DECLARATIONS, downsample: filters.DOWNSAMPLE_CODE, blur: filters.BLUR_CODE}));
print('Frost capture geometry, GPU storage, uniform, and fallback checks passed');
