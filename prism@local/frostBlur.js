import Cogl from 'gi://Cogl';
import {renderLevel} from './renderQuality.js';

// Blur only a bounded, reduced-resolution image. Full-resolution compositing
// stays a single sample, so adding a 4K window doesn't multiply blur work by 16.
export function blurSize(width, height, quality = 'eco', radius = 0) {
    const level = renderLevel(quality);
    let factor = level.factor;
    // Avoid skipping whole texels between Gaussian taps: regular text rows
    // otherwise survive as bands or repeated ghost copies.
    while (factor < Math.max(0, radius) / ((level.taps - 1) / 2)) factor *= 2;
    while (Math.ceil(width / factor) * Math.ceil(height / factor) > level.pixels) factor *= 2;
    return {width: Math.max(1, Math.ceil(width / factor)),
        height: Math.max(1, Math.ceil(height / factor)), factor};
}
export const FILTER_DECLARATIONS = 'uniform vec2 prismStep;';
export const DOWNSAMPLE_CODE = `
vec2 uv = cogl_tex_coord0_in.xy;
cogl_color_out = 0.25 * (
    texture2D(cogl_sampler0, uv + prismStep * vec2(-1.0, -1.0)) +
    texture2D(cogl_sampler0, uv + prismStep * vec2( 1.0, -1.0)) +
    texture2D(cogl_sampler0, uv + prismStep * vec2(-1.0,  1.0)) +
    texture2D(cogl_sampler0, uv + prismStep * vec2( 1.0,  1.0)));
`;
// Precomputed Gaussian weights; no per-pixel trigonometry or exponentials.
const weights = [0.028532, 0.067234, 0.124009, 0.179044, 0.202362,
    0.179044, 0.124009, 0.067234, 0.028532];
export const BLUR_CODE = 'cogl_color_out = ' + weights.map((w, i) =>
    `${w.toFixed(6)} * texture2D(cogl_sampler0, cogl_tex_coord0_in.xy + prismStep * ${(i - 4).toFixed(1)})`).join(' +\n') + ';';

export const ECO_BLUR_CODE = 'cogl_color_out = ' + [0.06136, 0.24477, 0.38774, 0.24477, 0.06136].map((w, i) =>
    `${w.toFixed(6)} * texture2D(cogl_sampler0, cogl_tex_coord0_in.xy + prismStep * ${(i - 2).toFixed(1)})`).join(' +\n') + ';';

export class BlurBuffer {
    constructor(context, quality = 'eco') {
        this._quality = quality;
        this._level = renderLevel(quality);
        this._context = context;
        this._targets = [];
        this._downsample = this._pipeline(DOWNSAMPLE_CODE);
        this._blur = this._pipeline(this._level.taps === 5 ? ECO_BLUR_CODE : BLUR_CODE);
    }

    _pipeline(code) {
        const pipeline = Cogl.Pipeline.new(this._context);
        pipeline.add_snippet(Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, FILTER_DECLARATIONS, code));
        pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
        pipeline.set_layer_wrap_mode(0, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
        pipeline.set_blend('RGBA = ADD (SRC_COLOR, 0)');
        return {pipeline, step: pipeline.get_uniform_location('prismStep')};
    }

    _target(index, width, height) {
        let target = this._targets[index];
        if (!target || target.width !== width || target.height !== height) {
            const texture = Cogl.Texture2D.new_with_size(this._context, width, height);
            const framebuffer = Cogl.Offscreen.new_with_texture(texture);
            framebuffer.allocate();
            framebuffer.set_viewport(0, 0, width, height);
            framebuffer.orthographic(0, 0, width, height, -1, 1);
            target = {texture, framebuffer, width, height};
            this._targets[index] = target;
        }
        return target;
    }

    _draw(target, filter, texture, step) {
        filter.pipeline.set_layer_texture(0, texture);
        filter.pipeline.set_uniform_float(filter.step, 2, 1, step);
        target.framebuffer.draw_textured_rectangle(filter.pipeline,
            0, 0, target.width, target.height, 0, 0, 1, 1);
    }

    render(texture, radius) {
        const width = texture.get_width(), height = texture.get_height();
        const size = blurSize(width, height, this._quality, radius);
        let small, index = 0;
        for (let factor = 2; factor <= size.factor; factor *= 2) {
            small = this._target(index++, Math.max(1, Math.ceil(width / factor)), Math.max(1, Math.ceil(height / factor)));
            this._draw(small, this._downsample, texture, [0.25 / small.width, 0.25 / small.height]);
            texture = small.texture;
        }
        const horizontal = this._target(index++, size.width, size.height);
        const vertical = this._target(index++, size.width, size.height);
        this._targets.length = index;
        this._draw(horizontal, this._blur, small.texture, [radius / (((this._level.taps - 1) / 2) * width), 0]);
        this._draw(vertical, this._blur, horizontal.texture, [0, radius / (((this._level.taps - 1) / 2) * height)]);
        return vertical.texture;
    }
}
