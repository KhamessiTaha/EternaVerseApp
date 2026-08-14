// src/components/game/content/deathScenes.js
//
// Six deaths, six different things to look at.
//
// The previous version transformed ONE field of galaxy discs six ways, so
// every ending was a variation on the same image. Each death now seeds its own
// field and steps it its own way - they don't share a starting picture, so
// they can't converge on the same one.
//
// Each is also anchored to what the real process does, because the accuracy is
// what makes them feel like different EVENTS rather than different filters:
//
//   unravel   the lattice of space losing coherence (EternaVerse's own
//             stability failure - the one death here that isn't cosmology)
//   cool      expansion + redshift; stars slide down the spectrum to infrared
//             and vanish, and the last things burning are black holes
//             evaporating
//   snuff     stars burn out IN MASS ORDER - blue giants in millions of years,
//             red dwarfs still going after trillions
//   rip       phantom dark energy unbinds structure in order: clusters, then
//             galaxies, then the things galaxies are made of
//   crunch    collapse blueshifts and HEATS - it ends bright, not dark
//   diffuse   maximum entropy: no gradients left, everything identical
//
// Deliberate symmetry: `unravel` starts as order and ends as chaos; `diffuse`
// starts as chaos and ends as a dead, perfectly even order. And `cool` vs
// `diffuse` are close physics, so they are pushed apart hard on look - one is
// darkness and distance, the other is uniformity and sameness.
//
// Interface per death:
//   count      how many points the field wants
//   pointSize  base size for the material
//   seed()     -> field data (any shape the death likes)
//   step(p, f, pos, col)  writes the whole field at progress p (0..1)
//
// `step` owns its own loop so a death can do phase logic once per frame rather
// than once per point, and every step is a pure function of p - never an
// accumulation - so frame rate can't change the choreography.

const TAU = Math.PI * 2;

/** Deterministic-ish hash noise in [0,1) - cheap, no allocation. */
const frac = (n) => n - Math.floor(n);
const hash = (n) => frac(Math.sin(n * 12.9898) * 43758.5453);

/**
 * Blackbody-ish colour ramp. t=1 is hot blue-white, t=0 is dead red.
 * Used by every death that talks about temperature, which is most of them.
 */
function blackbody(t, out) {
  const k = Math.max(0, Math.min(1, t));
  if (k > 0.75) {          // blue-white
    const u = (k - 0.75) / 0.25;
    out[0] = 0.78 + 0.22 * (1 - u);
    out[1] = 0.86 + 0.14 * (1 - u);
    out[2] = 1.0;
  } else if (k > 0.45) {   // white -> yellow
    const u = (k - 0.45) / 0.3;
    out[0] = 1.0;
    out[1] = 0.82 + 0.16 * u;
    out[2] = 0.62 + 0.34 * u;
  } else if (k > 0.2) {    // orange
    const u = (k - 0.2) / 0.25;
    out[0] = 1.0;
    out[1] = 0.42 + 0.4 * u;
    out[2] = 0.16 + 0.46 * u;
  } else {                 // deep red -> out
    const u = k / 0.2;
    out[0] = 0.55 + 0.45 * u;
    out[1] = 0.08 + 0.34 * u;
    out[2] = 0.05 + 0.11 * u;
  }
  return out;
}

const tmp = [0, 0, 0];

