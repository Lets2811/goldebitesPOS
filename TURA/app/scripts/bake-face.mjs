// Bakes the head mesh into the cloud of points TURA's hologram is made of.
//
//   node scripts/bake-face.mjs            writes src/assets/face-cloud.bin + .json
//   node scripts/bake-face.mjs --preview  also writes scripts/face-cloud-preview.bmp
//
// The mesh is only a mould: the app never loads it. What the app gets is, for
// each point, where it sits on the face, which way the surface faces there,
// and what the shader needs to bring it to life (how much it follows the jaw,
// when it arrives while the face is forming, how readily it drifts away).
//
// To use another head, replace the model below and re-run. The mesh has to
// face +Z with Y up; the landmarks are found from its shape, and printed, so
// check them (and the preview) after baking.
//
// Model: "Infinite, 3D Head Scan" by Lee Perry-Smith (www.triplegangers.com),
// Creative Commons Attribution 3.0. See scripts/models/LeePerrySmith_License.txt.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODEL = new URL('./models/LeePerrySmith.glb', import.meta.url);
const OUT_BIN = new URL('../src/assets/face-cloud.bin', import.meta.url);
const OUT_META = new URL('../src/assets/face-cloud.json', import.meta.url);
const OUT_PREVIEW = new URL('./face-cloud-preview.bmp', import.meta.url);

/** Points in the cloud. They are shuffled, so a device can use just the first N. */
const COUNT = 26000;
/** Model units to scene units: the head ends up about 1.8 tall. */
const SCALE = 0.42;
/** Positions are stored as 16-bit integers covering this many scene units either way. */
const RANGE = 2.5;

const KIND = { surface: 0, accent: 1, iris: 2, line: 3, catchlight: 4 };

// A fixed seed, so re-baking the same mesh gives the same cloud.
let seed = 20261008;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (from, to, value) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
/** 1 at the centre of an ellipse, fading out over its radii. */
const blob = (dx, dy, rx, ry) => Math.exp(-((dx / rx) ** 2 + (dy / ry) ** 2));

// ---- Mesh ----

function loadMesh(url) {
  const file = readFileSync(url);
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const bin = file.subarray(20 + jsonLength + 8);
  const primitive = gltf.meshes[0].primitives[0];
  const read = (index, Type, size) => {
    const accessor = gltf.accessors[index];
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const length = accessor.count * size;
    // Copied, because the data is not always aligned for a typed array view.
    return new Type(bin.buffer.slice(offset, offset + length * Type.BYTES_PER_ELEMENT));
  };
  const indexType = gltf.accessors[primitive.indices].componentType === 5125 ? Uint32Array : Uint16Array;
  return {
    positions: read(primitive.attributes.POSITION, Float32Array, 3),
    normals: read(primitive.attributes.NORMAL, Float32Array, 3),
    indices: skinOnly(read(primitive.indices, indexType, 1)),
  };
}

/**
 * Keeps the largest connected piece of the mesh: the skin. A scanned head
 * also carries eyeballs, the inside of the mouth and a cap under the bust,
 * which a solid render hides behind the skin but a cloud of points would
 * show right through it.
 */
function skinOnly(indices) {
  const group = new Map();
  const find = (vertex) => {
    let root = vertex;
    while (group.has(root) && group.get(root) !== root) root = group.get(root);
    group.set(vertex, root);
    return root;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const root = find(indices[t]);
    group.set(find(indices[t + 1]), root);
    group.set(find(indices[t + 2]), root);
  }
  const sizes = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const root = find(indices[t]);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  const skin = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  return indices.filter((_, position) => find(indices[position - (position % 3)]) === skin);
}

const mesh = loadMesh(MODEL);
const vertexCount = mesh.positions.length / 3;
const triangleCount = mesh.indices.length / 3;

/**
 * How sharply the surface bends at each vertex, from 0 (flat) to 1: how much
 * the normal changes along the edges that meet there. This is what puts more
 * points on the eyelids, the nostrils and the edges of the lips without
 * anyone marking them.
 */
