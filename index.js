// ════════════════════════════════════════════════════════════════
//  MORPHOGENESIS ENGINE  —  sketch.js  (Week 3 / Final)
//  Science Lens: Turing Reaction-Diffusion (Alan Turing, 1952)
//
//  Two morphogen proteins — BMP (Activator) and Noggin (Inhibitor) —
//  interact via inverse-square forces. Short-range self-excitation
//  by BMP combined with long-range suppression by Noggin spontaneously
//  breaks a uniform distribution into evenly-spaced spots or stripes.
//  This is the same mechanism behind leopard spots, zebrafish stripes,
//  and the spacing of fingers in a developing embryo.
//
//  Classes:
//    Morphogen   — one protein molecule (BMP or Noggin)
//    TissueZone  — environment zone; contains(body) + applyEffect(body)
//    VectorField — overlay showing local BMP attraction field
//    EnergyBar   — per-particle kinetic energy visualisation
// ════════════════════════════════════════════════════════════════

let W, H;
const N_EACH = 20; // 20 BMP + 20 Noggin = 40 bodies at start

// ── Simulation mode ───────────────────────────────────────────
// 'spot'   — BMP attracts at short range, repels at long range → discrete spots
// 'stripe' — BMP repels at all ranges → filament/stripe patterns
let simMode = 'spot';

// ── Overlay flags ─────────────────────────────────────────────
let showVectorField = false;
let showEnergyBars  = false;

// ── Physics: spot mode ────────────────────────────────────────
const SPOT = {
  SHORT_RANGE:     60,  // px — attraction below this, repulsion above
  ACT_ATTRACT:    200,  // short-range self-attraction strength
  ACT_LONG_REPEL: 120,  // long-range self-repulsion strength
};

// ── Physics: stripe mode ──────────────────────────────────────
// Removing short-range attraction makes BMP repel at ALL distances.
// Turing showed this regime produces stripes instead of spots.
const STRIPE = {
  SHORT_RANGE:    0,
  ACT_ATTRACT:    0,
  ACT_LONG_REPEL: 180,
};

// ── Shared physics ────────────────────────────────────────────
const INH_REPEL     = 380;  // Noggin ↔ Noggin repulsion → spread into gaps
const INH_CHASE     = 55;   // Noggin drifts weakly toward BMP signal
const AI_SOFT_REPEL = 8000; // Soft steric exclusion between BMP and Noggin
const AI_SOFT_ONSET = 50;   // px — exclusion becomes significant below this
const ACT_FLEE      = 160;  // BMP flees nearby Noggin
const FLEE_RANGE    = 70;   // px — flee range

// ── Lifecycle constants ───────────────────────────────────────
// Degradation: isolated BMP (no neighbour within ISOLATION_DIST for
// ISOLATION_FRAMES frames) is removed. Protein half-life in biology.
const ISOLATION_DIST   = 160;
const ISOLATION_FRAMES = 180; // ~3 s at 60 fps

// Merging: two BMP closer than MERGE_DIST coalesce — concentration saturation.
const MERGE_DIST = 10;

// ── Global state ──────────────────────────────────────────────
let bodies      = [];
let zones       = [];
let currentSeed = 42;

// Drag state
let isDragging = false;
let dragPrev   = null;

// Fading-out ghost particles (show where merges/degradations happened)
let ghosts = [];

// ════════════════════════════════════════════════════════════════
//  CLASS: Morphogen
//  One protein molecule — BMP Activator ('A') or Noggin Inhibitor ('I')
// ════════════════════════════════════════════════════════════════
class Morphogen {
  constructor(x, y, type) {
    this.pos      = createVector(x, y);
    this.vel      = p5.Vector.random2D().mult(random(0.3, 1.4));
    this.acc      = createVector(0, 0);
    this.type     = type;
    // BMP is heavier (larger protein complex) → less responsive to forces.
    // Noggin is lighter → diffuses faster → satisfies Turing's diffusion condition.
    this.mass     = (type === 'A') ? 2.8 : 1.2;
    this.maxSpeed = (type === 'A') ? 2.5 : 3.8;

    // Lifecycle (BMP only)
    this.isolationTimer = 0;
    this.alive          = true;

    // Visual fade-in on spawn
    this.age   = 0;
    this.alpha = 0; // ramps up from 0 over first 30 frames
  }

