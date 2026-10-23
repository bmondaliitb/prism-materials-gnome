// Independent shader text allows offline compiler/pixel tests without a Shell session.
export const FROST_DECLARATIONS = `
uniform float prismActive;
uniform vec2 prismSize;
uniform vec2 prismTexSize;
uniform vec2 prismPadding;
uniform vec4 prismRadii;
uniform vec4 prismBasis;
uniform vec2 prismOrigin;
uniform vec2 prismBackdropSize;
uniform float prismOpacity;
uniform float prismBrightness;
`;
export const FROST_CODE = `
if (prismActive > 0.5) {
    vec2 p = cogl_tex_coord0_in.xy * prismTexSize - prismPadding;
    vec2 halfSize = prismSize * 0.5;
    float radius = p.x < halfSize.x
        ? (p.y < halfSize.y ? prismRadii.x : prismRadii.w)
        : (p.y < halfSize.y ? prismRadii.y : prismRadii.z);
    radius = clamp(radius, 0.0, min(halfSize.x, halfSize.y));
    vec2 q = abs(p - halfSize) - halfSize + vec2(radius);
    float distance = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    float mask = 1.0 - smoothstep(-0.5, 0.5, distance);
    vec2 local = p / prismSize;
    vec2 uv = (local.x * prismBasis.xy + local.y * prismBasis.zw + prismOrigin) / prismBackdropSize;
    // The separable blur has already run on a small texture. Keep foreground
    // and corner coverage at native resolution, with one backdrop lookup.
    vec3 blurred = texture2D(cogl_sampler1, clamp(uv, vec2(0.0), vec2(1.0))).rgb * prismBrightness;
    // Both actor texture and output use premultiplied alpha. Never fade text twice.
    cogl_color_out = (cogl_color_out + vec4(blurred, 1.0) * max(0.0, prismOpacity - cogl_color_out.a)) * mask;
}
`;

export function backdropRect(x, y, width, height, layout, scale, framebufferWidth, framebufferHeight) {
    const left = Math.floor((x - layout.x) * scale);
    const top = Math.floor((y - layout.y) * scale);
    const fullWidth = Math.max(1, Math.ceil(width * scale));
    const fullHeight = Math.max(1, Math.ceil(height * scale));
    const sourceX = Math.max(0, left), sourceY = Math.max(0, top);
    const captureWidth = Math.min(framebufferWidth, left + fullWidth) - sourceX;
    const captureHeight = Math.min(framebufferHeight, top + fullHeight) - sourceY;
    if (captureWidth <= 0 || captureHeight <= 0) return null;
    return {x: sourceX, y: sourceY, width: captureWidth, height: captureHeight,
        fullWidth, fullHeight, offsetX: left - sourceX, offsetY: top - sourceY};
}