function measureCurvature() {
  const sum = new Float32Array(vertexCount);
  const edges = new Uint16Array(vertexCount);
  const { positions: p, normals: n, indices } = mesh;
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e];
      const b = indices[t + ((e + 1) % 3)];
      const bend = Math.hypot(n[a * 3] - n[b * 3], n[a * 3 + 1] - n[b * 3 + 1], n[a * 3 + 2] - n[b * 3 + 2]);
      const length = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
      // Slivers of triangles would otherwise count as razor-sharp folds.
      const curvature = bend / Math.max(length, 0.06);
      sum[a] += curvature;
      sum[b] += curvature;
      edges[a] += 1;
      edges[b] += 1;
    }
  }
  const curvature = sum.map((value, index) => value / Math.max(1, edges[index]));
  const high = [...curvature].sort((a, b) => a - b)[Math.floor(vertexCount * 0.95)];
  return curvature.map((value) => clamp01(value / high));
}
const curvature = measureCurvature();

/** A random point of a triangle, with everything the mesh knows there. */
function pointOn(triangle) {
  const [a, b, c] = [0, 1, 2].map((corner) => mesh.indices[triangle * 3 + corner]);
  let u = random();
  let v = random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;
  const mix = (array, component) =>
    array[a * 3 + component] * u + array[b * 3 + component] * v + array[c * 3 + component] * w;
  const normal = [mix(mesh.normals, 0), mix(mesh.normals, 1), mix(mesh.normals, 2)];
  const length = Math.hypot(...normal) || 1;
  return {
    x: mix(mesh.positions, 0),
    y: mix(mesh.positions, 1),
    z: mix(mesh.positions, 2),
    nx: normal[0] / length,
    ny: normal[1] / length,
    nz: normal[2] / length,
    curvature: curvature[a] * u + curvature[b] * v + curvature[c] * w,
  };
}

