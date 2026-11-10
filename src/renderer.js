// Minimal WebGL2 renderer. Everything in the game is a box, drawn with one shader
// that paints world-space grid lines (the "sandbox" look), dark box edges, soft sun
// shadows (shadow map + PCF) and a gradient sky.
import { mat4, ortho, lookDir, mul } from './math.js';

const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uProj, uView, uModel, uLightVP;
uniform vec3 uScale;
out vec3 vWorld, vNormal, vLocal, vLocalN;
out vec4 vLightPos;
out float vViewZ;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vLocal = aPos;
  vLocalN = aNormal;
  vNormal = normalize(mat3(uModel) * (aNormal / uScale));
  vLightPos = uLightVP * vec4(w.xyz + vNormal * 0.035, 1.0); // normal offset vs. acne
  vec4 v = uView * w;
  vViewZ = -v.z;
  gl_Position = uProj * v;
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld, vNormal, vLocal, vLocalN;
in vec4 vLightPos;
in float vViewZ;
uniform vec3 uColor, uScale, uFogColor, uSunDir, uCamPos, uSkyTop;
uniform float uGrid, uEdges, uEmissive, uAlpha, uFogDensity, uShadowOn, uSky, uViewUnder, uAO;
uniform vec3 uRim;
uniform vec2 uMat;          // x = metalness, y = roughness (< 0: automatic from colour)
uniform vec3 uStudio, uStudioFwd, uStudioKey;   // menu studio: backdrop colour (zero = off), camera forward, key light dir
uniform sampler2DShadow uShadowMap;
out vec4 outColor;
const float UNDER_Y = -1.2;     // below this, you're in the underground arena: lamp light, no sun

// ---- lighting is done in linear space, then ACES tone-mapped back to sRGB ----
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float grid(vec2 p, float spacing, float px) {
  vec2 c = p / spacing;
  vec2 fw = max(fwidth(c), vec2(1e-4));
  vec2 d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - clamp(min(d.x, d.y) - px * 0.5 + 0.5, 0.0, 1.0);
  float fade = 1.0 - smoothstep(0.15, 0.45, max(fw.x, fw.y)); // kill moire far away
  return line * fade;
}

// soft shadow: 12-tap rotated disc
const vec2 DISC[12] = vec2[](vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621),
  vec2(0.962,-0.195), vec2(0.473,-0.480), vec2(0.519,0.767), vec2(0.185,-0.893), vec2(0.507,0.064),
  vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
float shadow() {
  vec3 p = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  vec2 texel = 1.0 / vec2(textureSize(uShadowMap, 0));
  float a = hash(floor(vWorld * 40.0)) * 6.2832;
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  float s = 0.0;
  for (int i = 0; i < 12; i++) s += texture(uShadowMap, vec3(p.xy + r * DISC[i] * texel * 2.2, p.z - 0.0008));
  return s / 12.0;
}

// seamless studio backdrop: brighter behind the subject, a soft diagonal light shaft, darker toward the top and edges
vec3 studioBg(vec3 d) {
  vec3 c = uStudio;
  vec3 f = normalize(uStudioFwd);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));        // screen right
  float x = dot(d, r), y = d.y, z = max(dot(d, f), 0.0);
  float glow = pow(z, 5.0);
  float shaft = smoothstep(-0.03, 0.16, x + 0.62 * y - 0.1) * (1.0 - smoothstep(0.45, 0.95, x + 0.2 * y));
  vec3 col = c * (0.5 + 0.42 * glow);
  col = mix(col, mix(c, vec3(1.0, 0.82, 0.85), 0.22) * 1.08, shaft * 0.32);
  col *= mix(1.0, 0.5, smoothstep(0.08, 0.75, y));
  col *= mix(1.0, 0.62, smoothstep(0.35, 0.95, abs(x)));
  col *= mix(1.0, 0.8, smoothstep(-0.05, -0.5, y));
  return col;
}

vec3 skyColor(vec3 d) {
  if (dot(uStudio, uStudio) > 0.0) return studioBg(d);
  float t = clamp(d.y, 0.0, 1.0);
  vec3 horizon = uFogColor;
  vec3 zenith = uSkyTop;
  vec3 c = mix(horizon, zenith, pow(t, 0.55));
  float sd = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.93, 0.8) * (pow(sd, 6.0) * 0.12 + pow(sd, 64.0) * 0.35);   // glow
  c = mix(c, vec3(1.0, 0.98, 0.94), smoothstep(0.9993, 0.9997, sd));          // sun disc
  c = mix(c, horizon * 0.96, smoothstep(0.0, -0.08, d.y));                     // below horizon
  return c;
}

