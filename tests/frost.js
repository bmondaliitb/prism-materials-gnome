import GLib from 'gi://GLib';
import {renderLevel, RENDER_LEVELS} from '../prism@local/renderQuality.js';
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
let fallback = false, copies = 0, originalCalls = 0, now = 0, paintFlags = -1, queued = 0;
const timers = new Map(); let timerId = 0;
class Parent {
    constructor() { this._init(); }
    _init() {}
    get_actor() { return this._actor; }
    get_pipeline() { return pipeline; }
    get_texture() { return {get_width: () => 100, get_height: () => 80}; }
    vfunc_pre_paint() { return true; }
    vfunc_paint(_node, _context, flags) { originalCalls++; paintFlags = flags; }
    vfunc_paint_target() { originalCalls++; }
    queue_repaint() { queued++; }
}
class Texture {
    constructor(width, height) { this.width = width; this.height = height; }
    get_width() { return this.width; } get_height() { return this.height; }
}
const types = {Texture2D: {new_with_size: (_ctx, w, h) => new Texture(w, h)},
    Offscreen: {new_with_texture: () => ({allocate() {}})},
    PipelineFilter: {LINEAR: 0}, PipelineWrapMode: {CLAMP_TO_EDGE: 0}};
const Effect = new Function('Clutter', 'Cogl', 'GObject', 'GLib', 'Mtk', 'Shell', 'FROST_DECLARATIONS', 'FROST_CODE', 'framebufferCapture', 'BlurBuffer', 'console', source + '\nreturn FrostEffect;')(
    {EffectPaintFlags: {ACTOR_DIRTY: 1, BYPASS_EFFECT: 2}}, types, {registerClass: (_meta, cls) => cls},
    {get_monotonic_time: () => now, PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
        timeout_add: (_priority, _delay, callback) => { timers.set(++timerId, callback); return timerId; },
        source_remove: id => timers.delete(id)}, {Rectangle: class {x=0; y=0;}},
    {GLSLEffect: Parent}, FROST_DECLARATIONS, FROST_CODE, framebufferCapture, class {constructor(context, quality) { this.quality = quality; } render(texture) { return texture; }}, {error: () => fallback = true});
