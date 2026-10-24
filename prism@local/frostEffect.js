import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import {FROST_DECLARATIONS, FROST_CODE} from './frostShader.js';

import {BlurBuffer} from './frostBlur.js';
import {framebufferCapture} from './frostGeometry.js';

// Capture the background BEFORE the actor is redirected offscreen. A mask wrapped
// around Shell.BlurEffect alone can capture an empty offscreen buffer instead.
export const FrostEffect = GObject.registerClass({GTypeName: 'PrismRoundedFrostEffect'},
class FrostEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this.radius = 36;
        this.quality = 'eco';
        this.brightness = 1;
        this.radii = [0, 0, 0, 0];
        this._capture = null;
        this._texture = null;
        this._framebuffer = null;
        this._logged = false;
        this._blurBuffer = null;
        this._blurred = null;
        this._uniforms = new Map();
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, FROST_DECLARATIONS, FROST_CODE, false);
    }

    _report(error) {
        if (!this._logged) console.error('Prism: rounded frost fell back to native translucent paint', error);
        this._logged = true;
    }

    vfunc_pick(context) {
        // Visual alpha/masking must never become an input mask or stop traversal.
        this.get_actor().continue_pick(context);
    }

    vfunc_paint(node, context, flags) {
        // Live background changes must not reuse an old background capture.
        super.vfunc_paint(node, context, flags | Clutter.EffectPaintFlags.ACTOR_DIRTY);
    }

    vfunc_pre_paint(node, context) {
        this._capture = null;
        try {
            const actor = this.get_actor();
            const source = context.get_framebuffer();
            const [width, height] = actor.get_size();
            if (width <= 0 || height <= 0) return false;
            const capture = framebufferCapture(source, width, height);
            if (!capture) return false;
            const {rect} = capture;
            // Capture only the effect's bounds. Allocation padding can reach
            // outside the region repainted by Mutter; filtering those pixels
            // leaks stale framebuffer tiles into an otherwise current backdrop.
            if (!this._texture || this._texture.get_width() !== rect.width || this._texture.get_height() !== rect.height) {
                this._texture = Cogl.Texture2D.new_with_size(source.get_context(), rect.width, rect.height);
                this._framebuffer = Cogl.Offscreen.new_with_texture(this._texture);
                this._framebuffer.allocate();
            }
            const copied = source.blit(this._framebuffer, rect.x, rect.y, 0, 0, rect.width, rect.height);
            if (copied === false) throw new Error('Backdrop framebuffer copy failed');
            if (!this._blurBuffer || this._bufferQuality !== this.quality) {
                this._blurBuffer = new BlurBuffer(source.get_context(), this.quality);
                this._bufferQuality = this.quality;
            }
            const radius = Math.max(0, Math.min(80, this.radius)) * capture.scale;
            this._blurred = radius > 0 ? this._blurBuffer.render(this._texture, radius) : this._texture;
            this._capture = capture;
            return super.vfunc_pre_paint(node, context);
        } catch (error) {
            this._report(error);
            return false;
        }
    }

    vfunc_paint_target(node, context) {
        const pipeline = this.get_pipeline();
        const uniform = (name, components, values) => {
            // Pipeline.set_uniform_float has an explicit vector count in GJS.
            if (!this._uniforms.has(name)) this._uniforms.set(name, pipeline.get_uniform_location(name));
            pipeline.set_uniform_float(this._uniforms.get(name), components, 1, values);
        };
        uniform('prismActive', 1, [0]);
        try {
            if (this._capture) {
                const actor = this.get_actor();
                const [width, height] = actor.get_size();
                const texture = this.get_texture();
                const resourceScale = actor.get_resource_scale();
                const texWidth = texture.get_width() / resourceScale;
                const texHeight = texture.get_height() / resourceScale;
                const {rect, basis, origin} = this._capture;
                // This effect owns its per-instance GLSL pipeline, including layer 1.
                pipeline.set_layer_texture(1, this._blurred);
                pipeline.set_layer_combine(1, 'RGBA = REPLACE (PREVIOUS)');
                pipeline.set_layer_filters(1, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
                pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
                pipeline.set_blend('RGBA = ADD (SRC_COLOR, DST_COLOR * (1-SRC_COLOR[A]))');
                uniform('prismSize', 2, [Math.max(1, width), Math.max(1, height)]);
                uniform('prismTexSize', 2, [texWidth, texHeight]);
                uniform('prismPadding', 2, [(texWidth - width) / 2, (texHeight - height) / 2]);
                uniform('prismRadii', 4, this.radii);
                uniform('prismBasis', 4, basis);
                uniform('prismOrigin', 2, origin);
                uniform('prismBackdropSize', 2, [rect.width, rect.height]);
                uniform('prismOpacity', 1, [actor.get_paint_opacity() / 255]);
                uniform('prismBrightness', 1, [this.brightness]);
                uniform('prismActive', 1, [1]);
            }
        } catch (error) {
            uniform('prismActive', 1, [0]);
            this._report(error);
        }
        super.vfunc_paint_target(node, context);
    }
});