// ---------------------------------------------------------------------------
// 1. UNRAVEL - the lattice of space losing coherence
// ---------------------------------------------------------------------------
// Not stars. A regular 3D grid, so the player is looking at STRUCTURE itself,
// and then watching it fracture along planes and lose its right angles. This
// is the only death that starts out obviously artificial, which is the point:
// it's the one that's about the framework rather than the contents.
const unravel = {
  count: 12167, // 23^3
  pointSize: 0.17,
  seed() {
    const N = 23;
    const span = 26;
    const n = N * N * N;
    const base = new Float32Array(n * 3);
    const shard = new Float32Array(n); // which fracture block each node is in
    let i = 0;
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          base[i * 3] = (x / (N - 1) - 0.5) * span;
          base[i * 3 + 1] = (y / (N - 1) - 0.5) * span;
          base[i * 3 + 2] = (z / (N - 1) - 0.5) * span;
          // 3x3x3 fracture blocks - the lattice comes apart in slabs
          shard[i] = Math.floor(x / 8) * 9 + Math.floor(y / 8) * 3 + Math.floor(z / 8);
          i++;
        }
      }
    }
    return { base, shard, n };
  },
  step(p, f, pos, col) {
    const { base, shard, n } = f;
    // Three beats: hold (tension), fracture (slabs separate), dissolve (nodes
    // lose their lattice positions entirely).
    const fracture = Math.max(0, (p - 0.22) / 0.78);
    const dissolve = Math.max(0, (p - 0.55) / 0.45);
    const buzz = Math.pow(p, 2) * 2.6;

    for (let i = 0; i < n; i++) {
      const s = shard[i];
      // Each slab drifts and tumbles a little differently
      const dx = (hash(s * 3.1) - 0.5) * 22 * fracture * fracture;
      const dy = (hash(s * 5.7) - 0.5) * 22 * fracture * fracture;
      const dz = (hash(s * 9.3) - 0.5) * 22 * fracture * fracture;

      const jx = (hash(i * 0.37 + p * 3) - 0.5) * buzz;
      const jy = (hash(i * 0.71 + p * 3) - 0.5) * buzz;
      const jz = (hash(i * 1.13 + p * 3) - 0.5) * buzz;

      // Dissolve throws nodes off the grid completely
      const off = dissolve * dissolve * 30;
      pos[i * 3] = base[i * 3] + dx + jx + (hash(i * 1.9) - 0.5) * off;
      pos[i * 3 + 1] = base[i * 3 + 1] + dy + jy + (hash(i * 2.3) - 0.5) * off;
      pos[i * 3 + 2] = base[i * 3 + 2] + dz + jz + (hash(i * 2.7) - 0.5) * off;

      // Cold structural cyan bleeding to grey, then out
      const life = Math.max(0, 1 - dissolve * 1.15);
      const grey = 0.55 * life;
      col[i * 3] = (0.42 * life) + grey * dissolve;
      col[i * 3 + 1] = (0.82 * life) + grey * dissolve * 0.9;
      col[i * 3 + 2] = (1.0 * life) + grey * dissolve * 0.8;
    }
  },
};

// ---------------------------------------------------------------------------
// 2. COOL - heat death: expansion, redshift, and Hawking evaporation last
// ---------------------------------------------------------------------------
// Sparse from the start, and it only gets emptier. Every star walks DOWN the
// blackbody ramp as it recedes - white, yellow, orange, deep red, infrared
// (gone). A handful of points are black holes: they outlast every star, then
// pop one by one as they evaporate. That last beat is the accurate one, and
// it's the one that makes this death land.
const cool = {
  count: 7000,
  pointSize: 0.16,
  seed() {
    const n = this.count;
    const base = new Float32Array(n * 3);
    const temp = new Float32Array(n);   // starting temperature
    const isHole = new Uint8Array(n);
    const popAt = new Float32Array(n);  // evaporation time for black holes
    for (let i = 0; i < n; i++) {
      const R = 4 + Math.pow(Math.random(), 0.6) * 20;
      const th = Math.random() * TAU;
      const ph = Math.acos(Math.random() * 2 - 1);
      base[i * 3] = R * Math.sin(ph) * Math.cos(th);
      base[i * 3 + 1] = R * Math.sin(ph) * Math.sin(th);
      base[i * 3 + 2] = R * Math.cos(ph);
      temp[i] = 0.35 + Math.random() * 0.65;
      isHole[i] = i % 260 === 0 ? 1 : 0;
      popAt[i] = 0.72 + Math.random() * 0.26;
    }
    return { base, temp, isHole, popAt, n };
  },
  step(p, f, pos, col) {
    const { base, temp, isHole, popAt, n } = f;
    const e = 1 + p * 2.6; // relentless expansion

    for (let i = 0; i < n; i++) {
      pos[i * 3] = base[i * 3] * e;
      pos[i * 3 + 1] = base[i * 3 + 1] * e;
      pos[i * 3 + 2] = base[i * 3 + 2] * e;

      if (isHole[i]) {
        // Black holes: nearly invisible, then a brief hard flash as they go
        const d = popAt[i];
        let v;
        if (p < d - 0.03) v = 0.1;
        else if (p < d) v = 0.1 + (p - (d - 0.03)) * 60;   // the pop
        else v = Math.max(0, 0.35 - (p - d) * 14);
        col[i * 3] = v; col[i * 3 + 1] = v * 0.97; col[i * 3 + 2] = v;
        continue;
      }

      // Redshift: temperature slides down, and the whole thing dims with it
      const t = temp[i] * Math.max(0, 1 - p * 1.22);
      blackbody(t, tmp);
      const dim = Math.max(0, 1 - p * 1.1);
      col[i * 3] = tmp[0] * dim;
      col[i * 3 + 1] = tmp[1] * dim;
      col[i * 3 + 2] = tmp[2] * dim;
    }
  },
};