const effect = new Effect();
effect._actor = {is_mapped: () => true, get_transformed_position: () => [10, 20], get_transformed_size: () => [100, 80],
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
assert(effect._updateBackdrop(context), 'Capture precedes offscreen paint');
effect.vfunc_paint_target(null, context);
assert(copies === 1 && uniforms.get('prismActive')[0] === 1 && !fallback, 'Public PaintContext without private stage-view API activates frost');
projectionScale = 2;
assert(effect._updateBackdrop(context) && Math.abs(effect._capture.scale - 2) < 0.001 && effect._capture.rect.width >= 200,
    'Active framebuffer matrices supply scale without a StageView match');
projectionScale = 1;
effect._updateBackdrop(context);
const originalTexture = effect._texture;
effect._updateBackdrop(context);
assert(effect._texture === originalTexture, 'Stable bounds reuse GPU storage');
const oldBlurBuffer = effect._blurBuffer;
effect.quality = 'high';
effect._updateBackdrop(context);
assert(effect._blurBuffer !== oldBlurBuffer && effect._blurBuffer.quality === 'high', 'Changing rendering level rebuilds the filter with its new budget');
assert(effect._texture === originalTexture, 'Rendering-level changes reuse full-size capture storage');
effect._actor.get_size = () => [101,81];
effect._updateBackdrop(context);
assert(effect._texture.get_width() === effect._capture.rect.width && effect._capture.rect.width < 128,
    'Capture excludes allocation padding that Mutter may not have repainted');
effect._actor.get_size = () => [100,80];
effect.vfunc_paint(null, context, 0);
assert(originalCalls === 2, 'Parent paint pipeline preserved');
assert(paintFlags === 0, 'Unchanged foregrounds are not forcibly marked dirty');
const limitedCopies = copies;
now += 10000;
effect.vfunc_paint(null, context, 1);
assert(copies === limitedCopies && paintFlags === 1, 'Foreground hover can repaint without recapturing the background within the frame limit');
assert(timers.size === 1, 'Skipped final frame gets one coalesced trailing refresh');
now += 34000;
effect.vfunc_paint(null, context, 0);
assert(copies === limitedCopies + 1, 'Backdrop refresh resumes on a later compositor paint after the limit');
assert(timers.size === 0, 'A timely external repaint cancels the pending trailing refresh');
effect.maxFps = 0;
effect.vfunc_paint(null, context, 0);
assert(copies === limitedCopies + 2, 'Unlimited mode refreshes even within the same time interval');
effect.maxFps = 30;
effect.vfunc_paint(null, context, 2);
assert(copies === limitedCopies + 2 && effect._capture === null, 'Compositor bypass does no capture or filtering');
effect.vfunc_paint(null, context, 0);
for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
assert(queued === 1, 'Trailing refresh requests one effect repaint');
effect.vfunc_paint(null, context, 0);
assert(timers.size === 0, 'Trailing capture settles without creating a continuous repaint loop');
let pickCalls = 0;
const pickContext = {};
effect._actor.continue_pick = context => { assert(context === pickContext, 'Original native pick context retained'); pickCalls++; };
effect.vfunc_pick(pickContext);
assert(pickCalls === 1, 'Frost effect forwards native pointer picking exactly once');

assert(!effect._updateBackdrop({get_framebuffer() { throw new Error('capture failure'); }}), 'Capture failure falls back');
assert(fallback, 'Fallback is reported');
// Projection and modelview both come from the active offscreen target.
const offscreen = {...framebuffer, get_width: () => 320, get_height: () => 200,
    get_viewport_width: () => 320, get_viewport_height: () => 200,
    get_projection_matrix: () => { const m = new Graphene.Matrix(); m.init_ortho(0,320,200,0,-1,1); return m; }};
const capture = framebufferCapture(offscreen, 100, 80);
effect._updateBackdrop(context);
const monitorTexture = effect._texture;
effect._updateBackdrop({get_framebuffer: () => offscreen});
const nestedTexture = effect._texture;
effect._updateBackdrop(context);
assert(effect._texture === monitorTexture && nestedTexture !== monitorTexture,
    'Alternating monitor/offscreen framebuffers reuse separate capture storage');
effect.maxFps = 0; effect._updateBackdrop(context);
effect.maxFps = 30;
const before120Paints = copies;
for (let frame = 0; frame < 120; frame++) {
    now += 8334;
    effect.vfunc_paint(null, context, 0);
}
assert(copies - before120Paints <= 31 && copies - before120Paints >= 29,
    '120 stationary paint requests perform about 30 background copies, not 120');
const peer = new Effect(); peer._actor = effect._actor;
peer.vfunc_paint(null, context, 0);
now += 10000;
effect.vfunc_paint(null, context, 0);
peer.vfunc_paint(null, context, 0);
assert(timers.size === 1, 'Several throttled surfaces share one trailing timer');
for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
effect.vfunc_paint(null, context, 0);
peer.vfunc_paint(null, context, 0);
assert(timers.size === 0, 'Several surfaces settle after the shared trailing repaint without feedback');
effect.vfunc_paint(null, context, 0);
Effect.cancelPendingRefresh();
assert(timers.size === 0, 'Extension shutdown cancels trailing timers and drops pending effect references');
const animationCopies = copies, animationCapture = effect._capture;
const invalidAnimationContext = {get_framebuffer() { throw new Error('Clone projection must not be sampled'); }};
Effect.setWorkspaceMotion(true);
for (let frame = 0; frame < 60; frame++) effect.vfunc_paint(null, invalidAnimationContext, 0);
assert(copies === animationCopies && timers.size === 0 && effect._capture === animationCapture,
    'Workspace motion reuses frost across all animation frames without captures or refresh timers');
Effect.setWorkspaceMotion(false);
effect.vfunc_paint(null, context, 0);
assert(copies === animationCopies + 1, 'Workspace completion invalidates the snapshot and restores live capture immediately');
effect._actor.is_in_clone_paint = () => true;
effect.vfunc_paint(null, invalidAnimationContext, 0);
assert(copies === animationCopies + 1, 'Other clone/screenshot paints never read invalid live-backdrop matrices');
effect._actor.is_in_clone_paint = () => false;
effect.freezeBackdrop = true;
effect.invalidateBackdrop();
effect._updateBackdrop(context);
const frozenCopies = copies;
for (let frame = 0; frame < 120; frame++) {
    now += 1000000;
    Effect.cancelPendingRefresh();
    effect._updateBackdrop(context);
}
assert(copies === frozenCopies && timers.size === 0,
    'Cached frost reuses one capture across background changes/time/shared epochs without refresh timers');
effect.invalidateBackdrop(); effect._updateBackdrop(context);
assert(copies === frozenCopies + 1, 'Focus or popup-open invalidation refreshes a frozen backdrop once');
effect.radius += 1; effect._updateBackdrop(context);
assert(copies === frozenCopies + 2, 'Blur setting changes invalidate a cached snapshot');
effect.freezeBackdrop = false; effect._updateBackdrop(context);
assert(copies === frozenCopies + 3, 'Returning to live frost immediately restores backdrop capture');
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
const filters = new Function('Cogl', 'renderLevel', blurSource + '\nreturn {BlurBuffer, blurSize, FILTER_DECLARATIONS, DOWNSAMPLE_CODE, BLUR_CODE, ECO_BLUR_CODE};')(filterTypes, renderLevel);
for (const [w, h] of [[1920,1080], [3840,2160], [7680,4320], [1,1]]) {
    const size = filters.blurSize(w,h);
    assert(size.width * size.height <= 262144, 'Blur pixel budget stays bounded at high resolution');
}
const blur = new filters.BlurBuffer({}, 'balanced');
const input = new Texture(3840,2160);
const output = blur.render(input, 56);
assert(output.get_width() < 3840 && draws === 6 && allocations === 6, 'Large blur uses progressive 2x reductions before directional filtering');
assert(blur.render(input, 36) === output && allocations === 6, 'Stable reduction level reuses intermediate storage');
assert(draws === 12, 'Live backdrop is updated without stale caching');
for (const [quality, level] of Object.entries(RENDER_LEVELS)) {
    for (const [w,h] of [[1920,1080],[3840,2160],[7680,4320],[1,1]]) {
        const size = filters.blurSize(w,h,quality);
        assert(size.width * size.height <= level.pixels && size.factor >= level.factor,
            `${quality} obeys its pixel and downsampling budgets`);
    }
    const buffer = new filters.BlurBuffer({}, quality);
    const result = buffer.render(input, 56);
    const size = filters.blurSize(3840,2160,quality,56);
    assert(result.get_width() === size.width, `${quality} reaches actual target allocation`);
    assert(56 / (((level.taps - 1) / 2) * size.factor) <= 1,
        `${quality} never skips whole texels between Gaussian taps`);
}
assert(renderLevel('invalid') === RENDER_LEVELS.eco, 'Unknown profiles safely use Eco');
assert(filters.blurSize(1920,1080,'eco').width < filters.blurSize(1920,1080,'balanced').width,
    'Eco materially reduces GPU target size');
GLib.file_set_contents('/tmp/prism-frost-shader.json', JSON.stringify({declarations: FROST_DECLARATIONS, code: FROST_CODE,
    filterDeclarations: filters.FILTER_DECLARATIONS, downsample: filters.DOWNSAMPLE_CODE, blur: filters.BLUR_CODE, ecoBlur: filters.ECO_BLUR_CODE}));
print('Frost capture geometry, GPU storage, uniform, and fallback checks passed');