function triangleArea(triangle) {
  const [a, b, c] = [0, 1, 2].map((corner) => mesh.indices[triangle * 3 + corner] * 3);
  const p = mesh.positions;
  const [ux, uy, uz] = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
  const [vx, vy, vz] = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

// ---- The face seen from the front, as a height map ----

const CELL = 0.02;
const MAP = { left: -2.4, bottom: -1.4, columns: 240, rows: 290 };
const depth = new Float32Array(MAP.columns * MAP.rows).fill(NaN);
for (let triangle = 0; triangle < triangleCount; triangle++) {
  const samples = Math.ceil(triangleArea(triangle) / (CELL * CELL)) * 3 + 3;
  for (let sample = 0; sample < samples; sample++) {
    const point = pointOn(triangle);
    if (point.nz < 0.05) {
      continue;
    }
    const column = Math.floor((point.x - MAP.left) / CELL);
    const row = Math.floor((point.y - MAP.bottom) / CELL);
    if (column < 0 || column >= MAP.columns || row < 0 || row >= MAP.rows) {
      continue;
    }
    const cell = row * MAP.columns + column;
    if (!(depth[cell] >= point.z)) {
      depth[cell] = point.z;
    }
  }
}
/** How far forward the front of the head is at (x, y); NaN where there is no head. */
function depthAt(x, y) {
  const column = Math.floor((x - MAP.left) / CELL);
  const row = Math.floor((y - MAP.bottom) / CELL);
  if (column < 0 || column >= MAP.columns || row < 0 || row >= MAP.rows) {
    return NaN;
  }
  return depth[row * MAP.columns + column];
}
/** The same, averaged over a small disc to smooth out the grid. */
function smoothDepth(x, y, radius = 0.05) {
  let sum = 0;
  let count = 0;
  for (let dx = -radius; dx <= radius; dx += CELL) {
    for (let dy = -radius; dy <= radius; dy += CELL) {
      const value = depthAt(x + dx, y + dy);
      if (!Number.isNaN(value)) {
        sum += value;
        count += 1;
      }
    }
  }
  return count ? sum / count : NaN;
}

// ---- Landmarks, found from the shape ----

function findLandmarks() {
  // The tip of the nose is the point of the face that sticks out most.
  let nose = { y: 1, z: -Infinity };
  for (let y = 0.3; y < 1.8; y += CELL) {
    const z = smoothDepth(0, y);
    if (z > nose.z) {
      nose = { y, z };
    }
  }

  // Down the middle of the face from the nose the profile goes: under the
  // nose (in), upper lip (out), between the lips (in), lower lip (out),
  // under the lip (in), chin (out).
  const profile = [];
  for (let y = nose.y - 0.2; y > nose.y - 2; y -= CELL) {
    profile.push({ y, z: smoothDepth(0, y, 0.04) });
  }
  const turns = [];
  let seeking = 'in';
  for (let index = 2; index < profile.length - 2 && turns.length < 5; index++) {
    const here = profile[index].z;
    const around = [profile[index - 2].z, profile[index - 1].z, profile[index + 1].z, profile[index + 2].z];
    const isTurn = seeking === 'in' ? around.every((z) => z >= here) : around.every((z) => z <= here);
    if (isTurn) {
      turns.push(profile[index]);
      seeking = seeking === 'in' ? 'out' : 'in';
    }
  }
  const [underNose, upperLip, seam, lowerLip, underLip] = turns;
  let chin = { y: underLip.y, z: -Infinity };
  for (const point of profile) {
    if (point.y < underLip.y && point.y > underLip.y - 0.6 && point.z > chin.z) {
      chin = point;
    }
  }

  // The eyes sit where the proportions of a face put them, measured from the
  // nose and the chin; from there each is nudged onto the bulge of the
  // eyeball, the point of the socket that stands out from what surrounds it.
  const lowerFace = nose.y - chin.y;
  const expected = { x: 0.54 * lowerFace, y: nose.y + 0.42 * lowerFace };
  let eye = { ...expected, bulge: -Infinity };
  for (let x = expected.x - 0.1; x <= expected.x + 0.1; x += CELL) {
    for (let y = expected.y - 0.1; y <= expected.y + 0.1; y += CELL) {
      let ring = 0;
      for (let step = 0; step < 12; step++) {
        const angle = (step / 12) * Math.PI * 2;
        ring += smoothDepth(x + 0.34 * Math.cos(angle), y + 0.22 * Math.sin(angle), 0.03);
      }
      const bulge = (smoothDepth(x, y) + smoothDepth(-x, y)) / 2 - ring / 12;
      if (bulge > eye.bulge) {
        eye = { x, y, bulge };
      }
    }
  }

  return { nose, underNose, upperLip, seam, lowerLip, underLip, chin, eye };
}
const marks = findLandmarks();
const mouthHalfWidth = 0.62;
/** Where the line between the lips runs at x: the deepest point of the groove there. */
function seamAt(x) {
  let best = { y: marks.seam.y, z: Infinity };
  for (let y = marks.seam.y - 0.1; y <= marks.seam.y + 0.1; y += CELL / 2) {
    // Averaged along the mouth as well, so the line does not zigzag.
    const z = (smoothDepth(x - 0.05, y, 0.03) + smoothDepth(x, y, 0.03) + smoothDepth(x + 0.05, y, 0.03)) / 3;
    if (z < best.z) {
      best = { y, z };
    }
  }
  // Towards the corners the groove fades out, so the line eases back to level.
  const corner = (Math.abs(x) / mouthHalfWidth) ** 2;
  return best.y + (marks.seam.y - best.y) * 0.6 * corner;
}

// ---- What each point of the surface is ----

/** How much more (or less) densely a place is covered than plain skin. */
function describe(point) {
  const { x, y, nz } = point;
  const side = Math.abs(x);
  const front = nz > 0;
  const onFace = front && y > marks.chin.y - 0.25 && y < marks.eye.y + 1.4;

  const eye = front ? blob(side - marks.eye.x, y - marks.eye.y, 0.4, 0.22) : 0;
  const brow = front ? blob(side - marks.eye.x, y - (marks.eye.y + 0.34), 0.5, 0.12) : 0;
  const nose = front ? blob(x, y - (marks.nose.y + 0.3), 0.4, 0.62) : 0;
  const lips = front ? blob(x, y - marks.seam.y, 0.66, 0.2) : 0;
  // Seen from the front, the outline of the head is where the surface turns side-on.
  const rim = smoothstep(0.38, 0.04, Math.abs(nz));
  const below = y < marks.chin.y - 0.5;
  const shoulders = smoothstep(marks.chin.y - 1.2, marks.chin.y - 2.6, y);

  let density = 1;
  if (nz < -0.1) density *= 0.07; // the back of the head is hardly seen
  if (onFace) density *= 2.4;
  if (below) density *= 0.42 - 0.26 * shoulders; // neck and shoulders are only hinted at
  density *= 1 + 5 * eye + 3 * brow + 2.6 * nose + 5.5 * lips;
  density *= 1 + 2.6 * point.curvature;
  density *= 1 + (below ? 3.2 : 2.4) * rim;

  // The lower lip, the chin and the jaw under them move together when the
  // mouth opens; the upper lip lifts a little the other way.
  const underSeam = smoothstep(seamAt(clamp(x)) - 0.01, seamAt(clamp(x)) - 0.1, y);
  const jaw =
    nz > -0.2
      ? underSeam * Math.exp(-((x / 1.25) ** 2)) * smoothstep(marks.chin.y - 0.75, marks.chin.y - 0.2, y) -
        0.22 * blob(x, y - (marks.seam.y + 0.11), 0.5, 0.09)
      : 0;

  // Outer parts come loose first: the sides of the head, then neck and shoulders.
  const outward = Math.hypot(x / 1.25, (y - (marks.nose.y + 0.35)) / 1.75);
  const edge = clamp01(Math.max(smoothstep(0.5, 0.0, nz), smoothstep(0.75, 1.35, outward), below ? 0.85 : 0));

  // While the face forms, a sparse cast of the whole head comes first, then
  // the eyes, then nose, mouth and jaw, and last whatever fills in.
  let order;
  const roll = random();
  if (roll < 0.2) order = 0.02 + 0.28 * random();
  else if (eye > 0.35) order = 0.3 + 0.18 * random();
  else if (lips > 0.3 || nose > 0.45 || (onFace && point.curvature > 0.5)) order = 0.48 + 0.3 * random();
  else order = 0.62 + 0.38 * random();
  if (below) order = Math.max(order, 0.55 + 0.45 * random());

  return {
    density,
    jaw,
    edge,
    order,
    bright: clamp01(0.55 * point.curvature + 0.35 * rim * (below ? 0.6 : 1) + 0.25 * (eye + lips)),
  };
}
function clamp(x) {
  return Math.max(-mouthHalfWidth, Math.min(mouthHalfWidth, x));
}

// ---- Sampling ----

const cloud = [];
const push = (point, info, kind = KIND.surface) => {
  cloud.push({ ...point, ...info, kind: kind === KIND.surface && random() < 0.022 ? KIND.accent : kind });
};

// Features drawn on top of the surface: lines of points where the scan alone
// would be too soft, and the irises, which a scan with its eyes closed lacks.
const feature = [];
function surfacePoint(x, y, lift) {
  const z = smoothDepth(x, y, 0.03);
  if (Number.isNaN(z)) {
    return null;
  }
  const slopeX = (smoothDepth(x + 0.04, y) - smoothDepth(x - 0.04, y)) / 0.08;
  const slopeY = (smoothDepth(x, y + 0.04) - smoothDepth(x, y - 0.04)) / 0.08;
  const length = Math.hypot(slopeX || 0, slopeY || 0, 1);
  return { x, y, z: z + lift, nx: -(slopeX || 0) / length, ny: -(slopeY || 0) / length, nz: 1 / length };
}
const jitter = (amount) => (random() - 0.5) * amount;

const EYE = { halfWidth: 0.34, halfHeight: 0.13, iris: 0.17, pupil: 0.066 };
/** Half the opening of the eye at a distance from its centre: an almond. */
const lidAt = (dx) => EYE.halfHeight * Math.sqrt(Math.max(0, 1 - (dx / EYE.halfWidth) ** 2));
const eyes = [-1, 1].map((sign) => {
  const x = sign * marks.eye.x;
  // The iris is a flat disc just in front of the closed lid of the scan.
  return { x, y: marks.eye.y, z: smoothDepth(x, marks.eye.y, 0.06) + 0.03 };
});
for (const eye of eyes) {
  const eyeInfo = (bright) => ({ jaw: 0, edge: 0, order: 0.3 + 0.16 * random(), bright });
  const lid = (dx, dy, bright) => {
    const point = surfacePoint(eye.x + dx, eye.y + dy, 0.02);
    if (point) feature.push({ ...point, ...eyeInfo(bright), kind: KIND.line });
  };
  // Upper lid: a firm line, thicker towards the outer corner like a lash line.
  for (let n = 0; n < 330; n++) {
    const along = random() * 2 - 1;
    const dx = along * EYE.halfWidth;
    const outer = Math.max(0, along * Math.sign(eye.x)); // 0 at the nose, 1 at the temple
    lid(dx, lidAt(dx) + jitter(0.01 + 0.016 * outer), 0.95);
  }
  // Lower lid: lighter and flatter.
  for (let n = 0; n < 150; n++) {
    const dx = (random() * 2 - 1) * EYE.halfWidth;
    lid(dx, -0.8 * lidAt(dx) + jitter(0.01), 0.5);
  }
  // The crease above the upper lid, faint.
  for (let n = 0; n < 110; n++) {
    const dx = (random() * 2 - 1) * EYE.halfWidth * 0.92;
    lid(dx, lidAt(dx) * 1.05 + 0.07 + jitter(0.012), 0.25);
  }

  // Iris, drawn the way one looks up close: a crisp outer ring, fibres
  // running in towards the pupil and brightening outwards, a second ring
  // around the pupil, and the pupil itself left empty so it reads as dark.
  // It is stored whole and flat; the shader moves it with the gaze, widens
  // the pupil, and hides whatever part is behind the lids at that moment.
  const iris = (radius, angle, bright) => {
    feature.push({
      x: eye.x + radius * Math.cos(angle),
      y: eye.y + radius * Math.sin(angle),
      z: eye.z,
      nx: 0,
      ny: 0,
      nz: 1,
      ...eyeInfo(bright),
      kind: KIND.iris,
    });
  };
  const band = EYE.iris - EYE.pupil;
  for (let n = 0; n < 240; n++) iris(EYE.iris + jitter(0.005), random() * Math.PI * 2, 1);
  for (let n = 0; n < 520; n++) {
    const fibre = Math.floor(random() * 44);
    const reach = random() ** 0.8; // 0 at the pupil, 1 at the outer ring
    iris(EYE.pupil + 0.012 + reach * (band - 0.022), (fibre / 44) * Math.PI * 2 + jitter(0.022), 0.3 + 0.45 * reach);
  }
  for (let n = 0; n < 110; n++) iris(EYE.pupil + 0.3 * band + jitter(0.006), random() * Math.PI * 2, 0.7);
  for (let n = 0; n < 120; n++) iris(EYE.pupil + jitter(0.004), random() * Math.PI * 2, 0.85);

  // The catchlight: a small reflection up and to one side, the same side in
  // both eyes, which is what makes an eye look wet and alive.
  for (let n = 0; n < 26; n++) {
    const spread = 0.017 * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    feature.push({
      x: eye.x - 0.055 + spread * Math.cos(angle),
      y: eye.y + 0.05 + spread * Math.sin(angle),
      z: eye.z + 0.01,
      nx: 0,
      ny: 0,
      nz: 1,
      ...eyeInfo(1),
      kind: KIND.catchlight,
    });
  }
}
// The line between the lips, following the groove the scan has there.
for (let n = 0; n < 460; n++) {
  const x = (random() * 2 - 1) * mouthHalfWidth;
  const point = surfacePoint(x, seamAt(x) + jitter(0.012), 0.005);
  if (point) {
    const info = describe({ ...point, curvature: 1 });
    feature.push({ ...point, jaw: info.jaw * 0.5, edge: 0, order: 0.5 + 0.2 * random(), bright: 0.7, kind: KIND.line });
  }
}

// The outer edges of the lips: an arch with a dip in the middle above, a
// fuller curve below, both meeting the line between the lips at the corners.
for (let n = 0; n < 380; n++) {
  const along = random() * 2 - 1;
  const x = along * mouthHalfWidth * 0.96;
  const taper = Math.cos((along * Math.PI) / 2);
  const upper = random() < 0.5;
  const reach = upper
    ? (marks.upperLip.y - marks.seam.y) * (0.95 * taper ** 0.7 - 0.16 * Math.exp(-((along / 0.16) ** 2)))
    : (marks.underLip.y - marks.seam.y) * 0.78 * taper ** 0.6;
  const point = surfacePoint(x, seamAt(x) + reach + jitter(0.014), 0.004);
  if (point) {
    const info = describe({ ...point, curvature: 1 });
    feature.push({ ...point, jaw: info.jaw, edge: 0, order: 0.52 + 0.22 * random(), bright: 0.35, kind: KIND.line });
  }
}

// The surface takes the rest: each triangle gets points in proportion to its
// area and to how much the place matters.
const surfaceCount = COUNT - feature.length;
const weights = new Float64Array(triangleCount);
let totalWeight = 0;
for (let triangle = 0; triangle < triangleCount; triangle++) {
  // Judged at the triangle's centre; a handful of tries averages out the randomness.
  let density = 0;
  for (let tries = 0; tries < 3; tries++) {
    density += describe(pointOn(triangle)).density;
  }
  totalWeight += triangleArea(triangle) * (density / 3);
  weights[triangle] = totalWeight;
}
for (let n = 0; n < surfaceCount; n++) {
  const pick = random() * totalWeight;
  let low = 0;
  let high = triangleCount - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (weights[middle] < pick) low = middle + 1;
    else high = middle;
  }
  const point = pointOn(low);
  // Inside the open eye there is the iris, not the lid of the scan.
  const inEye = eyes.some((eye) => Math.abs(point.y - eye.y) < lidAt(point.x - eye.x) * 0.9 && point.nz > 0);
  // Nothing of the closed lid of the scan shows through the open eye.
  if (inEye) {
    n -= 1;
    continue;
  }
  push(point, describe(point));
}
cloud.push(...feature);

