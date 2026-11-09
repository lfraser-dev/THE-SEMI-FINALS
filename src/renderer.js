// Minimal WebGL2 renderer. Everything in the game is a box, drawn with one shader
// that paints world-space grid lines (the "sandbox" look) and dark box edges.

const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uProj, uView, uModel;
uniform vec3 uScale;
out vec3 vWorld, vNormal, vLocal, vLocalN;
out float vViewZ;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vLocal = aPos;
  vLocalN = aNormal;
  vNormal = normalize(mat3(uModel) * (aNormal / uScale));
  vec4 v = uView * w;
  vViewZ = -v.z;
  gl_Position = uProj * v;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld, vNormal, vLocal, vLocalN;
in float vViewZ;
uniform vec3 uColor, uScale, uFogColor, uSunDir;
uniform float uGrid, uEdges, uEmissive, uAlpha, uFogDensity;
out vec4 outColor;

float grid(vec2 p, float spacing, float px) {
  vec2 c = p / spacing;
  vec2 fw = max(fwidth(c), vec2(1e-4));
  vec2 d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - clamp(min(d.x, d.y) - px * 0.5 + 0.5, 0.0, 1.0);
  float fade = 1.0 - smoothstep(0.15, 0.45, max(fw.x, fw.y)); // kill moire far away
  return line * fade;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = uColor;

  if (uGrid > 0.5) {
    vec3 an = abs(n);
    vec2 p = an.y > 0.5 ? vWorld.xz : (an.x > 0.5 ? vWorld.zy : vWorld.xy);
    float minor = grid(p, 0.5, 1.0) * 0.22;
    float major = grid(p, 2.0, 1.6) * 0.5;
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
  vec3 col = base * (0.56 + 0.3 * (n.y * 0.5 + 0.5) + 0.26 * sun) * ao;
  col = mix(col, uColor, uEmissive);

  float f = 1.0 - exp(-pow(uFogDensity * vViewZ, 2.0));
  col = mix(col, uFogColor, f);
  outColor = vec4(col, uAlpha);
}`;

function cubeGeometry() {
  // 6 faces, 4 verts each: position(3) normal(3)
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

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;

    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);

    this.u = {};
    for (const name of ['uProj', 'uView', 'uModel', 'uScale', 'uColor', 'uFogColor', 'uSunDir',
      'uGrid', 'uEdges', 'uEmissive', 'uAlpha', 'uFogDensity']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }

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

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.fogColor = [0.93, 0.935, 0.945];
    const sd = [0.35, 0.85, 0.4], l = Math.hypot(...sd);
    gl.uniform3f(this.u.uSunDir, sd[0] / l, sd[1] / l, sd[2] / l);
    gl.uniform3fv(this.u.uFogColor, this.fogColor);
    this.drawCalls = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return w / h;
  }

  begin() {
    const gl = this.gl;
    gl.clearColor(...this.fogColor, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawCalls = 0;
  }

  clearDepth() { this.gl.clear(this.gl.DEPTH_BUFFER_BIT); }

  setCamera(proj, view, fogDensity) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniform1f(this.u.uFogDensity, fogDensity);
  }

  setBlend(on) {
    const gl = this.gl;
    if (on) { gl.enable(gl.BLEND); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  // opts: { grid, edges, emissive, alpha }
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
    this.draw(b.model, b.scale, b.color, b.grid ? 1 : 0, b.edges ? 1 : 0, b.emissive);
  }
}
