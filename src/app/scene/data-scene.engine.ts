import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  FogExp2,
  GridHelper,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

/**
 * DataSceneEngine — the interactive 3D world behind the profile.
 *
 * One exhibit per chapter; the camera flies between them as the page scrolls
 * and holds still while a chapter is being read.
 *
 *   0 Hero      SOURCE     database core fed by orbiting source tables (ETL streams)
 *   1 Journey   INGEST     a pipeline track with one station per career milestone
 *   2 Stack     STORE      the database core opened up: one platter per data-stack layer
 *   3 Work      TRANSFORM  the selected project's pipeline, over a schema graph
 *   4 Resume    MODEL      a 3D scatter plot with live k-means re-clustering
 *   5 Contact   SERVE      a wide shot of the whole platform
 *
 * Interaction: drag to orbit (mouse), hover to highlight, click / tap to select.
 * Selections are reported through `onSelect` and applied through `setSelection`,
 * so the 3D exhibits and the HTML content always agree.
 *
 * Text is never rendered in WebGL: labels are real DOM elements positioned from
 * projected 3D anchors, so they stay crisp and use the site's fonts.
 */

// ───────────────────────── Public API ─────────────────────────

export interface SceneContent {
  readonly stations: readonly { readonly title: string; readonly sub: string }[];
  readonly layers: readonly string[];
  readonly projects: readonly { readonly steps: readonly string[] }[];
}

export interface SceneSelection {
  readonly station: number;
  readonly layer: number;
  readonly project: number;
  readonly step: number;
}

export interface SceneEvent {
  readonly kind: 'station' | 'layer' | 'step';
  readonly index: number;
}

export interface DataSceneOptions {
  /** DOM ids of the page sections, in chapter order. */
  readonly sectionIds: readonly string[];
  readonly reducedMotion: boolean;
  readonly content: SceneContent;
  readonly selection: SceneSelection;
  /** Absolutely-positioned container for the HTML labels. */
  readonly labelLayer: HTMLElement;
  readonly onSelect: (event: SceneEvent) => void;
}

// ───────────────────────── Layout constants ─────────────────────────

const COLORS = {
  bg: 0x0a0614,
  violet: 0x9b6bff,
  lilac: 0xd9c8ff,
  deep: 0x6d3fe0,
  magenta: 0xe879f9,
  sky: 0x93c5fd,
  plum: 0x1c1033,
  body: 0x231443,
} as const;

/** Chapter indices (match SECTIONS order). */
const Ch = { Hero: 0, Journey: 1, Stack: 2, Work: 3, Resume: 4, Contact: 5 } as const;

interface Shot {
  readonly focus: Vector3;
  readonly dist: number;
  /** Azimuth around the focus (radians, 0 = looking from +z). */
  readonly az: number;
  /** Elevation above the horizon (radians). */
  readonly el: number;
}

const JOURNEY_AT = new Vector3(-16, 0, -4);
const WORK_AT = new Vector3(16, 0.2, -4);
const SCATTER_AT = new Vector3(0, 1.4, -18);
const FLOOR_Y = -3.3;
const LAYER_PITCH = 0.4;
const SOURCE_COUNT = 8;
const SOURCE_RADIUS = 4.8;

/** Camera shot per chapter. */
const SHOTS: readonly Shot[] = [
  { focus: new Vector3(0, 0.2, 0), dist: 12, az: 0.5, el: 0.2 },
  { focus: JOURNEY_AT.clone().add(new Vector3(0, 0.3, 0)), dist: 11.5, az: -0.18, el: 0.24 },
  { focus: new Vector3(0, 0, 0), dist: 8, az: 0.8, el: 0.3 },
  { focus: WORK_AT.clone().add(new Vector3(0, 0.3, 0)), dist: 11, az: 0.22, el: 0.26 },
  { focus: SCATTER_AT.clone(), dist: 9.5, az: -0.45, el: 0.22 },
  { focus: new Vector3(0, 0, -6), dist: 25, az: 0.2, el: 0.34 },
];

/** At or above this width the page uses a split layout: text left, exhibit right. */
const SPLIT_MIN_WIDTH = 1100;
/** Horizontal shift of the exhibit (fraction of viewport width) in split layout. */
const SPLIT_SHIFT = 0.2;

type HitKind = 'station' | 'layer' | 'step' | 'scatter';

interface Hit {
  readonly kind: HitKind;
  readonly index: number;
}

interface Label {
  readonly el: HTMLButtonElement;
  readonly title: HTMLSpanElement;
  readonly sub: HTMLSpanElement;
  shown: boolean;
}

interface WorkNode {
  readonly group: Group;
  readonly mat: MeshStandardMaterial;
  readonly hit: Mesh;
}

// ───────────────────────── Engine ─────────────────────────