for (let index = cloud.length - 1; index > 0; index--) {
  const other = Math.floor(random() * (index + 1));
  [cloud[index], cloud[other]] = [cloud[other], cloud[index]];
}

// ---- Output ----

/** The middle of the face becomes the origin of the scene. */
const CENTER = { x: 0, y: marks.nose.y + 0.1, z: 0 };
const toScene = (x, y, z) => [(x - CENTER.x) * SCALE, (y - CENTER.y) * SCALE, (z - CENTER.z) * SCALE];

const STRIDE = 14;
const out = Buffer.alloc(cloud.length * STRIDE);
cloud.forEach((point, index) => {
  const at = index * STRIDE;
  toScene(point.x, point.y, point.z).forEach((value, axis) => {
    out.writeInt16LE(Math.round(clamp01((value / RANGE + 1) / 2) * 65535 - 32768), at + axis * 2);
  });
  [point.nx, point.ny, point.nz].forEach((value, axis) => {
    out.writeInt8(Math.round(Math.max(-1, Math.min(1, value)) * 127), at + 6 + axis);
  });
  out.writeInt8(Math.round(Math.max(-1, Math.min(1, point.jaw)) * 127), at + 9);
  out.writeUInt8(Math.round(clamp01(point.order) * 255), at + 10);
  out.writeUInt8(Math.round(clamp01(point.edge) * 255), at + 11);
  out.writeUInt8(Math.round(clamp01(point.bright) * 255), at + 12);
  out.writeUInt8(point.kind, at + 13);
});
writeFileSync(OUT_BIN, out);