// ---------------------------------------------------------------------------
// 3. SNUFF - stellar death, in mass order
// ---------------------------------------------------------------------------
// The accurate beat: massive blue stars burn out fast, red dwarfs last
// essentially forever. So the field visibly REDDENS as it empties - the blues
// go first, and what's left at the end is a thin scatter of dim red embers.
// Each death is a brief flare, because that's what a star does on the way out.
const snuff = {
  count: 11000,
  pointSize: 0.15,
  seed() {
    const n = this.count;
    const base = new Float32Array(n * 3);
    const mass = new Float32Array(n);
    // Galactic disc, so it reads as a place where stars live
    for (let i = 0; i < n; i++) {
      const r = Math.pow(Math.random(), 0.65) * 20;
      const a = Math.random() * TAU + r * 0.22; // slight spiral sweep
      base[i * 3] = Math.cos(a) * r;
      base[i * 3 + 1] = (Math.random() - 0.5) * (2.2 + r * 0.12);
      base[i * 3 + 2] = Math.sin(a) * r;
      // Heavily skewed to low mass: real IMFs have far more dwarfs than giants
      mass[i] = Math.pow(Math.random(), 2.6);
    }
    return { base, mass, n };
  },
  step(p, f, pos, col) {
    const { base, mass, n } = f;
    const e = 1 + p * 0.12;

    for (let i = 0; i < n; i++) {
      pos[i * 3] = base[i * 3] * e;
      pos[i * 3 + 1] = base[i * 3 + 1] * e;
      pos[i * 3 + 2] = base[i * 3 + 2] * e;

      const m = mass[i];
      // Heavy stars die early: lifetime falls off steeply with mass
      const dies = 0.06 + Math.pow(1 - m, 2.1) * 0.92;
      let v;
      if (p < dies - 0.035) v = 1;
      else if (p < dies) v = 1 + (p - (dies - 0.035)) * 42;  // the flare
      else v = Math.max(0, 1 - (p - dies) * 13);

      // A living star's colour is its mass; the survivors are all red dwarfs
      blackbody(0.16 + m * 0.84, tmp);
      col[i * 3] = tmp[0] * v;
      col[i * 3 + 1] = tmp[1] * v;
      col[i * 3 + 2] = tmp[2] * v;
    }
  },
};