  addForce(fx, fy) {
    this.acc.x += fx / this.mass;
    this.acc.y += fy / this.mass;
  }

  // Kinetic energy — used by EnergyBar overlay
  kineticEnergy() {
    return 0.5 * this.mass * this.vel.magSq();
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.vel.mult(0.988); // viscous damping — cytoplasm resistance
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    // Toroidal wrap — canvas edges connect
    this.pos.x = ((this.pos.x % W) + W) % W;
    this.pos.y = ((this.pos.y % H) + H) % H;
    // Fade in
    this.age++;
    this.alpha = min(this.age / 30, 1);
  }

  display() {
    noStroke();
    const x = this.pos.x;
    const y = this.pos.y;
    const a = this.alpha; // 0→1 fade-in

    if (this.type === 'A') {
      // BMP — warm amber/gold glow
      fill(28,  90, 100,  7 * a);  ellipse(x, y, 56);
      fill(30,  88, 100, 18 * a);  ellipse(x, y, 34);
      fill(35,  82, 100, 55 * a);  ellipse(x, y, 16);
      fill(42,  65, 100, 90 * a);  ellipse(x, y,  7);
      fill(50,  30, 100, 100 * a); ellipse(x, y,  3);
    } else {
      // Noggin — cool cyan/teal glow
      fill(185, 85, 100,  5 * a);  ellipse(x, y, 48);
      fill(190, 88, 100, 14 * a);  ellipse(x, y, 28);
      fill(198, 82, 100, 50 * a);  ellipse(x, y, 13);
      fill(205, 70, 100, 85 * a);  ellipse(x, y,  6);
      fill(210, 40, 100, 100 * a); ellipse(x, y,  2);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  CLASS: Ghost
//  Short-lived visual flash where a merge or degradation happened.
//  Gives the user feedback that the cleanup mechanic fired.
// ════════════════════════════════════════════════════════════════
class Ghost {
  constructor(x, y, type) {
    this.pos   = createVector(x, y);
    this.type  = type;  // 'merge' | 'degrade'
    this.life  = 1.0;   // counts down to 0
  }

  update() {
    this.life -= 0.035;
  }

  display() {
    noStroke();
    if (this.type === 'merge') {
      // Bright gold flash — two BMP coalesced
      fill(45, 90, 100, this.life * 80);
      ellipse(this.pos.x, this.pos.y, 28 * this.life);
    } else {
      // Faint dissipating ring — BMP degraded
      noFill();
      stroke(28, 60, 100, this.life * 40);
      strokeWeight(1.5 * this.life);
      ellipse(this.pos.x, this.pos.y, 40 * (1 - this.life) + 8);
      noStroke();
    }
  }

  isDead() { return this.life <= 0; }
}

// ════════════════════════════════════════════════════════════════
//  CLASS: TissueZone
//  An elliptical region of tissue with altered physics.
//
//  'organiser' — limb-bud BMP organiser: pulls BMP inward, boosts clustering.
//                In real biology: the zone of polarising activity (ZPA) in a
//                limb bud produces BMP that initiates digit patterning.
//
//  'suppressor' — Noggin-rich region: damps all motion inside.
//                In real biology: high Noggin domains (e.g. dorsal ectoderm)
//                suppress BMP to keep tissue unpatterned.
//
//  Required interface: contains(body), applyEffect(body)
// ════════════════════════════════════════════════════════════════
class TissueZone {
  constructor(x, y, rw, rh, type) {
    this.x      = x;
    this.y      = y;
    this.rw     = rw;   // ellipse half-width
    this.rh     = rh;   // ellipse half-height
    this.type   = type;
    this.pulse  = random(TWO_PI); // phase offset for breathing animation
  }

  // Elliptical containment — standard equation (x/a)² + (y/b)² ≤ 1
  contains(body) {
    let dx = body.pos.x - this.x;
    let dy = body.pos.y - this.y;
    return (dx * dx) / (this.rw * this.rw) +
           (dy * dy) / (this.rh * this.rh) <= 1;
  }

  // Alter physics for bodies inside this zone
  applyEffect(body) {
    if (this.type === 'organiser') {
      // BMP inside the organiser gets a gentle inward pull
      // (mimics autocatalytic BMP amplification in the ZPA region)
      if (body.type === 'A') {
        let dx  = this.x - body.pos.x;
        let dy  = this.y - body.pos.y;
        let len = max(sqrt(dx * dx + dy * dy), 1);
        body.addForce((dx / len) * 0.9, (dy / len) * 0.9);
      }
    } else {
      // Suppressor zone: strong velocity damping for all bodies
      // (Noggin concentration is high → BMP diffusion impeded)
      body.vel.mult(0.91);
    }
  }

  display() {
    // Breathing pulse — zone visually "breathes" to show it's active
    let breathe = sin(frameCount * 0.03 + this.pulse) * 0.15 + 1.0;
    let rw = this.rw * breathe;
    let rh = this.rh * breathe;

    noFill();
    if (this.type === 'organiser') {
      // Amber glow ring
      stroke(35, 80, 100, 30);
      strokeWeight(1.5);
      ellipse(this.x, this.y, rw * 2, rh * 2);
      stroke(35, 80, 100, 10);
      strokeWeight(10);
      ellipse(this.x, this.y, rw * 2 + 14, rh * 2 + 14);
      // Label
      noStroke();
      fill(40, 70, 100, 55);
      textFont('Courier New');
      textSize(10);
      textAlign(CENTER);
      text('BMP ORGANISER', this.x, this.y - rh - 10);
      fill(40, 50, 100, 30);
      textSize(8);
      text('limb-bud signalling zone', this.x, this.y - rh - 1);
    } else {
      // Teal glow ring
      stroke(195, 75, 100, 22);
      strokeWeight(1.5);
      ellipse(this.x, this.y, rw * 2, rh * 2);
      stroke(195, 75, 100, 8);
      strokeWeight(10);
      ellipse(this.x, this.y, rw * 2 + 14, rh * 2 + 14);
      noStroke();
      fill(195, 65, 100, 50);
      textFont('Courier New');
      textSize(10);
      textAlign(CENTER);
      text('NOGGIN SUPPRESSOR', this.x, this.y - rh - 10);
      fill(195, 45, 100, 28);
      textSize(8);
      text('high-inhibitor environment', this.x, this.y - rh - 1);
    }
    noStroke();
  }
}

// ════════════════════════════════════════════════════════════════
//  CLASS: VectorField
//  Samples a grid of points and draws arrows showing the direction
//  and magnitude of BMP attraction at each point. Lets the user
//  see where BMP blobs are "pulling" — the invisible force landscape.
// ════════════════════════════════════════════════════════════════
class VectorField {
  constructor(grid) {
    this.grid = grid; // spacing in px between sample points
  }

  draw() {
    const SCALE = 180;
    for (let gx = this.grid / 2; gx < W; gx += this.grid) {
      for (let gy = this.grid / 2; gy < H; gy += this.grid) {
        let fx = 0, fy = 0;
        for (let b of bodies) {
          if (b.type !== 'A') continue;
          let dx = b.pos.x - gx;
          let dy = b.pos.y - gy;
          let d  = constrain(sqrt(dx * dx + dy * dy), 8, 300);
          fx += (dx / d) * (ACT_FLEE / (d * d));
          fy += (dy / d) * (ACT_FLEE / (d * d));
        }
        let mag = sqrt(fx * fx + fy * fy);
        if (mag < 0.001) continue;
        let nx  = fx / mag;
        let ny  = fy / mag;
        let len = constrain(mag * SCALE, 3, this.grid * 0.42);
        let alpha = constrain(mag * 3500, 6, 38);
        stroke(42, 50, 100, alpha);
        strokeWeight(0.8);
        let ex = gx + nx * len;
        let ey = gy + ny * len;
        line(gx, gy, ex, ey);
        // Arrowhead
        let ax = -ny * 2.5, ay = nx * 2.5;
        line(ex, ey, ex - nx * 4 + ax, ey - ny * 4 + ay);
        line(ex, ey, ex - nx * 4 - ax, ey - ny * 4 - ay);
      }
    }
    noStroke();
  }
}

// ════════════════════════════════════════════════════════════════
//  CLASS: EnergyBar
//  Draws a small kinetic-energy bar above each body.
//  High energy = fast-moving = bright bar. Lets user see which
//  bodies are being pushed hard by forces right now.
// ════════════════════════════════════════════════════════════════
class EnergyBar {
  constructor(maxEnergy) {
    this.maxEnergy = maxEnergy; // normalisation reference
  }

  draw(body) {
    const BAR_W = 20;
    const BAR_H = 3;
    let e   = constrain(body.kineticEnergy() / this.maxEnergy, 0, 1);
    let x   = body.pos.x - BAR_W / 2;
    let y   = body.pos.y - 18;

    // Track background
    noStroke();
    fill(0, 0, 20, 60);
    rect(x, y, BAR_W, BAR_H, 1);

    // Energy fill — green (calm) → yellow → red (high energy)
    let hue = lerp(120, 0, e); // 120 = green, 0 = red
    fill(hue, 90, 100, 80);
    rect(x, y, BAR_W * e, BAR_H, 1);
  }
}

// ════════════════════════════════════════════════════════════════
//  FORCE CALCULATION
// ════════════════════════════════════════════════════════════════
function applyForcesBetween(a, b) {
  // Toroidal shortest-path displacement
  let dx = b.pos.x - a.pos.x;
  let dy = b.pos.y - a.pos.y;
  if (dx >  W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  if (dy >  H / 2) dy -= H;
  if (dy < -H / 2) dy += H;

  let dist = constrain(sqrt(dx * dx + dy * dy), 6, 300);
  let nx = dx / dist;
  let ny = dy / dist;

  const P = (simMode === 'spot') ? SPOT : STRIPE;

  // ── BMP ↔ BMP ────────────────────────────────────────────────
  if (a.type === 'A' && b.type === 'A') {
    let mag;
    if (simMode === 'spot') {
      // Short range: attract → cluster. Long range: repel → space apart.
      mag = (dist < P.SHORT_RANGE)
        ?  P.ACT_ATTRACT    / (dist * dist)
        : -P.ACT_LONG_REPEL / (dist * dist);
    } else {
      // Stripe: repel at ALL distances → filaments
      mag = -P.ACT_LONG_REPEL / (dist * dist);
    }
    a.addForce( mag * nx,  mag * ny);
    b.addForce(-mag * nx, -mag * ny);

  // ── Noggin ↔ Noggin ──────────────────────────────────────────
  } else if (a.type === 'I' && b.type === 'I') {
    // Always repulsive — Noggin spreads out to cover interstitial space
    let mag = -INH_REPEL / (dist * dist);
    a.addForce( mag * nx,  mag * ny);
    b.addForce(-mag * nx, -mag * ny);

  // ── BMP ↔ Noggin  (THE TURING INSTABILITY) ───────────────────
  } else {
    let actNode = (a.type === 'A') ? a : b;
    let inhNode = (a.type === 'I') ? a : b;
    let toActX  = (a.type === 'A') ? -nx : nx;
    let toActY  = (a.type === 'A') ? -ny : ny;

    // Soft inverse-cube exclusion: prevents overlap without hard-wall vibration.
    // 1/r³ rises steeply at short range but has no sharp cutoff.
    if (dist < AI_SOFT_ONSET) {
      let sr = AI_SOFT_REPEL / (dist * dist * dist);
      inhNode.addForce(-toActX * sr, -toActY * sr);
      actNode.addForce( toActX * sr * 0.25, toActY * sr * 0.25);
    }

    // Noggin drifts slowly toward BMP (long-range chase)
    let chase = INH_CHASE / (dist * dist);
    inhNode.addForce(toActX * chase, toActY * chase);

    // BMP flees nearby Noggin (short-range)
    if (dist < FLEE_RANGE) {
      let flee = ACT_FLEE / (dist * dist);
      actNode.addForce(-toActX * flee, -toActY * flee);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  CLEANUP: MERGING + DEGRADATION
// ════════════════════════════════════════════════════════════════
function runCleanup() {
  const activators = bodies.filter(b => b.type === 'A' && b.alive);

  // ── Merging ───────────────────────────────────────────────────
  for (let i = 0; i < activators.length; i++) {
    if (!activators[i].alive) continue;
    for (let j = i + 1; j < activators.length; j++) {
      if (!activators[j].alive) continue;
      let dx = activators[j].pos.x - activators[i].pos.x;
      let dy = activators[j].pos.y - activators[i].pos.y;
      if (dx >  W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      if (dy >  H / 2) dy -= H;
      if (dy < -H / 2) dy += H;
      if (sqrt(dx * dx + dy * dy) < MERGE_DIST) {
        // Conserve momentum: average position + velocity
        let mx = (activators[i].pos.x + activators[j].pos.x) / 2;
        let my = (activators[i].pos.y + activators[j].pos.y) / 2;
        activators[i].pos.set(mx, my);
        activators[i].vel.x = (activators[i].vel.x + activators[j].vel.x) / 2;
        activators[i].vel.y = (activators[i].vel.y + activators[j].vel.y) / 2;
        activators[j].alive = false;
        // Leave a merge ghost
        ghosts.push(new Ghost(mx, my, 'merge'));
      }
    }
  }

  // ── Degradation ───────────────────────────────────────────────
  for (let a of activators) {
    if (!a.alive) continue;
    let hasNeighbour = false;
    for (let other of activators) {
      if (other === a || !other.alive) continue;
      let dx = other.pos.x - a.pos.x;
      let dy = other.pos.y - a.pos.y;
      if (dx >  W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      if (dy >  H / 2) dy -= H;
      if (dy < -H / 2) dy += H;
      if (sqrt(dx * dx + dy * dy) < ISOLATION_DIST) { hasNeighbour = true; break; }
    }
    if (hasNeighbour) {
      a.isolationTimer = 0;
    } else {
      a.isolationTimer++;
      if (a.isolationTimer > ISOLATION_FRAMES) {
        a.alive = false;
        ghosts.push(new Ghost(a.pos.x, a.pos.y, 'degrade'));
      }
    }
  }

  bodies = bodies.filter(b => b.alive);
}

// ════════════════════════════════════════════════════════════════
//  DRAG — push bodies near the cursor
// ════════════════════════════════════════════════════════════════
function applyDragForce() {
  if (!isDragging || !dragPrev) return;
  const DRAG_RADIUS   = 80;
  const DRAG_STRENGTH = 0.35;
  let vx = mouseX - dragPrev.x;
  let vy = mouseY - dragPrev.y;
  for (let b of bodies) {
    let dx = b.pos.x - mouseX;
    let dy = b.pos.y - mouseY;
    let d  = sqrt(dx * dx + dy * dy);
    if (d < DRAG_RADIUS) {
      let t = 1 - d / DRAG_RADIUS;
      b.vel.x += vx * t * DRAG_STRENGTH;
      b.vel.y += vy * t * DRAG_STRENGTH;
    }
  }
  dragPrev = { x: mouseX, y: mouseY };
}

// ════════════════════════════════════════════════════════════════
//  p5.js LIFECYCLE
// ════════════════════════════════════════════════════════════════
let vectorField;
let energyBar;

function setup() {
  W = windowWidth;
  H = windowHeight;
  let cnv = createCanvas(W, H);
  cnv.parent('canvas-container');
  colorMode(HSB, 360, 100, 100, 100);
  cnv.elt.addEventListener('contextmenu', e => e.preventDefault());

  vectorField = new VectorField(42);
  energyBar   = new EnergyBar(8); // normalise to KE ≈ 8 (typical max)

  spawnAll(currentSeed);
}

function windowResized() {
  W = windowWidth;
  H = windowHeight;
  resizeCanvas(W, H);
}

function draw() {
  // Soft background fade → trail effect
  fill(260, 70, 4, 14);
  noStroke();
  rect(0, 0, W, H);

  // Zones: draw then apply effects
  for (let z of zones) z.display();
  for (let z of zones)
    for (let b of bodies)
      if (z.contains(b)) z.applyEffect(b);

  // Optional overlays
  if (showVectorField) vectorField.draw();

  // N-body forces
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++)
      applyForcesBetween(bodies[i], bodies[j]);

  applyDragForce();

  // Update + draw bodies
  for (let b of bodies) {
    b.update();
    b.display();
    if (showEnergyBars) energyBar.draw(b);
  }

  // Ghosts (merge/degrade feedback)
  for (let g of ghosts) { g.update(); g.display(); }
  ghosts = ghosts.filter(g => !g.isDead());

  // Cleanup every 6 frames
  if (frameCount % 6 === 0) runCleanup();

  updateHUD();
}

// ════════════════════════════════════════════════════════════════
//  HUD UPDATE
// ════════════════════════════════════════════════════════════════
function updateHUD() {
  const nA    = bodies.filter(b => b.type === 'A').length;
  const nI    = bodies.filter(b => b.type === 'I').length;
  const total = nA + nI || 1;

  document.getElementById('hud-counts').textContent =
    `BMP: ${nA}   NOGGIN: ${nI}   seed: ${currentSeed}`;

  // Mode label — colour changes with mode
  const modeEl = document.getElementById('hud-mode');
  let modeText = `MODE: ${simMode.toUpperCase()}`;
  if (showVectorField) modeText += '  ·  VECTORS';
  if (showEnergyBars)  modeText += '  ·  ENERGY';
  modeEl.textContent = modeText;
  modeEl.style.color = simMode === 'spot' ? '#66bb88' : '#8899ee';

  // Population bar
  document.getElementById('pop-bar-bmp').style.width = `${(nA / total) * 100}%`;
  document.getElementById('pop-bar-nog').style.width = `${(nI / total) * 100}%`;

  // Science bar annotation
  const scienceLines = {
    spot:   'BMP self-excites locally · Noggin suppresses at long range · tension → evenly-spaced spots',
    stripe: 'BMP now repels at all ranges · no short-range clustering · filaments emerge instead of spots',
  };
  document.getElementById('science-text').textContent = scienceLines[simMode];
}

// ════════════════════════════════════════════════════════════════
//  SPAWNING
// ════════════════════════════════════════════════════════════════
function spawnAll(seed) {
  bodies = [];
  ghosts = [];
  randomSeed(seed);
  noiseSeed(seed);

  // BMP: loose ring around centre — mimics early limb bud BMP localisation
  for (let i = 0; i < N_EACH; i++) {
    let angle  = random(TWO_PI);
    let radius = random(30, min(W, H) * 0.22);
    bodies.push(new Morphogen(
      W / 2 + cos(angle) * radius,
      H / 2 + sin(angle) * radius,
      'A'
    ));
  }

  // Noggin: scattered broadly — diffuses fast from the start
  for (let i = 0; i < N_EACH; i++) {
    bodies.push(new Morphogen(random(W), random(H), 'I'));
  }

  // Environment zones — fixed positions relative to window
  zones = [
    new TissueZone(W * 0.75, H * 0.25, 95, 68, 'organiser'),
    new TissueZone(W * 0.25, H * 0.75, 85, 58, 'suppressor'),
  ];
}

// ════════════════════════════════════════════════════════════════
//  INPUT
// ════════════════════════════════════════════════════════════════
function mousePressed() {
  isDragging = true;
  dragPrev   = { x: mouseX, y: mouseY };

  if (mouseButton === LEFT) {
    for (let i = 0; i < 4; i++)
      bodies.push(new Morphogen(mouseX + random(-18, 18), mouseY + random(-18, 18), 'A'));
  } else if (mouseButton === RIGHT) {
    for (let i = 0; i < 4; i++)
      bodies.push(new Morphogen(mouseX + random(-22, 22), mouseY + random(-22, 22), 'I'));
  }
}

function mouseDragged() { isDragging = true; }
function mouseReleased() { isDragging = false; dragPrev = null; }

function keyPressed() {
  if (key === 'R' || key === 'r') { spawnAll(currentSeed); simMode = 'spot'; }
  if (key === 'N' || key === 'n') { currentSeed = floor(random(999999)); spawnAll(currentSeed); simMode = 'spot'; }
  if (key === 'T' || key === 't') simMode = (simMode === 'spot') ? 'stripe' : 'spot';
  if (key === 'V' || key === 'v') showVectorField = !showVectorField;
  if (key === 'E' || key === 'e') showEnergyBars  = !showEnergyBars;
}