void main() {
  if (uSky > 0.5) {
    outColor = vec4(skyColor(normalize(vWorld - uCamPos)), 1.0);
    return;
  }

  vec3 n = normalize(vNormal);
  vec3 base = uColor;
  bool world = uShadowOn > 0.5;

  if (uGrid > 0.5) {
    vec3 an = abs(n);
    vec2 p = an.y > 0.5 ? vWorld.xz : (an.x > 0.5 ? vWorld.zy : vWorld.xy);
    float minor = grid(p, 0.5, 1.0) * 0.1;
    float major = grid(p, 2.0, 1.4) * 0.32;
    base = mix(base, base * 0.62, max(minor, major));
  }

  // material grain: large blotches + fine speckle, like painted concrete / worn metal
  float lum0 = dot(base, vec3(0.3, 0.59, 0.11));
  if (uEmissive < 0.5) {
    vec3 q = world ? vWorld : vLocal * uScale * 4.0;
    float n1 = noise(q * 0.9), n2 = noise(q * 7.0), n3 = noise(q * 31.0);
    float grain = (n1 - 0.5) * 0.12 + (n2 - 0.5) * 0.07 + (n3 - 0.5) * 0.05;
    base *= 1.0 + grain * (world ? 1.0 : 0.6);
  }

  float edge = 0.0;
  if (uEdges > 0.5) {
    vec3 lp = abs(vLocal * uScale);
    vec3 e = uScale * 0.5 - lp + abs(vLocalN) * 1000.0;
    float em = min(e.x, min(e.y, e.z));
    float fw = fwidth(em);
    edge = 1.0 - smoothstep(0.01, 0.01 + fw * 1.5 + 0.004, em);
    base = mix(base, base * 0.5, edge * 0.6);
  }

  // contact shadow at the bottom of vertical faces + a little extra under overhangs
  float ao = 1.0;
  if (uAO < 0.5) {
    // characters / props: soft top-down occlusion instead of the box contact shadow
    ao = mix(0.78, 1.0, n.y * 0.5 + 0.5);
  } else if (abs(n.y) < 0.5) {
    float h = (vLocal.y + 0.5) * uScale.y;
    ao = mix(0.62, 1.0, smoothstep(0.0, 1.1, h));
  } else if (n.y < -0.5) ao = 0.7;

  vec3 albedo = toLin(base) * (world ? 0.82 : 1.0);   // real-world whites are greyer than paper
  vec3 V = normalize(uCamPos - vWorld);
  bool indoor = world ? vWorld.y < UNDER_Y : uViewUnder > 0.5;
  bool studio = dot(uStudio, uStudio) > 0.0;
  if (studio) indoor = false;
  vec3 L = studio ? normalize(uStudioKey) : indoor ? normalize(vec3(0.25, 1.0, 0.2)) : uSunDir;
  float ndl = max(dot(n, L), 0.0);
  float sh = (world && !indoor && ndl > 0.0) ? shadow() : 1.0;

  // sun + sky (hemisphere) + bounce light from the floor
  vec3 sunCol = vec3(1.0, 0.95, 0.86) * 2.25;
  vec3 skyCol = mix(vec3(0.3), toLin(uSkyTop) * 0.6, 0.45) + vec3(0.03);
  vec3 groundCol = vec3(0.2, 0.19, 0.18);
  vec3 hemi = mix(groundCol, skyCol, n.y * 0.5 + 0.5);
  float pool = 0.6;
  if (studio) {
    vec3 sc = toLin(uStudio);
    sunCol = vec3(1.0, 0.95, 0.92) * 1.7;
    skyCol = sc * 0.55 + vec3(0.04);
    hemi = mix(sc * 0.3, sc * 0.2 + vec3(0.07), n.y * 0.5 + 0.5);    // red floor bounce from below, softer from above
  }
  if (indoor) {
    // ceiling lamps every 8 m (at x, z = 8k + 4): warm pools of light on the floor
    vec2 g = (fract(vWorld.xz / 8.0) - 0.5) * 8.0;
    float r2 = dot(g * vec2(0.75, 1.5), g * vec2(0.75, 1.5));
    pool = world ? exp(-r2 * 0.05) : 0.55;
    sunCol = vec3(1.0, 0.88, 0.74) * (0.35 + 1.9 * pool);
    skyCol = vec3(0.12, 0.13, 0.16);
    hemi = mix(vec3(0.035, 0.035, 0.045), vec3(0.13, 0.14, 0.17), n.y * 0.5 + 0.5);
    hemi += vec3(0.2, 0.17, 0.13) * (1.0 - abs(n.y)) * (0.22 + pool * 0.7);   // light washing down the walls
  }

  // glossier when dark (metal, rubber), rougher when light (paint, concrete) -- unless the part has a material
  float rough = uMat.y >= 0.0 ? uMat.y : mix(0.32, 0.82, smoothstep(0.02, 0.45, lum0));
  float metal = uMat.x;
  float specPow = 2.0 / max(rough * rough * rough * rough, 0.002) - 2.0;
  vec3 H = normalize(L + V);
  float ndh = max(dot(n, H), 0.0), vdh = max(dot(V, H), 0.0), ndv = max(dot(n, V), 0.0);
  vec3 F0 = mix(vec3(0.04), albedo * 1.6 + 0.03, metal);
  vec3 Fh = F0 + (1.0 - F0) * pow(1.0 - vdh, 5.0);
  vec3 spec = pow(ndh, specPow) * (specPow + 8.0) / 25.13 * Fh;
  vec3 Fv = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
  // reflected environment: ground below, sky above, with a bright soft band like a studio light
  vec3 Rv = reflect(-V, n);
  vec3 env = studio ? toLin(studioBg(Rv)) * 1.3 : mix(groundCol * 0.8, skyCol * 1.5, smoothstep(-0.25, 0.5, Rv.y));
  env += vec3(1.0, 0.97, 0.92) * smoothstep(0.55, 0.8, Rv.y) * (1.0 - smoothstep(0.86, 0.98, Rv.y)) * (indoor ? 0.35 : 1.1);
  float gloss = (1.0 - rough) * (1.0 - rough);

  vec3 col = albedo * (1.0 - metal * 0.88) * (hemi * ao + sunCol * ndl * sh) + sunCol * spec * ndl * sh * (1.0 - edge * 0.5)
           + env * Fv * mix(0.25, 1.0, metal) * mix(0.08, 1.0, gloss) * ao;
  // rim light (used for characters in the showroom / arena)
  col += toLin(uRim) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 1.6;
  col = mix(col, toLin(uColor) * 2.2, uEmissive);

  vec3 display = toSrgb(aces(col * 0.85));

  // fog in display space so it blends into the sky's horizon, warmer toward the sun
  float f = 1.0 - exp(-pow(uFogDensity * vViewZ, 2.0));
  vec3 vd = -V;
  vec3 fogCol = uFogColor + vec3(0.06, 0.04, 0.0) * pow(max(dot(vd, L), 0.0), 8.0);
  if (studio) fogCol = studioBg(vd);
  if (indoor) {
    fogCol = vec3(0.045, 0.05, 0.065);
    f = 1.0 - exp(-pow(uFogDensity * 1.7 * vViewZ, 2.0));
  }
  display = mix(display, fogCol, f);
  outColor = vec4(display, uAlpha);
}`;

const SHADOW_VERT = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP, uModel;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
const SHADOW_FRAG = `#version 300 es
precision mediump float;
void main() {}`;

function cubeGeometry() {
  const faces = [
    [[1, 0, 0], [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]]],
    [[-1, 0, 0], [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]]],
    [[0, 1, 0], [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]]],
    [[0, -1, 0], [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]]],
    [[0, 0, 1], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]],
    [[0, 0, -1], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]]],
  ];
  const v = [], idx = [];
  faces.forEach(([n, quad], f) => {
    quad.forEach((p) => v.push(...p, ...n));
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

// ---- rounded shapes (all in unit space, centred, extents -0.5..0.5) ----
function sphereGeometry(seg = 40, rings = 28) {
  const v = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const th = (i / rings) * Math.PI, y = Math.cos(th), r = Math.sin(th);
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2, x = r * Math.cos(ph), z = r * Math.sin(ph);
      v.push(x * 0.5, y * 0.5, z * 0.5, x, y, z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

// cylinder along Z (radius 0.5), with caps
function cylinderGeometry(seg = 28) {
  const v = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
    v.push(x * 0.5, y * 0.5, -0.5, x, y, 0, x * 0.5, y * 0.5, 0.5, x, y, 0);
  }
  for (let j = 0; j < seg; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  for (const zs of [-1, 1]) {
    const c = v.length / 6;
    v.push(0, 0, zs * 0.5, 0, 0, zs);
    for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; v.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5, zs * 0.5, 0, 0, zs); }
    for (let j = 0; j < seg; j++) zs > 0 ? idx.push(c, c + 1 + j, c + 2 + j) : idx.push(c, c + 2 + j, c + 1 + j);
  }
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

// box with real (physical) rounded edges of radius r, for a box of size D; returned in unit space
function roundedBoxGeometry(D, r) {
  r = Math.max(0.0005, Math.min(r, Math.min(...D) * 0.48));
  const steps = 4;
  const axisVals = (h) => {
    const a = [];
    for (let k = 0; k <= steps; k++) a.push(-h + r * (1 - Math.cos((k / steps) * Math.PI / 2)));
    for (let k = steps; k >= 0; k--) a.push(h - r * (1 - Math.cos((k / steps) * Math.PI / 2)));
    return a;
  };
  const vals = D.map((d) => axisVals(d / 2));
  const v = [], idx = [];
  for (let f = 0; f < 6; f++) {
    const ax = f >> 1, sg = f & 1 ? -1 : 1;
    const u = (ax + 1) % 3, w = (ax + 2) % 3;
    const base = v.length / 6, nu = vals[u].length, nw = vals[w].length;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nw; j++) {
      const P = [0, 0, 0];
      P[ax] = sg * D[ax] / 2; P[u] = vals[u][i]; P[w] = vals[w][j];
      const inner = P.map((c, k) => Math.max(-D[k] / 2 + r, Math.min(D[k] / 2 - r, c)));
      let N = P.map((c, k) => c - inner[k]);
      const l = Math.hypot(...N);
      if (l < 1e-6) { N = [0, 0, 0]; N[ax] = sg; } else N = N.map((c) => c / l);
      const pos = inner.map((c, k) => (c + N[k] * r) / D[k]);
      v.push(...pos, ...N);
    }
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nw - 1; j++) {
      const a = base + i * nw + j, b = a + nw;
      if (sg > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

// tapered capsule along Z: sphere radius r1 centred at -L/2, r2 at +L/2, joined by a cone.
// Built in physical units then divided by D = [2rm, 2rm, L + 2rm] so it scales like the others.
function capsuleGeometry(L, r1, r2, seg = 32, ringsPerCap = 10) {
  const rm = Math.max(r1, r2), D = [2 * rm, 2 * rm, L + 2 * rm];
  // profile: [z, r, nz, nr]
  const prof = [];
  const k = Math.max(-1, Math.min(1, (r1 - r2) / Math.max(L, 1e-4)));   // cone tangency angle
  const phi = Math.asin(k);
  for (let i = 0; i <= ringsPerCap; i++) {                // back cap: from the tip (-z) to the tangent
    const a = (i / ringsPerCap) * (Math.PI / 2 + phi);
    prof.push([-L / 2 - r1 * Math.cos(a), r1 * Math.sin(a), -Math.cos(a), Math.sin(a)]);
  }
  for (let i = 0; i <= ringsPerCap; i++) {                // front cap: from the tangent to the tip (+z)
    const a = Math.PI / 2 + phi + (i / ringsPerCap) * (Math.PI / 2 - phi);
    prof.push([L / 2 - r2 * Math.cos(a), r2 * Math.sin(a), -Math.cos(a), Math.sin(a)]);
  }
  const v = [], idx = [];
  prof.forEach(([z, r, nz, nr]) => {
    for (let j = 0; j <= seg; j++) {
      const t = (j / seg) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      v.push(c * r / D[0], sn * r / D[1], z / D[2], c * nr, sn * nr, nz);
    }
  });
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);       // counter-clockwise seen from outside
  }
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

// surface materials: [metalness, roughness]; roughness < 0 = pick it from the colour
const MATS = {
  auto: [0, -1],
  metal: [0.55, 0.36],     // anodised / cerakoted metal
  steel: [1, 0.22],        // polished bits: bolts, triggers, pins
  paint: [0.15, 0.42],     // painted metal (white guns)
  poly: [0, 0.6],          // polymer furniture
  rubber: [0, 0.88],
  cloth: [0, 0.82],       // fabric: no shine
  skin: [0, 0.55],
  wood: [0, 0.5],
  brass: [1, 0.28],
  glass: [0.3, 0.05],
};

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(prog, s);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

const SHADOW_SIZE = 2048;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;

    this.prog = compile(gl, VERT, FRAG);
    this.shadowProg = compile(gl, SHADOW_VERT, SHADOW_FRAG);
    this.u = {};
    for (const name of ['uProj', 'uView', 'uModel', 'uScale', 'uColor', 'uFogColor', 'uSunDir', 'uCamPos',
      'uSkyTop', 'uGrid', 'uEdges', 'uEmissive', 'uAlpha', 'uFogDensity', 'uShadowOn', 'uSky', 'uLightVP', 'uShadowMap', 'uViewUnder', 'uAO', 'uRim', 'uMat', 'uStudio', 'uStudioFwd', 'uStudioKey']) {
      this.u[name] = gl.getUniformLocation(this.prog, name);
    }
    this.su = {
      uLightVP: gl.getUniformLocation(this.shadowProg, 'uLightVP'),
      uModel: gl.getUniformLocation(this.shadowProg, 'uModel'),
    };

    const cube = this.makeMesh(cubeGeometry());
    this.vao = cube.vao;
    this.indexCount = cube.count;
    this.cube = cube;
    this.meshes = { sphere: this.makeMesh(sphereGeometry()), cyl: this.makeMesh(cylinderGeometry()) };
    this.rounded = new Map();
    gl.bindVertexArray(this.vao);

    // shadow map
    this.shadowTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.fogColor = [0.86, 0.89, 0.93];
    const sd = [0.45, 0.8, 0.38], l = Math.hypot(...sd);
    this.sunDir = sd.map((v) => v / l);
    this.lightVP = mat4();
    this.setShadowArea([0, 0, 0], 50);

    gl.useProgram(this.prog);
    gl.uniform3fv(this.u.uSunDir, this.sunDir);
    gl.uniform3fv(this.u.uFogColor, this.fogColor);
    gl.uniform3fv(this.u.uSkyTop, [0.48, 0.64, 0.86]);
    gl.uniform1i(this.u.uShadowMap, 1);
    gl.uniformMatrix4fv(this.u.uLightVP, false, this.lightVP);
    this.drawCalls = 0;
  }

  makeMesh({ verts, indices }) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return { vao, count: indices.length };
  }

  // shape: undefined = plain box, 'sphere', 'cyl' (along Z), or a number = box with rounded edges of that radius (m)
  meshFor(shape, scl) {
    if (shape == null) return this.cube;
    if (typeof shape === 'string') return this.meshes[shape] || this.cube;
    if (typeof shape === 'object') {
      // { cap: [r1, r2] } with scl = [2rm, 2rm, L + 2rm]
      const q = (x) => Math.max(1, Math.round(Math.abs(x) * 500));
      const [r1, r2] = shape.cap, rm = Math.max(r1, r2);
      const L = Math.max(0.002, scl[2] - 2 * rm);
      const key = `c${q(L)}_${q(r1)}_${q(r2)}`;
      let m = this.rounded.get(key);
      if (!m) {
        if (this.rounded.size > 4000) this.rounded.clear();
        m = this.makeMesh(capsuleGeometry(q(L) / 500, q(r1) / 500, q(r2) / 500));
        this.rounded.set(key, m);
      }
      return m;
    }
    const q = (x) => Math.max(1, Math.round(Math.abs(x) * 500));      // 2 mm buckets
    const key = `${q(scl[0])}_${q(scl[1])}_${q(scl[2])}_${q(shape)}`;
    let m = this.rounded.get(key);
    if (!m) {
      if (this.rounded.size > 4000) this.rounded.clear();
      m = this.makeMesh(roundedBoxGeometry([q(scl[0]) / 500, q(scl[1]) / 500, q(scl[2]) / 500], q(shape) / 500));
      this.rounded.set(key, m);
    }
    return m;
  }

  bindMesh(m) {
    if (this.boundMesh !== m) { this.gl.bindVertexArray(m.vao); this.boundMesh = m; }
  }

  // Orthographic sun camera covering a square area around `center`.
  setShadowArea(center, half) {
    const proj = ortho(mat4(), -half, half, -half, half, 1, 200);
    const eye = center.map((c, i) => c + this.sunDir[i] * 90);
    const view = lookDir(mat4(), eye, this.sunDir.map((v) => -v));
    mul(this.lightVP, proj, view);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.size = [w, h];
    return w / h;
  }

  // ---- shadow pass ----
  beginShadow() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProg);
    gl.uniformMatrix4fv(this.su.uLightVP, false, this.lightVP);
    gl.disable(gl.CULL_FACE); // thin boxes cast cleaner shadows double-sided
  }

  shadowDraw(model, shape, scl) {
    const m = this.meshFor(shape, scl);
    this.bindMesh(m);
    this.gl.uniformMatrix4fv(this.su.uModel, false, model);
    this.gl.drawElements(this.gl.TRIANGLES, m.count, this.gl.UNSIGNED_SHORT, 0);
  }

  endShadow() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.prog);
  }

  // ---- main pass ----
  begin() {
    const gl = this.gl;
    this.boundMesh = null;
    this.lastMat = null;
    gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.clearColor(...this.fogColor, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    this.drawCalls = 0;
  }

  clearDepth() { this.gl.clear(this.gl.DEPTH_BUFFER_BIT); }

  // the gun is lit by lamps instead of the sun when you're underground
  setUnder(on) { this.gl.uniform1f(this.u.uViewUnder, on ? 1 : 0); }

  setCamera(proj, view, fogDensity, camPos = [0, 0, 0], shadows = true) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniform1f(this.u.uFogDensity, fogDensity);
    gl.uniform3fv(this.u.uCamPos, camPos);
    gl.uniform1f(this.u.uShadowOn, shadows ? 1 : 0);
    gl.uniformMatrix4fv(this.u.uLightVP, false, this.lightVP);
  }

  drawSky(camPos) {
    const gl = this.gl;
    const m = mat4();
    m[0] = m[5] = m[10] = 400;
    m[12] = camPos[0]; m[13] = camPos[1]; m[14] = camPos[2];
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.uniform1f(this.u.uSky, 1);
    gl.uniform1f(this.u.uAlpha, 1);
    gl.uniformMatrix4fv(this.u.uModel, false, m);
    gl.uniform3fv(this.u.uScale, [400, 400, 400]);
    this.bindMesh(this.cube);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(this.u.uSky, 0);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  setBlend(on) {
    const gl = this.gl;
    if (on) { gl.enable(gl.BLEND); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  draw(model, scl, color, grid = 0, edges = 1, emissive = 0, alpha = 1, shape, mat) {
    const gl = this.gl, u = this.u;
    const mt = mat ? (MATS[mat] || mat) : MATS.auto;
    if (mt !== this.lastMat) { gl.uniform2fv(u.uMat, mt); this.lastMat = mt; }
    const m = this.meshFor(shape, scl);
    this.bindMesh(m);
    if (shape != null) edges = 0;
    gl.uniform1f(u.uAO, shape != null ? 0 : 1);
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniform3fv(u.uScale, scl);
    gl.uniform3fv(u.uColor, color);
    gl.uniform1f(u.uGrid, grid);
    gl.uniform1f(u.uEdges, edges);
    gl.uniform1f(u.uEmissive, emissive);
    gl.uniform1f(u.uAlpha, alpha);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    this.drawCalls++;
  }

  // the menu's studio look: backdrop colour (null = off), camera forward and key light direction
  setStudio(col, fwd = [0, 0, 1], key = [0.5, 0.8, -0.6]) {
    const gl = this.gl;
    gl.uniform3fv(this.u.uStudio, col || [0, 0, 0]);
    gl.uniform3fv(this.u.uStudioFwd, fwd);
    gl.uniform3fv(this.u.uStudioKey, key);
  }
  setRim(c) { this.gl.uniform3fv(this.u.uRim, c || [0, 0, 0]); }

  // draw a part object { model, scale, color, emissive, shape, alpha }
  drawPart(p, edges = 1) {
    this.draw(p.model, p.scale, p.color, 0, edges, p.emissive || 0, p.alpha ?? 1, p.shape, p.mat);
  }

  drawBox(b) {
    this.draw(b.model, b.scale, b.color, b.grid ? 1 : 0, b.edges ? 1 : 0, b.emissive, b.alpha ?? 1, b.shape);
  }
}
