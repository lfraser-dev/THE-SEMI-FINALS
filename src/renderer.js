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
uniform float uGrid, uEdges, uEmissive, uAlpha, uFogDensity, uShadowOn, uSky;
uniform sampler2DShadow uShadowMap;
out vec4 outColor;

float grid(vec2 p, float spacing, float px) {
  vec2 c = p / spacing;
  vec2 fw = max(fwidth(c), vec2(1e-4));
  vec2 d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - clamp(min(d.x, d.y) - px * 0.5 + 0.5, 0.0, 1.0);
  float fade = 1.0 - smoothstep(0.15, 0.45, max(fw.x, fw.y)); // kill moire far away
  return line * fade;
}

float shadow() {
  vec3 p = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  vec2 texel = 1.0 / vec2(textureSize(uShadowMap, 0));
  float s = 0.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      s += texture(uShadowMap, vec3(p.xy + vec2(x, y) * texel * 1.25, p.z - 0.0008));
  return s / 9.0;
}

void main() {
  if (uSky > 0.5) {
    vec3 d = normalize(vWorld - uCamPos);
    float t = clamp(d.y * 1.8, 0.0, 1.0);
    vec3 c = mix(uFogColor, uSkyTop, pow(t, 0.7));
    c += vec3(1.0, 0.97, 0.9) * pow(max(dot(d, uSunDir), 0.0), 48.0) * 0.25;
    outColor = vec4(c, 1.0);
    return;
  }

  vec3 n = normalize(vNormal);
  vec3 base = uColor;

  if (uGrid > 0.5) {
    vec3 an = abs(n);
    vec2 p = an.y > 0.5 ? vWorld.xz : (an.x > 0.5 ? vWorld.zy : vWorld.xy);
    float minor = grid(p, 0.5, 1.0) * 0.2;
    float major = grid(p, 2.0, 1.6) * 0.45;
    base = mix(base, base * 0.5, max(minor, major));
  }

  if (uEdges > 0.5) {
    vec3 lp = abs(vLocal * uScale);
    vec3 e = uScale * 0.5 - lp + abs(vLocalN) * 1000.0;
    float em = min(e.x, min(e.y, e.z));
    float fw = fwidth(em);
    float edge = 1.0 - smoothstep(0.012, 0.012 + fw * 1.5 + 0.004, em);
    base = mix(base, base * 0.35, edge * 0.85);
  }

  // cheap contact shadow at the bottom of vertical faces
  float ao = 1.0;
  if (abs(n.y) < 0.5) {
    float h = (vLocal.y + 0.5) * uScale.y;
    ao = mix(0.72, 1.0, smoothstep(0.0, 0.9, h));
  }

  float sun = max(dot(n, uSunDir), 0.0);
  if (uShadowOn > 0.5 && sun > 0.0) sun *= shadow();
  vec3 ambient = mix(vec3(0.5, 0.51, 0.55), vec3(0.6, 0.61, 0.64), n.y * 0.5 + 0.5);
  vec3 col = base * (ambient + vec3(1.0, 0.98, 0.94) * 0.46 * sun) * ao;
  col = mix(col, uColor, uEmissive);

  float f = 1.0 - exp(-pow(uFogDensity * vViewZ, 2.0));
  col = mix(col, uFogColor, f);
  outColor = vec4(col, uAlpha);
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
      'uSkyTop', 'uGrid', 'uEdges', 'uEmissive', 'uAlpha', 'uFogDensity', 'uShadowOn', 'uSky', 'uLightVP', 'uShadowMap']) {
      this.u[name] = gl.getUniformLocation(this.prog, name);
    }
    this.su = {
      uLightVP: gl.getUniformLocation(this.shadowProg, 'uLightVP'),
      uModel: gl.getUniformLocation(this.shadowProg, 'uModel'),
    };

    const { verts, indices } = cubeGeometry();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
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
    this.indexCount = indices.length;

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

    this.fogColor = [0.92, 0.925, 0.94];
    const sd = [0.45, 0.8, 0.38], l = Math.hypot(...sd);
    this.sunDir = sd.map((v) => v / l);
    this.lightVP = mat4();
    this.setShadowArea([0, 0, 0], 50);

    gl.useProgram(this.prog);
    gl.uniform3fv(this.u.uSunDir, this.sunDir);
    gl.uniform3fv(this.u.uFogColor, this.fogColor);
    gl.uniform3fv(this.u.uSkyTop, [0.72, 0.78, 0.88]);
    gl.uniform1i(this.u.uShadowMap, 1);
    gl.uniformMatrix4fv(this.u.uLightVP, false, this.lightVP);
    this.drawCalls = 0;
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

  shadowDraw(model) {
    this.gl.uniformMatrix4fv(this.su.uModel, false, model);
    this.gl.drawElements(this.gl.TRIANGLES, this.indexCount, this.gl.UNSIGNED_SHORT, 0);
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
    gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.clearColor(...this.fogColor, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    this.drawCalls = 0;
  }

  clearDepth() { this.gl.clear(this.gl.DEPTH_BUFFER_BIT); }

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
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(this.u.uSky, 0);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  setBlend(on) {
    const gl = this.gl;
    if (on) { gl.enable(gl.BLEND); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  draw(model, scl, color, grid = 0, edges = 1, emissive = 0, alpha = 1) {
    const gl = this.gl, u = this.u;
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniform3fv(u.uScale, scl);
    gl.uniform3fv(u.uColor, color);
    gl.uniform1f(u.uGrid, grid);
    gl.uniform1f(u.uEdges, edges);
    gl.uniform1f(u.uEmissive, emissive);
    gl.uniform1f(u.uAlpha, alpha);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    this.drawCalls++;
  }

  drawBox(b) {
    this.draw(b.model, b.scale, b.color, b.grid ? 1 : 0, b.edges ? 1 : 0, b.emissive, b.alpha ?? 1);
  }
}