const meta = {
  count: cloud.length,
  stride: STRIDE,
  range: RANGE,
  eyes: eyes.map((eye) => toScene(eye.x, eye.y, eye.z).map((value) => +value.toFixed(4))),
  /** Half the width and half the height of the opening of each eye. */
  lids: [+(EYE.halfWidth * SCALE).toFixed(4), +(EYE.halfHeight * SCALE).toFixed(4)],
  irisRadius: +(EYE.iris * SCALE).toFixed(4),
  pupilRadius: +(EYE.pupil * SCALE).toFixed(4),
  mouth: toScene(0, marks.seam.y, marks.seam.z).map((value) => +value.toFixed(4)),
  attribution:
    'Head: "Infinite, 3D Head Scan" by Lee Perry-Smith (www.triplegangers.com), CC BY 3.0.',
};
writeFileSync(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

const round = (value) => +value.toFixed(2);
console.log('landmarks (model units):');
for (const [name, mark] of Object.entries(marks)) {
  console.log(`  ${name.padEnd(10)}`, Object.fromEntries(Object.entries(mark).map(([key, value]) => [key, round(value)])));
}
console.log(`points: ${cloud.length} (${feature.length} drawn features), ${(out.length / 1024).toFixed(0)} KB`);

// ---- Preview: the cloud from the front, lit, as a picture ----

if (process.argv.includes('--preview')) {
  const size = 760;
  const pixels = new Float32Array(size * size * 3);
  const light = [0.45, 0.4, 0.8];
  for (const point of cloud) {
    const [x, y] = toScene(point.x, point.y, point.z);
    const px = Math.round(size / 2 + x * (size / 4.2));
    const py = Math.round(size * 0.42 - y * (size / 4.2));
    if (px < 1 || py < 1 || px >= size - 1 || py >= size - 1) continue;
    const diffuse = Math.max(0, point.nx * light[0] + point.ny * light[1] + point.nz * light[2]);
    let shade = (0.16 + 0.84 * diffuse ** 1.2) * (0.2 + 0.8 * smoothstep(-0.45, 0.25, point.nz)) + 0.5 * point.bright;
    if (point.kind >= KIND.iris) shade = 0.4 + 0.8 * point.bright;
    const color = point.kind === KIND.accent ? [1, 0.45, 0.2] : point.kind === KIND.iris ? [0.7, 1, 1] : [0.35, 0.72, 1];
    color.forEach((channel, c) => {
      pixels[(py * size + px) * 3 + c] += channel * shade * 0.6;
    });
  }
  const row = (size * 3 + 3) & ~3;
  const bmp = Buffer.alloc(54 + row * size);
  bmp.write('BM');
  bmp.writeUInt32LE(bmp.length, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(size, 18);
  bmp.writeInt32LE(-size, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(row * size, 34);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (let c = 0; c < 3; c++) {
        bmp[54 + y * row + x * 3 + (2 - c)] = Math.min(255, 8 + pixels[(y * size + x) * 3 + c] * 255);
      }
    }
  }
  writeFileSync(OUT_PREVIEW, bmp);
  console.log(`preview: ${fileURLToPath(OUT_PREVIEW)}`);
}
