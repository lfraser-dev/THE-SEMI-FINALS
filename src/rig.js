// Helpers for building smooth characters out of tapered capsules, ellipsoids and rounded boxes.
// Everything is placed in world space with an explicit orientation basis (right, up, back).
import { compose, mat4, anglesFor } from './math.js';

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// basis whose up axis points along `up` and faces roughly toward `-back`
export function basisFrom(up, back) {
  const U = norm(up);
  let R = norm(cross(U, back));
  const B = norm(cross(R, U));
  return { R, U, B };
}

export class Builder {
  constructor() { this.models = []; this.out = []; this.i = 0; }
  reset() { this.out = []; this.i = 0; return this; }
  M() { if (this.i >= this.models.length) this.models.push(mat4()); return this.models[this.i++]; }

  // matrix from basis + size at pos
  basisModel(pos, b, size) {
    const m = this.M();
    m[0] = b.R[0] * size[0]; m[1] = b.R[1] * size[0]; m[2] = b.R[2] * size[0]; m[3] = 0;
    m[4] = b.U[0] * size[1]; m[5] = b.U[1] * size[1]; m[6] = b.U[2] * size[1]; m[7] = 0;
    m[8] = b.B[0] * size[2]; m[9] = b.B[1] * size[2]; m[10] = b.B[2] * size[2]; m[11] = 0;
    m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2]; m[15] = 1;
    return m;
  }

  // tapered capsule from A (radius r1) to C (radius r2)
  capsule(A, C, r1, r2, color, em = 0) {
    const d = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], L = Math.hypot(...d);
    const rm = Math.max(r1, r2);
    const scale = [2 * rm, 2 * rm, L + 2 * rm];
    const m = this.M();
    compose(m, [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2, (A[2] + C[2]) / 2], anglesFor(L > 1e-5 ? d : [0, 0, 1]), scale);
    this.out.push({ model: m, scale, color, emissive: em, shape: { cap: [r2, r1] } });   // mesh -z end lies toward C (anglesFor maps -z to d)
  }

  ellipsoid(pos, b, size, color, em = 0) {
    this.out.push({ model: this.basisModel(pos, b, size), scale: size, color, emissive: em, shape: 'sphere' });
  }

  rbox(pos, b, size, r, color, em = 0) {
    this.out.push({ model: this.basisModel(pos, b, size), scale: size, color, emissive: em, shape: r });
  }

  cyl(pos, b, size, color, em = 0) {   // cylinder along the basis' back axis
    this.out.push({ model: this.basisModel(pos, b, size), scale: size, color, emissive: em, shape: 'cyl' });
  }
}

// point helpers in a basis
export const at = (o, b, v) => [
  o[0] + b.R[0] * v[0] + b.U[0] * v[1] + b.B[0] * v[2],
  o[1] + b.R[1] * v[0] + b.U[1] * v[1] + b.B[1] * v[2],
  o[2] + b.R[2] * v[0] + b.U[2] * v[1] + b.B[2] * v[2],
];
// rotate a basis about its own right axis by `a` (tilt forward with negative a)
export function pitchBasis(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { R: b.R, U: b.U.map((v, i) => v * c + b.B[i] * s), B: b.B.map((v, i) => v * c - b.U[i] * s) };
}
export function yawBasis(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { U: b.U, R: b.R.map((v, i) => v * c - b.B[i] * s), B: b.B.map((v, i) => v * c + b.R[i] * s) };
}