// ---------------------------------------------------------------------------
// 4. RIP - phantom dark energy, unbinding structure in order
// ---------------------------------------------------------------------------
// The distinctive thing about a Big Rip isn't that things fly apart, it's the
// ORDER: superclusters come unbound first, then galaxies, then the stars
// inside them, and only at the very end the small stuff. So this runs in three
// visible stages instead of one uniform explosion.
const rip = {
  count: 12000,
  pointSize: 0.14,
  seed() {
    const n = this.count;
    const CLUMPS = 9;
    const base = new Float32Array(n * 3);      // offset within its galaxy
    const galaxy = new Float32Array(n * 3);    // galaxy centre, within cluster
    const cluster = new Float32Array(n * 3);   // cluster centre
    const jitter = new Float32Array(n * 3);

    const clusters = [];
    for (let c = 0; c < 3; c++) {
      const R = 9 + Math.random() * 6;
      const a = (c / 3) * TAU + Math.random() * 0.6;
      clusters.push([Math.cos(a) * R, (Math.random() - 0.5) * 7, Math.sin(a) * R]);
    }
    const galaxies = [];
    for (let g = 0; g < CLUMPS; g++) {
      const c = clusters[g % 3];
      galaxies.push({
        c,
        o: [(Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9],
      });
    }

    for (let i = 0; i < n; i++) {
      const g = galaxies[i % CLUMPS];
      const r = Math.pow(Math.random(), 0.7) * 2.6;
      const a = Math.random() * TAU;
      base[i * 3] = Math.cos(a) * r;
      base[i * 3 + 1] = (Math.random() - 0.5) * 0.7;
      base[i * 3 + 2] = Math.sin(a) * r;
      galaxy[i * 3] = g.o[0]; galaxy[i * 3 + 1] = g.o[1]; galaxy[i * 3 + 2] = g.o[2];
      cluster[i * 3] = g.c[0]; cluster[i * 3 + 1] = g.c[1]; cluster[i * 3 + 2] = g.c[2];
      jitter[i * 3] = (Math.random() - 0.5);
      jitter[i * 3 + 1] = (Math.random() - 0.5);
      jitter[i * 3 + 2] = (Math.random() - 0.5);
    }
    return { base, galaxy, cluster, jitter, n };
  },
  step(p, f, pos, col) {
    const { base, galaxy, cluster, jitter, n } = f;
    // Stage 1: clusters separate. Stage 2: galaxies unbind inside them.
    // Stage 3: everything left shreds.
    //
    // The exponents matter more than the scales. A Big Rip is a RUNAWAY - the
    // scale factor diverges at finite time - so the first stage has to be
    // almost imperceptible and the last has to be brutal. Flatter curves made
    // the whole thing read as one smooth uniform expansion, which is the one
    // thing this death must not look like.
    const s1 = 1 + Math.pow(Math.max(0, (p - 0.05) / 0.95), 2.8) * 7;
    const s2 = 1 + Math.pow(Math.max(0, (p - 0.34) / 0.66), 2.4) * 18;
    const s3 = 1 + Math.pow(Math.max(0, (p - 0.62) / 0.38), 3) * 70;
    const hot = Math.min(1, Math.pow(p, 1.5) * 1.8);

    for (let i = 0; i < n; i++) {
      const cx = cluster[i * 3] * s1;
      const cy = cluster[i * 3 + 1] * s1;
      const cz = cluster[i * 3 + 2] * s1;
      const gx = galaxy[i * 3] * s2;
      const gy = galaxy[i * 3 + 1] * s2;
      const gz = galaxy[i * 3 + 2] * s2;
      const bx = base[i * 3] * s3 + jitter[i * 3] * (s3 - 1) * 0.5;
      const by = base[i * 3 + 1] * s3 + jitter[i * 3 + 1] * (s3 - 1) * 0.5;
      const bz = base[i * 3 + 2] * s3 + jitter[i * 3 + 2] * (s3 - 1) * 0.5;

      pos[i * 3] = cx + gx + bx;
      pos[i * 3 + 1] = cy + gy + by;
      pos[i * 3 + 2] = cz + gz + bz;

      // Torn matter runs violet-hot as it goes
      col[i * 3] = 0.9 + 0.1 * hot;
      col[i * 3 + 1] = 0.75 * (1 - hot * 0.35) + 0.25 * hot;
      col[i * 3 + 2] = 0.85 + 0.15 * hot;
    }
  },
};

// ---------------------------------------------------------------------------
// 5. CRUNCH - collapse, blueshift, and heat
// ---------------------------------------------------------------------------
// The mirror of heat death, and the reason it must NOT end dark: infalling
// matter blueshifts and the whole thing heats as it compresses. It ends
// blinding white-blue. Galaxies merge on the way in rather than just shrinking.
const crunch = {
  count: 13000,
  pointSize: 0.15,
  seed() {
    const n = this.count;
    const CLUMPS = 11;
    const base = new Float32Array(n * 3);
    const centre = new Float32Array(n * 3);
    const spin = new Float32Array(n);
    const centres = [];
    for (let g = 0; g < CLUMPS; g++) {
      const R = 6 + Math.random() * 14;
      const th = Math.random() * TAU;
      const ph = Math.acos(Math.random() * 2 - 1);
      centres.push([
        R * Math.sin(ph) * Math.cos(th),
        R * Math.sin(ph) * Math.sin(th) * 0.7,
        R * Math.cos(ph),
      ]);
    }
    for (let i = 0; i < n; i++) {
      const c = centres[i % CLUMPS];
      const r = Math.pow(Math.random(), 0.6) * 2.8;
      const a = Math.random() * TAU;
      base[i * 3] = Math.cos(a) * r;
      base[i * 3 + 1] = (Math.random() - 0.5) * 1.1;
      base[i * 3 + 2] = Math.sin(a) * r;
      centre[i * 3] = c[0]; centre[i * 3 + 1] = c[1]; centre[i * 3 + 2] = c[2];
      spin[i] = 0.6 + Math.random() * 1.6;
    }
    return { base, centre, spin, n };
  },
  step(p, f, pos, col) {
    const { base, centre, spin, n } = f;
    // Infall accelerates; everything spirals as it converges (angular
    // momentum), so it reads as a collapse rather than a shrink.
    const fall = Math.pow(Math.max(0, 1 - p), 1.7);
    const swirl = Math.pow(p, 1.6) * 3.4;
    const heat = Math.pow(p, 1.35);

    for (let i = 0; i < n; i++) {
      const cx = centre[i * 3], cy = centre[i * 3 + 1], cz = centre[i * 3 + 2];
      const a = swirl * spin[i];
      const ca = Math.cos(a), sa = Math.sin(a);
      // spiral the galaxy centre inward about Y
      const rx = (cx * ca - cz * sa) * fall;
      const rz = (cx * sa + cz * ca) * fall;
      const ry = cy * fall;

      pos[i * 3] = rx + base[i * 3] * fall;
      pos[i * 3 + 1] = ry + base[i * 3 + 1] * fall;
      pos[i * 3 + 2] = rz + base[i * 3 + 2] * fall;

      // Blueshift + compression heating: ends hotter and brighter than it began
      blackbody(0.5 + heat * 0.5, tmp);
      const glow = 1 + heat * 2.4;
      col[i * 3] = tmp[0] * glow;
      col[i * 3 + 1] = tmp[1] * glow;
      col[i * 3 + 2] = tmp[2] * glow;
    }
  },
};

// ---------------------------------------------------------------------------
// 6. DIFFUSE - maximum entropy: the horror of sameness
// ---------------------------------------------------------------------------
// Pushed hard away from heat death, which is close physics but should be a
// completely different image. Heat death is darkness and distance; this is
// UNIFORMITY. It starts as a lively, varied, clumpy field and ends as a
// perfectly even grid of identical dim points - no gradients anywhere, which
// is exactly what maximum entropy means. The inverse of `unravel`.
const diffuse = {
  count: 10648, // 22^3
  pointSize: 0.15,
  seed() {
    const N = 22;
    const n = N * N * N;
    const start = new Float32Array(n * 3);
    const grid = new Float32Array(n * 3);
    const temp = new Float32Array(n);
    let i = 0;
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          // Destination: a perfectly regular lattice
          grid[i * 3] = (x / (N - 1) - 0.5) * 30;
          grid[i * 3 + 1] = (y / (N - 1) - 0.5) * 30;
          grid[i * 3 + 2] = (z / (N - 1) - 0.5) * 30;
          // Origin: clumpy and uneven, with real hot and cold spots
          const R = Math.pow(Math.random(), 0.5) * 19;
          const th = Math.random() * TAU;
          const ph = Math.acos(Math.random() * 2 - 1);
          start[i * 3] = R * Math.sin(ph) * Math.cos(th);
          start[i * 3 + 1] = R * Math.sin(ph) * Math.sin(th);
          start[i * 3 + 2] = R * Math.cos(ph);
          temp[i] = Math.random();
          i++;
        }
      }
    }
    return { start, grid, temp, n };
  },
  step(p, f, pos, col) {
    const { start, grid, temp, n } = f;
    // Ease-out: the gradients vanish quickly, and then nothing ever changes
    // again - which is the actual content of the idea.
    const k = 1 - Math.pow(1 - Math.min(1, p * 1.05), 3);
    const FLAT = 0.42;

    for (let i = 0; i < n; i++) {
      pos[i * 3] = start[i * 3] + (grid[i * 3] - start[i * 3]) * k;
      pos[i * 3 + 1] = start[i * 3 + 1] + (grid[i * 3 + 1] - start[i * 3 + 1]) * k;
      pos[i * 3 + 2] = start[i * 3 + 2] + (grid[i * 3 + 2] - start[i * 3 + 2]) * k;

      // Every temperature converges on the same one
      blackbody(temp[i], tmp);
      col[i * 3] = tmp[0] + (FLAT - tmp[0]) * k;
      col[i * 3 + 1] = tmp[1] + (FLAT * 0.95 - tmp[1]) * k;
      col[i * 3 + 2] = tmp[2] + (FLAT * 0.86 - tmp[2]) * k;
    }
  },
};

export const DEATHS = { unravel, cool, snuff, rip, crunch, diffuse };

export const deathFor = (motionKind) => DEATHS[motionKind] || cool;