export class DataSceneEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 140);
  private readonly raycaster = new Raycaster();
  private readonly reduced: boolean;
  private selection: SceneSelection;

  // Layout
  private width = 1;
  private height = 1;
  private split = true;

  // Shared resources
  private readonly dot: Texture;

  // ── Database core (hero + data stack) ──
  private readonly db = new Group();
  private readonly platters: Mesh[] = [];
  private readonly platterMats: MeshStandardMaterial[] = [];
  private readonly rimMats: MeshBasicMaterial[] = [];
  private readonly layerGlow: number[] = [];
  private readonly halo = new Group();

  // ── Sources + ETL streams (hero) ──
  private readonly sourceRing = new Group();
  private readonly sources: Mesh[] = [];
  private readonly streamLines: LineSegments[] = [];
  private streamLineMat!: LineBasicMaterial;
  private streamPoints!: Points;
  private streamSeeds!: Float32Array;
  private readonly streamStarts = Array.from({ length: SOURCE_COUNT }, () => new Vector3());
  private readonly streamCtrl = Array.from({ length: SOURCE_COUNT }, () => new Vector3());
  private readonly dbTop = new Vector3(0, 1.45, 0);

  // ── Journey track ──
  private readonly journey = new Group();
  private journeyCurve!: CatmullRomCurve3;
  private journeyPackets!: Points;
  private readonly stationGroups: Group[] = [];
  private readonly stationMats: MeshStandardMaterial[] = [];
  private readonly stationRings: Mesh[] = [];
  private readonly stationHits: Mesh[] = [];
  private readonly stationGlow: number[] = [];
  private nowRing?: Mesh;

  // ── Work pipeline ──
  private readonly work = new Group();
  private readonly workNodes: WorkNode[] = [];
  private readonly workGlow: number[] = [];
  private workCurve?: CatmullRomCurve3;
  private workTube?: Mesh;
  private workPackets?: Points;
  private workPop = 1;
  private readonly graph = new Group();
  private graphPulse!: Points;
  private readonly graphEdges: [Vector3, Vector3][] = [];

  // ── Scatter plot ──
  private readonly scatter = new Group();
  private scatterPoints!: Points;
  private scatterFrom!: Float32Array;
  private scatterTo!: Float32Array;
  private scatterCluster!: Uint8Array;
  private scatterT = 1;
  private scatterHit!: Mesh;
  private readonly centroids: Mesh[] = [];
  private readonly centroidFrom: Vector3[] = [];
  private readonly centroidTo: Vector3[] = [];

  // ── Floor ──
  private bars!: InstancedMesh;
  private readonly barCells: { x: number; z: number; falloff: number }[] = [];
  private dust!: Points;

  // ── Labels ──
  private readonly stationLabels: Label[] = [];
  private readonly layerLabels: Label[] = [];
  private readonly stepLabels: Label[] = [];
  private scatterLabel!: Label;

  // ── Camera / input state ──
  private u = 0; // eased chapter position
  private targetU = 0; // chapter position from scroll
  private readonly weights = new Float32Array(SHOTS.length);
  private readonly pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false };
  private readonly ndc = new Vector2();
  private dragYaw = 0;
  private dragPitch = 0;
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private suppressClick = false;
  private hovered: Hit | null = null;

  // ── Loop ──
  private raf = 0;
  private running = false;
  private last = 0;
  private time = 0;
  private sectionEls: HTMLElement[] = [];

  // Scratch (no per-frame allocation)
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly v4 = new Vector3();
  private readonly projected = new Vector3();
  private readonly camRight = new Vector3();
  private readonly focus = new Vector3();
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly barLow = new Color(COLORS.plum);
  private readonly barMid = new Color(COLORS.deep);
  private readonly barHigh = new Color(COLORS.lilac);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: DataSceneOptions,
  ) {
    this.reduced = options.reducedMotion;
    this.selection = options.selection;
    const small = window.innerWidth < 768;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !small,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(COLORS.bg, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));

    // Dense enough that neighbouring exhibits recede and never compete with the text column.
    this.scene.fog = new FogExp2(COLORS.bg, 0.04);
    this.dot = this.makeDotTexture();

    this.buildLights();
    this.buildDatabase();
    this.buildSources();
    this.buildStreams(small);
    this.buildJourney();
    this.buildGraph();
    this.buildWork();
    this.buildScatter(small);
    this.buildFloor(small);
    this.buildLabels();

    this.sectionEls = options.sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    this.resize();
    this.readScroll();
    this.u = this.targetU;

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // ───────────────────────── Lifecycle ─────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Applies a selection coming from the HTML side. */
  setSelection(next: SceneSelection): void {
    const projectChanged = next.project !== this.selection.project;
    this.selection = next;
    if (projectChanged) this.rebuildWorkPipeline();
  }

  /** Re-runs the k-means animation on the scatter plot. */
  recluster(): void {
    const pos = this.scatterPoints.geometry.getAttribute('position') as BufferAttribute;
    this.scatterFrom.set(pos.array as Float32Array);
    const centres = this.centroids.map((_, i) => {
      const a = (i / this.centroids.length) * Math.PI * 2 + Math.random() * 1.2;
      return new Vector3(Math.cos(a) * 1.15, (Math.random() - 0.5) * 2, Math.sin(a) * 1.15);
    });
    for (let i = 0; i < this.scatterCluster.length; i++) {
      const c = centres[this.scatterCluster[i]!]!;
      this.scatterTo[i * 3] = c.x + this.gauss() * 0.4;
      this.scatterTo[i * 3 + 1] = c.y + this.gauss() * 0.4;
      this.scatterTo[i * 3 + 2] = c.z + this.gauss() * 0.4;
    }
    this.centroids.forEach((m, i) => {
      this.centroidFrom[i]!.copy(m.position);
      this.centroidTo[i]!.copy(centres[i]!);
    });
    this.scatterT = 0;
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.options.labelLayer.replaceChildren();

    const materials = new Set<Material>();
    this.scene.traverse((obj) => {
      const o = obj as Partial<Mesh>;
      o.geometry?.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => materials.add(m));
    });
    materials.forEach((m) => m.dispose());
    this.dot.dispose();
    this.renderer.dispose();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    // rAF timestamps can precede the performance.now() taken in start(): never step backwards.
    const dt = MathUtils.clamp((now - this.last) / 1000, 0, 1 / 20);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  // ───────────────────────── Events ─────────────────────────

  private readonly onResize = (): void => {
    this.resize();
    this.readScroll();
  };

  private readonly onScroll = (): void => this.readScroll();

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (this.drag && e.pointerId === this.drag.id) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.dragYaw = MathUtils.clamp(this.dragYaw - dx * 0.006, -1.4, 1.4);
      this.dragPitch = MathUtils.clamp(this.dragPitch + dy * 0.004, -0.25, 0.7);
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.pointer.inside = true;
    this.setNdc(e.clientX, e.clientY);
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.suppressClick = this.drag.moved > 6;
    this.drag = null;
    this.canvas.style.cursor = '';
  };

  /** Hover only applies while the pointer is directly over the canvas (not over text). */
  private readonly onCanvasPointerMove = (e: PointerEvent): void => {
    this.pointer.inside = e.pointerType === 'mouse';
  };

  private readonly onPointerLeave = (): void => {
    this.pointer.inside = false;
  };

  private readonly onClick = (e: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.setNdc(e.clientX, e.clientY);
    const hit = this.pick();
    if (hit) this.select(hit);
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.stop();
    this.canvas.style.display = 'none';
    this.options.labelLayer.replaceChildren();
  };

  private setNdc(clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  private select(hit: Hit): void {
    if (hit.kind === 'scatter') {
      this.recluster();
      return;
    }
    this.options.onSelect({ kind: hit.kind, index: hit.index });
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.split = this.width >= SPLIT_MIN_WIDTH;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.camera.aspect < 1 ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Scroll → chapter position. Each chapter "holds" its shot for the middle half
   * of the section and blends to its neighbours only near the section edges.
   */
  private readScroll(): void {
    const mid = window.innerHeight * 0.5;
    let idx = 0;
    let local = 0.5;
    for (let i = 0; i < this.sectionEls.length; i++) {
      const r = this.sectionEls[i]!.getBoundingClientRect();
      if (r.top <= mid) {
        idx = i;
        local = MathUtils.clamp((mid - r.top) / Math.max(r.height, 1), 0, 1);
      }
    }
    const u = local < 0.25 ? idx - 0.5 + local * 2 : local > 0.75 ? idx + (local - 0.75) * 2 : idx;
    this.targetU = MathUtils.clamp(u, 0, SHOTS.length - 1);
  }

  // ───────────────────────── Frame update ─────────────────────────

  private update(dt: number): void {
    // Autonomous animation freezes under reduced motion; interaction stays live.
    if (!this.reduced) this.time += dt;
    const t = this.time;
    const ease = this.reduced ? 1 : 1 - Math.exp(-dt * 3);
    const fade = 1 - Math.exp(-dt * 8);

    this.u += (this.targetU - this.u) * ease;
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = MathUtils.clamp(1 - Math.abs(this.u - i) * 2, 0, 1);
    }

    if (!this.drag) {
      const back = Math.exp(-dt * 0.7);
      this.dragYaw *= back;
      this.dragPitch *= back;
    }
    const p = 1 - Math.exp(-dt * 2.5);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * p;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * p;

    this.updateCamera();
    this.updateHover();

    this.updateDatabase(t, fade);
    this.updateStreams(t);
    this.updateJourney(t, fade);
    this.updateWork(t, fade, dt);
    this.updateScatter(t, dt);
    this.updateBars(t);
    this.dust.rotation.y = t * 0.01;

    this.updateLabels();
  }

  private updateCamera(): void {
    const n = SHOTS.length - 1;
    const i = Math.min(Math.floor(this.u), n - 1);
    const f = MathUtils.smootherstep(this.u - i, 0, 1);
    const a = SHOTS[i]!;
    const b = SHOTS[i + 1]!;

    this.focus.lerpVectors(a.focus, b.focus, f);
    let dist = MathUtils.lerp(a.dist, b.dist, f);
    const az = MathUtils.lerp(a.az, b.az, f) + this.dragYaw + this.pointer.x * 0.06;
    const el = MathUtils.clamp(MathUtils.lerp(a.el, b.el, f) + this.dragPitch - this.pointer.y * 0.04, 0.04, 1.2);

    if (this.split) dist *= MathUtils.clamp(1.75 / this.camera.aspect, 1, 1.5);
    else dist *= 1.35;

    this.camera.position.set(
      this.focus.x + Math.sin(az) * Math.cos(el) * dist,
      this.focus.y + Math.sin(el) * dist,
      this.focus.z + Math.cos(az) * Math.cos(el) * dist,
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    this.camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();

    // Shift the exhibit into the right-hand half in split layout.
    const shift = this.split ? SPLIT_SHIFT : 0;
    this.camera.setViewOffset(this.width, this.height, -this.width * shift, 0, this.width, this.height);
  }

  /** Objects that can be hovered / clicked in the chapter currently in view. */
  private interactiveTargets(): Object3D[] {
    const ch = Math.round(this.u);
    if (this.weights[ch]! < 0.6) return [];
    switch (ch) {
      case Ch.Journey:
        return this.stationHits;
      case Ch.Stack:
        return this.platters;
      case Ch.Work:
        return this.workNodes.map((n) => n.hit);
      case Ch.Resume:
        return [this.scatterHit];
      default:
        return [];
    }
  }

  private pick(): Hit | null {
    const targets = this.interactiveTargets();
    if (!targets.length) return null;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return (hit?.object.userData['hit'] as Hit | undefined) ?? null;
  }

  private updateHover(): void {
    if (!this.pointer.inside || this.drag) {
      this.hovered = null;
      return;
    }
    this.ndc.set(this.pointer.tx, -this.pointer.ty);
    this.hovered = this.pick();
    this.canvas.style.cursor = this.hovered ? 'pointer' : '';
  }

  private isHovered(kind: HitKind, index: number): boolean {
    return this.hovered?.kind === kind && this.hovered.index === index;
  }

  // ── Database core ──

  private updateDatabase(t: number, fade: number): void {
    const wStack = this.weights[Ch.Stack]!;
    this.halo.rotation.z = t * 0.12;
    this.halo.rotation.y = Math.sin(t * 0.3) * 0.25;

    for (let i = 0; i < this.platters.length; i++) {
      const selected = i === this.selection.layer ? 1 : 0;
      const target = wStack * Math.max(selected, this.isHovered('layer', i) ? 0.55 : 0);
      const g = (this.layerGlow[i]! += (target - this.layerGlow[i]!) * fade);

      const platter = this.platters[i]!;
      // The selected platter slides out toward its label.
      this.v1.copy(this.camRight).multiplyScalar(0.45 * g * selected);
      platter.position.set(this.v1.x, -1.2 + i * LAYER_PITCH, this.v1.z);
      platter.scale.set(1 + 0.08 * g, 1, 1 + 0.08 * g);

      this.platterMats[i]!.emissiveIntensity = 0.16 + g * 0.95;
      // Outside the stack chapter the rims pulse in sequence like disk I/O.
      const io = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.2 - i * 0.8)) ** 3;
      this.rimMats[i]!.opacity = MathUtils.lerp(io, 0.3 + 0.7 * g, wStack);
    }
  }

  private updateStreams(t: number): void {
    this.sourceRing.rotation.y = -t * 0.08;
    this.sourceRing.updateMatrixWorld();
    // Source tables tuck away during the data-stack close-up so they never cross the text.
    const tuck = 1 - this.weights[Ch.Stack]!;
    this.sources.forEach((s, i) => {
      s.rotation.x = t * 0.4 + i;
      s.rotation.y = t * 0.3 + i * 0.5;
      s.scale.setScalar(Math.max(0.001, tuck));
    });

    // Streams are a hero / journey feature — they fade away in close-ups.
    const vis = Math.max(this.weights[Ch.Hero]!, this.weights[Ch.Journey]!, this.weights[Ch.Contact]!);
    const level = 0.25 + 0.75 * vis;
    this.streamLineMat.opacity = 0.3 * level;
    (this.streamPoints.material as PointsMaterial).opacity = level;

    for (let i = 0; i < SOURCE_COUNT; i++) {
      const start = this.sources[i]!.getWorldPosition(this.streamStarts[i]!);
      this.streamCtrl[i]!.copy(start).multiplyScalar(0.45).setY(start.y + 2.4);
    }

    // Path lines (segments) for every stream.
    const lineAttr = this.streamLines[0]!.geometry.getAttribute('position') as BufferAttribute;
    const segs = lineAttr.count / (2 * SOURCE_COUNT);
    let o = 0;
    for (let i = 0; i < SOURCE_COUNT; i++) {
      for (let j = 0; j < segs; j++) {
        this.bezier(i, j / segs, this.v1);
        this.bezier(i, (j + 1) / segs, this.v2);
        lineAttr.setXYZ(o++, this.v1.x, this.v1.y, this.v1.z);
        lineAttr.setXYZ(o++, this.v2.x, this.v2.y, this.v2.z);
      }
    }
    lineAttr.needsUpdate = true;

    const attr = this.streamPoints.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const u = (t * 0.22 + this.streamSeeds[i * 2 + 1]!) % 1;
      this.bezier(this.streamSeeds[i * 2]!, u, this.v1);
      attr.setXYZ(i, this.v1.x, this.v1.y, this.v1.z);
    }
    attr.needsUpdate = true;
  }

  // ── Journey ──

  private updateJourney(t: number, fade: number): void {
    const w = this.weights[Ch.Journey]!;
    this.stationGroups.forEach((g, i) => {
      const selected = i === this.selection.station ? 1 : 0;
      const target = Math.max(selected, this.isHovered('station', i) ? 0.6 : 0);
      const h = (this.stationGlow[i]! += (target - this.stationGlow[i]!) * fade);
      this.stationMats[i]!.emissiveIntensity = 0.25 + h * 1.1;
      const ring = this.stationRings[i]!;
      ring.scale.setScalar(1 + h * 0.45);
      ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.35;
      ring.rotation.y = t * (0.4 + h);
      g.position.y = this.stationBaseY[i]! + Math.sin(t * 1.2 + i) * 0.06;
    });
    if (this.nowRing) {
      const s = 1 + ((t * 0.6) % 1) * 1.4;
      this.nowRing.scale.setScalar(s);
      (this.nowRing.material as MeshBasicMaterial).opacity = (1 - ((t * 0.6) % 1)) * 0.6 * (0.3 + 0.7 * w);
    }

    const attr = this.journeyPackets.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const u = (t * 0.06 + i / attr.count) % 1;
      this.journeyCurve.getPointAt(u, this.v1);
      attr.setXYZ(i, this.v1.x, this.v1.y, this.v1.z);
    }
    attr.needsUpdate = true;
  }

  private readonly stationBaseY: number[] = [];

  // ── Work ──

  private updateWork(t: number, fade: number, dt: number): void {
    this.workPop = Math.min(1, this.workPop + dt * 1.6);
    const pop = MathUtils.smootherstep(this.workPop, 0, 1);

    this.workNodes.forEach((node, i) => {
      const selected = i === this.selection.step ? 1 : 0;
      const target = Math.max(selected, this.isHovered('step', i) ? 0.6 : 0);
      const h = (this.workGlow[i]! += (target - this.workGlow[i]!) * fade);
      node.mat.emissiveIntensity = 0.2 + h * 1.1;
      node.group.scale.setScalar((0.55 + 0.45 * pop) * (1 + h * 0.28));
      node.group.rotation.y = t * 0.35 + i + h * t * 0.8;
      node.group.rotation.x = Math.sin(t * 0.5 + i) * 0.2;
    });

    if (this.workPackets && this.workCurve) {
      const attr = this.workPackets.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        const u = (t * 0.1 + i / attr.count) % 1;
        this.workCurve.getPointAt(u, this.v1);
        attr.setXYZ(i, this.v1.x, this.v1.y, this.v1.z);
      }
      attr.needsUpdate = true;
    }

    this.graph.rotation.y = t * 0.08;
    const attr = this.graphPulse.geometry.getAttribute('position') as BufferAttribute;
    this.graphEdges.forEach(([a, b], i) => {
      this.v1.lerpVectors(a, b, (t * 0.35 + i * 0.137) % 1);
      attr.setXYZ(i, this.v1.x, this.v1.y, this.v1.z);
    });
    attr.needsUpdate = true;
  }

  // ── Scatter ──

  private updateScatter(t: number, dt: number): void {
    this.scatter.rotation.y = t * 0.12;
    if (this.scatterT < 1) {
      this.scatterT = Math.min(1, this.scatterT + dt / 1.4);
      const e = MathUtils.smootherstep(this.reduced ? 1 : this.scatterT, 0, 1);
      const attr = this.scatterPoints.geometry.getAttribute('position') as BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = MathUtils.lerp(this.scatterFrom[i]!, this.scatterTo[i]!, e);
      attr.needsUpdate = true;
      this.centroids.forEach((c, i) => c.position.lerpVectors(this.centroidFrom[i]!, this.centroidTo[i]!, e));
    }
    const hover = this.isHovered('scatter', 0) ? 1.25 : 1;
    this.centroids.forEach((c, i) => {
      c.rotation.y = t * 1.2 + i;
      c.scale.setScalar(hover * (1 + 0.22 * Math.sin(t * 2 + i * 2)));
    });
  }

  // ── Floor ──

  private updateBars(t: number): void {
    for (let i = 0; i < this.barCells.length; i++) {
      const cell = this.barCells[i]!;
      const wave =
        Math.sin(cell.x * 0.55 + t * 0.9) + Math.cos(cell.z * 0.45 - t * 0.7) + Math.sin((cell.x + cell.z) * 0.3 + t * 0.5);
      const v = MathUtils.clamp((wave + 3) / 6, 0, 1);
      this.dummy.position.set(cell.x, 0, cell.z);
      this.dummy.scale.set(1, 0.08 + v * 1.7 * cell.falloff, 1);
      this.dummy.updateMatrix();
      this.bars.setMatrixAt(i, this.dummy.matrix);
      if (v < 0.5) this.color.lerpColors(this.barLow, this.barMid, v * 2);
      else this.color.lerpColors(this.barMid, this.barHigh, (v - 0.5) * 2);
      this.bars.setColorAt(i, this.color);
    }
    this.bars.instanceMatrix.needsUpdate = true;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
  }

  // ── Labels ──

  private updateLabels(): void {
    if (!this.split) return; // labels are hidden by CSS below the split breakpoint

    const wJ = this.weights[Ch.Journey]!;
    this.stationLabels.forEach((label, i) => {
      this.stationGroups[i]!.getWorldPosition(this.v1).y += 0.95;
      this.placeLabel(label, this.v1, wJ, i === this.selection.station);
    });

    // Layer labels: x beside the platter's silhouette, y on its visible front band,
    // so each label points at exactly the surface a click selects.
    const wS = this.weights[Ch.Stack]!;
    this.layerLabels.forEach((label, i) => {
      const centre = this.platters[i]!.getWorldPosition(this.v3);
      this.v1.copy(centre).addScaledVector(this.camRight, 1.65);
      this.v2.subVectors(this.camera.position, centre).setY(0).normalize();
      this.v4.copy(centre).addScaledVector(this.v2, 1.3);
      this.placeLabel(label, this.v1, wS, i === this.selection.layer, this.v4);
    });

    const wW = this.weights[Ch.Work]!;
    this.stepLabels.forEach((label, i) => {
      const node = this.workNodes[i];
      if (!node) return this.placeLabel(label, this.v1, 0, false);
      node.group.getWorldPosition(this.v1).y += 0.85;
      this.placeLabel(label, this.v1, wW, i === this.selection.step);
    });

    this.v1.copy(SCATTER_AT).y += 2.9;
    this.placeLabel(this.scatterLabel, this.v1, this.weights[Ch.Resume]!, false);
  }

  /** Positions a label at the projection of `world` (or `worldY` for the vertical axis). */
  private placeLabel(label: Label, world: Vector3, weight: number, active: boolean, worldY?: Vector3): void {
    const visible = weight > 0.02;
    if (visible) {
      this.projected.copy(world).project(this.camera);
      if (this.projected.z > 1) weight = 0;
      const x = Math.round((this.projected.x * 0.5 + 0.5) * this.width);
      if (worldY) this.projected.copy(worldY).project(this.camera);
      const y = Math.round((-this.projected.y * 0.5 + 0.5) * this.height);
      label.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      label.el.style.opacity = weight.toFixed(3);
      label.el.classList.toggle('is-active', active);
      label.el.style.pointerEvents = weight > 0.6 ? 'auto' : 'none';
    }
    if (visible !== label.shown) {
      label.el.style.visibility = visible ? 'visible' : 'hidden';
      label.shown = visible;
    }
  }

  // ───────────────────────── Builders ─────────────────────────

  private buildLights(): void {
    this.scene.add(new AmbientLight(0x8b7bd8, 0.9));
    const key = new PointLight(COLORS.violet, 60, 40, 2);
    key.position.set(4, 6, 6);
    const rim = new PointLight(COLORS.magenta, 28, 30, 2);
    rim.position.set(-6, 1, 2);
    const jl = new PointLight(COLORS.violet, 40, 26, 2);
    jl.position.copy(JOURNEY_AT).add(new Vector3(0, 4, 4));
    const wl = new PointLight(COLORS.violet, 40, 26, 2);
    wl.position.copy(WORK_AT).add(new Vector3(0, 4, 4));
    const dir = new DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 10, 4);
    this.scene.add(key, rim, jl, wl, dir);
  }

  /** Seven stacked platters — one per data-stack layer, foundation at the bottom. */
  private buildDatabase(): void {
    const n = this.options.content.layers.length;
    const platterGeo = new CylinderGeometry(1.3, 1.3, 0.26, 72, 1);
    const rimGeo = new TorusGeometry(1.31, 0.018, 8, 120);

    for (let i = 0; i < n; i++) {
      const mat = new MeshStandardMaterial({
        color: COLORS.body,
        metalness: 0.55,
        roughness: 0.3,
        emissive: COLORS.deep,
        emissiveIntensity: 0.16,
      });
      const platter = new Mesh(platterGeo, mat);
      platter.position.y = -1.2 + i * LAYER_PITCH;
      platter.userData['hit'] = { kind: 'layer', index: i } satisfies Hit;

      const rimMat = new MeshBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.5 });
      for (const dy of [-0.13, 0.13]) {
        const rim = new Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = dy;
        platter.add(rim);
      }
      this.platters.push(platter);
      this.platterMats.push(mat);
      this.rimMats.push(rimMat);
      this.layerGlow.push(0);
      this.db.add(platter);
    }
    this.dbTop.set(0, -1.2 + (n - 1) * LAYER_PITCH + 0.3, 0);

    const spine = new Mesh(
      new CylinderGeometry(0.05, 0.05, n * LAYER_PITCH + 0.8, 12),
      new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.8 }),
    );
    spine.position.y = -1.2 + ((n - 1) * LAYER_PITCH) / 2;
    this.db.add(spine);

    const haloMat = new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.32 });
    const ring1 = new Mesh(new TorusGeometry(2.4, 0.012, 6, 160), haloMat);
    const ring2 = new Mesh(new TorusGeometry(2.85, 0.008, 6, 160), haloMat);
    ring1.rotation.x = Math.PI / 2.3;
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.y = 0.4;
    const markerGeo = new SphereGeometry(0.06, 12, 12);
    const markerMat = new MeshBasicMaterial({ color: COLORS.lilac });
    for (let i = 0; i < 6; i++) {
      const m = new Mesh(markerGeo, markerMat);
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
      ring1.add(m);
    }
    this.halo.add(ring1, ring2);
    this.scene.add(this.db, this.halo);
  }

  private buildSources(): void {
    const geo = new BoxGeometry(0.46, 0.46, 0.46);
    const edges = new EdgesGeometry(geo);
    const mat = new MeshStandardMaterial({
      color: 0x2a1856,
      emissive: COLORS.violet,
      emissiveIntensity: 0.35,
      metalness: 0.3,
      roughness: 0.4,
    });
    const edgeMat = new LineBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.85 });
    for (let i = 0; i < SOURCE_COUNT; i++) {
      const a = (i / SOURCE_COUNT) * Math.PI * 2;
      const node = new Mesh(geo, mat);
      node.add(new LineSegments(edges, edgeMat));
      node.position.set(Math.cos(a) * SOURCE_RADIUS, -0.8 + ((i * 37) % 10) * 0.28, Math.sin(a) * SOURCE_RADIUS);
      this.sources.push(node);
      this.sourceRing.add(node);
    }
    this.scene.add(this.sourceRing);
  }

  private buildStreams(small: boolean): void {
    const segs = 24;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(SOURCE_COUNT * segs * 2 * 3), 3));
    this.streamLineMat = new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.3 });
    const lines = new LineSegments(g, this.streamLineMat);
    lines.frustumCulled = false;
    this.streamLines.push(lines);
    this.scene.add(lines);

    const perStream = small ? 14 : 26;
    const count = SOURCE_COUNT * perStream;
    const colors = new Float32Array(count * 3);
    this.streamSeeds = new Float32Array(count * 2);
    const palette = [new Color(COLORS.lilac), new Color(COLORS.violet), new Color(COLORS.magenta)];
    for (let i = 0; i < count; i++) {
      this.streamSeeds[i * 2] = i % SOURCE_COUNT;
      this.streamSeeds[i * 2 + 1] = Math.random();
      palette[i % 3]!.toArray(colors, i * 3);
    }
    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    pg.setAttribute('color', new BufferAttribute(colors, 3));
    this.streamPoints = new Points(pg, this.glowMaterial({ size: 0.13, vertexColors: true }));
    this.streamPoints.frustumCulled = false;
    this.scene.add(this.streamPoints);
  }

  /** A curved pipeline track with one station per career milestone. */
  private buildJourney(): void {
    this.journey.position.copy(JOURNEY_AT);
    this.journeyCurve = new CatmullRomCurve3([
      new Vector3(-4, -0.5, 0.7),
      new Vector3(-1.8, 0.45, -0.5),
      new Vector3(0.4, -0.25, 0.6),
      new Vector3(2.4, 0.6, -0.4),
      new Vector3(4, 0.15, 0.3),
    ]);
    // Track the curve in world space for the packets.
    const worldCurve = new CatmullRomCurve3(this.journeyCurve.points.map((p) => p.clone().add(JOURNEY_AT)));

    const tube = new Mesh(
      new TubeGeometry(this.journeyCurve, 220, 0.035, 8, false),
      new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.75 }),
    );
    this.journey.add(tube);

    const coreGeo = new IcosahedronGeometry(0.3, 1);
    const ringGeo = new TorusGeometry(0.58, 0.02, 8, 80);
    const beamGeo = new CylinderGeometry(0.012, 0.012, 1, 6);
    beamGeo.translate(0, -0.5, 0);
    const beamMat = new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.35 });
    const hitGeo = new SphereGeometry(0.75, 12, 12);
    const hitMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    const n = this.options.content.stations.length;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1);
      const p = this.journeyCurve.getPointAt(u);
      const g = new Group();
      g.position.copy(p);
      this.stationBaseY.push(p.y);

      const mat = new MeshStandardMaterial({
        color: 0x2a1856,
        emissive: COLORS.violet,
        emissiveIntensity: 0.25,
        metalness: 0.35,
        roughness: 0.35,
        flatShading: true,
      });
      g.add(new Mesh(coreGeo, mat));

      const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.85 }));
      g.add(ring);

      const beam = new Mesh(beamGeo, beamMat);
      beam.scale.y = p.y - FLOOR_Y + JOURNEY_AT.y;
      g.add(beam);

      const hit = new Mesh(hitGeo, hitMat);
      hit.userData['hit'] = { kind: 'station', index: i } satisfies Hit;
      g.add(hit);

      if (i === n - 1) {
        // The current role broadcasts a pulse.
        this.nowRing = new Mesh(
          new TorusGeometry(0.6, 0.012, 6, 80),
          new MeshBasicMaterial({ color: COLORS.magenta, transparent: true, opacity: 0.5 }),
        );
        this.nowRing.rotation.x = Math.PI / 2;
        g.add(this.nowRing);
      }

      this.stationGroups.push(g);
      this.stationMats.push(mat);
      this.stationRings.push(ring);
      this.stationHits.push(hit);
      this.stationGlow.push(0);
      this.journey.add(g);
    }

    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(new Float32Array(48 * 3), 3));
    this.journeyPackets = new Points(pg, this.glowMaterial({ size: 0.14, color: COLORS.lilac }));
    this.journeyPackets.frustumCulled = false;
    this.journeyCurve = worldCurve;
    this.scene.add(this.journey, this.journeyPackets);
  }

  /** Decorative schema graph behind the work pipeline — data modelling. */
  private buildGraph(): void {
    this.graph.position.copy(WORK_AT).add(new Vector3(0.6, 1.4, -6.5));
    const n = 26;
    const nodes: Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const radius = 2.3 + Math.sin(i * 12.9898) * 0.3;
      nodes.push(new Vector3(Math.cos(golden * i) * r * radius, y * radius, Math.sin(golden * i) * r * radius));
    }
    const tableGeo = new BoxGeometry(0.28, 0.18, 0.18);
    const tableEdges = new EdgesGeometry(tableGeo);
    const tableMat = new MeshBasicMaterial({ color: COLORS.deep });
    const edgeMat = new LineBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.7 });
    const keyGeo = new IcosahedronGeometry(0.08, 0);
    const keyMat = new MeshBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.8 });
    nodes.forEach((p, i) => {
      const mesh = i % 3 === 0 ? new Mesh(tableGeo, tableMat) : new Mesh(keyGeo, keyMat);
      if (i % 3 === 0) mesh.add(new LineSegments(tableEdges, edgeMat));
      mesh.position.copy(p);
      this.graph.add(mesh);
    });

    const seen = new Set<string>();
    const linePos: number[] = [];
    nodes.forEach((p, i) => {
      nodes
        .map((q, j) => ({ j, d: p.distanceToSquared(q) }))
        .filter((e) => e.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          const q = nodes[j]!;
          linePos.push(p.x, p.y, p.z, q.x, q.y, q.z);
          this.graphEdges.push([p, q]);
        });
    });
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(linePos), 3));
    this.graph.add(new LineSegments(lg, new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.35 })));

    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(new Float32Array(this.graphEdges.length * 3), 3));
    this.graphPulse = new Points(pg, this.glowMaterial({ size: 0.15, color: COLORS.magenta }));
    this.graph.add(this.graphPulse);
    this.scene.add(this.graph);
  }

  private buildWork(): void {
    this.work.position.copy(WORK_AT);
    this.scene.add(this.work);
    this.rebuildWorkPipeline();
  }

  /** (Re)builds the pipeline for the selected project: one node per step. */
  private rebuildWorkPipeline(): void {
    const steps = this.options.content.projects[this.selection.project]?.steps ?? [];
    const n = steps.length;

    // Update step labels in place.
    this.stepLabels.forEach((label, i) => {
      label.title.textContent = steps[i] ?? '';
      label.sub.textContent = String(i + 1);
    });

    if (n === this.workNodes.length && this.workCurve) {
      this.workPop = 0; // same shape — just replay the entrance
      return;
    }

    // Shape changed: dispose and rebuild.
    for (const node of this.workNodes) {
      this.work.remove(node.group);
      node.group.traverse((o) => (o as Partial<Mesh>).geometry?.dispose());
      node.mat.dispose();
    }
    this.workNodes.length = 0;
    this.workGlow.length = 0;
    if (this.workTube) {
      this.work.remove(this.workTube);
      this.workTube.geometry.dispose();
      (this.workTube.material as Material).dispose();
    }
    if (this.workPackets) {
      this.scene.remove(this.workPackets);
      this.workPackets.geometry.dispose();
      (this.workPackets.material as Material).dispose();
    }

    const positions: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      positions.push(new Vector3(-3.6 + 7.2 * f, Math.sin(i * 1.3) * 0.3, -Math.sin(Math.PI * f) * 1.1));
    }

    const geo = new BoxGeometry(0.66, 0.66, 0.66);
    const edges = new EdgesGeometry(geo);
    const edgeMat = new LineBasicMaterial({ color: COLORS.lilac });
    const hitGeo = new SphereGeometry(0.75, 12, 12);
    const hitMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    positions.forEach((p, i) => {
      const group = new Group();
      group.position.copy(p);
      const mat = new MeshStandardMaterial({
        color: 0x2a1856,
        emissive: COLORS.violet,
        emissiveIntensity: 0.2,
        metalness: 0.4,
        roughness: 0.35,
      });
      const box = new Mesh(geo, mat);
      box.add(new LineSegments(edges, edgeMat));
      group.add(box);
      const hit = new Mesh(hitGeo, hitMat);
      hit.userData['hit'] = { kind: 'step', index: i } satisfies Hit;
      group.add(hit);
      this.work.add(group);
      this.workNodes.push({ group, mat, hit });
      this.workGlow.push(0);
    });

    if (n > 1) {
      const local = new CatmullRomCurve3(positions);
      this.workTube = new Mesh(
        new TubeGeometry(local, 160, 0.03, 8, false),
        new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.7 }),
      );
      this.work.add(this.workTube);
      this.workCurve = new CatmullRomCurve3(positions.map((p) => p.clone().add(WORK_AT)));
      const pg = new BufferGeometry();
      pg.setAttribute('position', new BufferAttribute(new Float32Array(40 * 3), 3));
      this.workPackets = new Points(pg, this.glowMaterial({ size: 0.14, color: COLORS.lilac }));
      this.workPackets.frustumCulled = false;
      this.scene.add(this.workPackets);
    }
    this.workPop = 0;
  }

  /** 3D scatter plot of three clusters, with k-means centroids. */
  private buildScatter(small: boolean): void {
    this.scatter.position.copy(SCATTER_AT);
    const centres = [new Vector3(-1, -0.6, 0.4), new Vector3(1.1, 0.5, -0.5), new Vector3(-0.2, 1, -1)];
    const hues = [COLORS.violet, COLORS.magenta, COLORS.sky];
    const per = small ? 160 : 280;
    const total = per * centres.length;

    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    this.scatterCluster = new Uint8Array(total);
    let k = 0;
    centres.forEach((c, ci) => {
      const col = new Color(hues[ci]);
      for (let i = 0; i < per; i++, k++) {
        positions[k * 3] = c.x + this.gauss() * 0.4;
        positions[k * 3 + 1] = c.y + this.gauss() * 0.4;
        positions[k * 3 + 2] = c.z + this.gauss() * 0.4;
        col.toArray(colors, k * 3);
        this.scatterCluster[k] = ci;
      }
    });
    this.scatterFrom = new Float32Array(positions);
    this.scatterTo = new Float32Array(positions);

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    this.scatterPoints = new Points(g, this.glowMaterial({ size: 0.075, vertexColors: true }));
    this.scatter.add(this.scatterPoints);

    const boxGeo = new BoxGeometry(4.4, 4.4, 4.4);
    this.scatter.add(
      new LineSegments(
        new EdgesGeometry(boxGeo),
        new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.28 }),
      ),
    );
    const axes = new BufferGeometry();
    axes.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([-2.2, -2.2, 2.2, 2.4, -2.2, 2.2, -2.2, -2.2, 2.2, -2.2, 2.4, 2.2, -2.2, -2.2, 2.2, -2.2, -2.2, -2.4]),
        3,
      ),
    );
    this.scatter.add(new LineSegments(axes, new LineBasicMaterial({ color: COLORS.lilac })));

    this.scatterHit = new Mesh(boxGeo, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.scatterHit.userData['hit'] = { kind: 'scatter', index: 0 } satisfies Hit;
    this.scatter.add(this.scatterHit);

    const cGeo = new OctahedronGeometry(0.2, 0);
    centres.forEach((c, ci) => {
      const m = new Mesh(cGeo, new MeshBasicMaterial({ color: hues[ci], wireframe: true }));
      m.position.copy(c);
      this.centroids.push(m);
      this.centroidFrom.push(c.clone());
      this.centroidTo.push(c.clone());
      this.scatter.add(m);
    });
    this.scene.add(this.scatter);
  }

  private buildFloor(small: boolean): void {
    const size = small ? 12 : 18;
    const gap = 0.92;
    const geo = new BoxGeometry(0.62, 1, 0.62);
    geo.translate(0, 0.5, 0);
    this.bars = new InstancedMesh(
      geo,
      new MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.85 }),
      size * size,
    );
    this.bars.position.set(0, FLOOR_Y, 0);
    const half = ((size - 1) * gap) / 2;
    for (let ix = 0; ix < size; ix++) {
      for (let iz = 0; iz < size; iz++) {
        const x = ix * gap - half;
        const z = iz * gap - half;
        this.barCells.push({ x, z, falloff: MathUtils.clamp(1.15 - Math.hypot(x, z) / half, 0.08, 1) });
      }
    }
    this.updateBars(0);
    this.scene.add(this.bars);

    const grid = new GridHelper(90, 90, COLORS.deep, 0x24163f);
    grid.position.y = FLOOR_Y - 0.02;
    const gm = grid.material as Material;
    gm.transparent = true;
    gm.opacity = 0.45;
    this.scene.add(grid);

    const n = small ? 600 : 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 22 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.dust = new Points(g, this.glowMaterial({ size: 0.05, color: COLORS.lilac, opacity: 0.55, additive: false }));
    this.scene.add(this.dust);
  }

  private buildLabels(): void {
    const { stations, layers, projects } = this.options.content;
    stations.forEach((s, i) => {
      this.stationLabels.push(this.makeLabel('above', s.title, s.sub, () => this.select({ kind: 'station', index: i })));
    });
    layers.forEach((name, i) => {
      this.layerLabels.push(
        this.makeLabel('right', name, String(i + 1).padStart(2, '0'), () => this.select({ kind: 'layer', index: i })),
      );
    });
    const maxSteps = Math.max(0, ...projects.map((p) => p.steps.length));
    for (let i = 0; i < maxSteps; i++) {
      this.stepLabels.push(this.makeLabel('above', '', '', () => this.select({ kind: 'step', index: i })));
    }
    this.scatterLabel = this.makeLabel('above', 'Click the plot to re-cluster', 'k-means · k = 3', () => this.recluster());
    this.rebuildWorkPipeline(); // fills step label text
  }

  private makeLabel(align: 'above' | 'right', title: string, sub: string, onClick: () => void): Label {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'scene-label';
    el.dataset['align'] = align;
    el.tabIndex = -1; // the same actions are available in the page content
    el.setAttribute('aria-hidden', 'true');
    const subEl = document.createElement('span');
    subEl.className = 'scene-label__sub';
    subEl.textContent = sub;
    const titleEl = document.createElement('span');
    titleEl.className = 'scene-label__title';
    titleEl.textContent = title;
    if (align === 'right') el.append(subEl, titleEl);
    else el.append(titleEl, subEl);
    el.style.visibility = 'hidden';
    el.addEventListener('click', onClick);
    this.options.labelLayer.append(el);
    return { el, title: titleEl, sub: subEl, shown: false };
  }

  // ───────────────────────── Helpers ─────────────────────────

  /** Quadratic bezier for ETL stream `i` at parameter `u`. */
  private bezier(i: number, u: number, out: Vector3): Vector3 {
    const a = this.streamStarts[i]!;
    const c = this.streamCtrl[i]!;
    const b = this.dbTop;
    const v = 1 - u;
    return out.set(
      v * v * a.x + 2 * v * u * c.x + u * u * b.x,
      v * v * a.y + 2 * v * u * c.y + u * u * b.y,
      v * v * a.z + 2 * v * u * c.z + u * u * b.z,
    );
  }

  private glowMaterial(o: {
    size: number;
    color?: number;
    vertexColors?: boolean;
    opacity?: number;
    additive?: boolean;
  }): PointsMaterial {
    const mat = new PointsMaterial({
      size: o.size,
      color: o.color ?? 0xffffff,
      vertexColors: o.vertexColors ?? false,
      map: this.dot,
      transparent: true,
      opacity: o.opacity ?? 1,
      depthWrite: false,
    });
    if (o.additive !== false) mat.blending = AdditiveBlending;
    return mat;
  }

  /** Box–Muller standard normal sample. */
  private gauss(): number {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  private makeDotTexture(): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }
}
