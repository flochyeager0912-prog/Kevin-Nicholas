import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  FogExp2,
  GridHelper,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
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
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

/**
 * DataSceneEngine — framework-agnostic Three.js scene behind the profile.
 *
 * The scene tells a data-engineering story, one zone per page section:
 *   SOURCE    → source tables orbiting a database core
 *   INGEST    → ETL streams of particles flowing into the database
 *   STORE     → a live bar-chart "data surface" under the database
 *   TRANSFORM → a schema / entity-relationship graph with signals on its edges
 *   MODEL     → a 3-D scatter plot of clustered data with k-means centroids
 *   SERVE     → a wide shot of the whole pipeline
 *
 * Scroll position picks the camera keyframe; the camera eases toward it every frame,
 * which keeps motion smooth regardless of scroll-event cadence.
 * Lazy-loaded by DataScene so three.js never blocks first paint.
 */

export interface DataSceneOptions {
  /** DOM ids of the page sections, in order. Each gets one camera keyframe. */
  readonly sectionIds: readonly string[];
  readonly reducedMotion: boolean;
}

interface Keyframe {
  readonly pos: Vector3;
  readonly target: Vector3;
}

const COLORS = {
  bg: 0x0a0614,
  violet: 0x9b6bff,
  lilac: 0xd9c8ff,
  deep: 0x6d3fe0,
  magenta: 0xe879f9,
  sky: 0x93c5fd,
  plum: 0x1c1033,
} as const;

/** Camera keyframes — one per section, in section order. */
const KEYFRAMES: readonly Keyframe[] = [
  { pos: new Vector3(-2.6, 1.6, 11), target: new Vector3(-4.2, 0.2, 0) }, // hero — DB on the right
  { pos: new Vector3(6.5, 4.2, 9.5), target: new Vector3(-0.5, 0, 0) }, // journey — streams
  { pos: new Vector3(-5, 8.5, 9), target: new Vector3(1.5, -2.6, 0) }, // stack — data surface
  { pos: new Vector3(-1, 2.6, 4.5), target: new Vector3(-9, 1.2, -7) }, // work — schema graph
  { pos: new Vector3(3, 2.4, 3.5), target: new Vector3(10, 1.2, -8) }, // resume — scatter plot
  { pos: new Vector3(0, 4.5, 19), target: new Vector3(0, -0.5, -3) }, // contact — wide shot
];

const SOURCE_COUNT = 8;
const SOURCE_RADIUS = 4.8;
const DB_TOP = new Vector3(0, 1.25, 0);

export class DataSceneEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 120);
  private readonly isSmall: boolean;

  // Animated parts
  private readonly dbGroup = new Group();
  private readonly dbRims: MeshBasicMaterial[] = [];
  private readonly halo = new Group();
  private readonly sourceRing = new Group();
  private readonly sources: Object3D[] = [];
  private streamLines: Line[] = [];
  private streamPoints!: Points;
  private streamSeeds!: Float32Array;
  private readonly streamStarts = Array.from({ length: SOURCE_COUNT }, () => new Vector3());
  private readonly streamCtrl = Array.from({ length: SOURCE_COUNT }, () => new Vector3());
  private readonly graph = new Group();
  private graphPulse!: Points;
  private graphEdges: [Vector3, Vector3][] = [];
  private readonly scatter = new Group();
  private centroids: Mesh[] = [];
  private bars!: InstancedMesh;
  private barCells: { x: number; z: number; falloff: number }[] = [];
  private dust!: Points;

  // Camera state
  private progress = 0; // eased
  private targetProgress = 0; // from scroll
  private readonly pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();

  // Loop state
  private raf = 0;
  private running = false;
  private last = 0;
  private time = 0;
  private sectionEls: HTMLElement[] = [];

  // Scratch objects reused every frame (no per-frame allocation).
  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();
  private readonly tmpC = new Vector3();
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly barLow = new Color(COLORS.plum);
  private readonly barMid = new Color(COLORS.deep);
  private readonly barHigh = new Color(COLORS.lilac);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: DataSceneOptions,
  ) {
    this.isSmall = window.innerWidth < 768;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !this.isSmall,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(COLORS.bg, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isSmall ? 1.5 : 1.75));

    this.scene.fog = new FogExp2(COLORS.bg, 0.034);

    this.buildLights();
    this.buildDatabase();
    this.buildSources();
    this.buildStreams();
    this.buildGraph();
    this.buildScatter();
    this.buildBars();
    this.buildFloorAndDust();

    this.sectionEls = options.sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    this.resize();
    this.readScroll();
    this.progress = this.targetProgress;
    this.applyCamera(1);

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  // ───────────────────────── Lifecycle ─────────────────────────

  start(): void {
    if (this.options.reducedMotion) {
      // Static composition: render once, then only on scroll / resize.
      this.update(0);
      this.render();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);

    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    this.scene.traverse((obj) => {
      const o = obj as Partial<Mesh>;
      o.geometry?.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        materials.add(m);
        const map = (m as PointsMaterial).map;
        if (map) textures.add(map);
      }
    });
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.last) / 1000, 1 / 20); // clamp after tab switches
    this.last = now;
    this.update(dt);
    this.render();
  };

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  // ───────────────────────── Events ─────────────────────────

  private readonly onResize = (): void => {
    this.resize();
    this.readScroll();
    if (this.options.reducedMotion) this.renderStatic();
  };

  private readonly onScroll = (): void => {
    this.readScroll();
    if (this.options.reducedMotion) this.renderStatic();
  };

  private readonly onPointer = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private readonly onVisibility = (): void => {
    if (this.options.reducedMotion) return;
    if (document.hidden) this.stop();
    else this.start();
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.stop();
    this.canvas.style.display = 'none';
  };

  private renderStatic(): void {
    this.progress = this.targetProgress;
    this.applyCamera(1);
    this.render();
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens get a wider field of view so the scene still reads.
    this.camera.fov = this.camera.aspect < 1 ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  /** Converts scroll position into a continuous section index (0 … n-1). */
  private readScroll(): void {
    const mid = window.innerHeight * 0.5;
    let p = 0;
    for (let i = 0; i < this.sectionEls.length; i++) {
      const r = this.sectionEls[i]!.getBoundingClientRect();
      if (r.top <= mid) p = i + MathUtils.clamp((mid - r.top) / Math.max(r.height, 1), 0, 1);
    }
    // Keyframe i is reached when the middle of section i crosses the viewport centre.
    this.targetProgress = MathUtils.clamp(p - 0.5, 0, KEYFRAMES.length - 1);
  }

  // ───────────────────────── Frame update ─────────────────────────

  private update(dt: number): void {
    this.time += dt;
    const t = this.time;

    // Ease scroll progress and pointer — frame-rate independent damping.
    const k = 1 - Math.exp(-dt * 3.2);
    this.progress += (this.targetProgress - this.progress) * k;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * (1 - Math.exp(-dt * 2.5));
    this.pointer.y += (this.pointer.ty - this.pointer.y) * (1 - Math.exp(-dt * 2.5));
    this.applyCamera(k);

    // Database core: slow spin, rims light up in sequence like disk I/O.
    this.dbGroup.rotation.y = t * 0.18;
    this.dbRims.forEach((m, i) => {
      m.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 - i * 0.9)) ** 3;
    });
    this.halo.rotation.z = t * 0.12;
    this.halo.rotation.y = Math.sin(t * 0.3) * 0.25;

    // Source tables orbit the core.
    this.sourceRing.rotation.y = -t * 0.08;
    this.sources.forEach((s, i) => {
      s.rotation.x = t * 0.4 + i;
      s.rotation.y = t * 0.3 + i * 0.5;
    });

    this.updateStreams(t);
    this.updateGraph(t);
    this.updateScatter(t);
    this.updateBars(t);
    this.dust.rotation.y = t * 0.01;
  }

  private applyCamera(k: number): void {
    const n = KEYFRAMES.length - 1;
    const i = Math.min(Math.floor(this.progress), n - 1);
    const f = MathUtils.smootherstep(this.progress - i, 0, 1);
    const a = KEYFRAMES[i]!;
    const b = KEYFRAMES[Math.min(i + 1, n)]!;

    this.tmpA.lerpVectors(a.pos, b.pos, f);
    this.tmpB.lerpVectors(a.target, b.target, f);

    // Pull back on small screens so objects stay framed behind the content.
    if (this.isSmall) this.tmpA.sub(this.tmpB).multiplyScalar(1.35).add(this.tmpB);

    // Subtle mouse parallax.
    this.tmpA.x += this.pointer.x * 0.7;
    this.tmpA.y += -this.pointer.y * 0.45;

    this.camPos.lerp(this.tmpA, k);
    this.camTarget.lerp(this.tmpB, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  // ───────────────────────── Builders ─────────────────────────

  private buildLights(): void {
    this.scene.add(new AmbientLight(0x8b7bd8, 0.9));
    const key = new PointLight(COLORS.violet, 60, 40, 2);
    key.position.set(4, 6, 6);
    const rim = new PointLight(COLORS.magenta, 28, 30, 2);
    rim.position.set(-6, 1, 2);
    const dir = new DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 10, 4);
    this.scene.add(key, rim, dir);
  }

  /** Stacked platters = the classic database cylinder, with glowing rims. */
  private buildDatabase(): void {
    const platter = new CylinderGeometry(1.25, 1.25, 0.38, 64, 1);
    const body = new MeshStandardMaterial({
      color: 0x231443,
      metalness: 0.55,
      roughness: 0.32,
      emissive: COLORS.deep,
      emissiveIntensity: 0.22,
    });
    const rimGeo = new TorusGeometry(1.26, 0.022, 8, 96);

    for (let i = 0; i < 4; i++) {
      const y = -1.05 + i * 0.62;
      const disc = new Mesh(platter, body);
      disc.position.y = y;
      this.dbGroup.add(disc);

      const rimMat = new MeshBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.6 });
      this.dbRims.push(rimMat);
      for (const dy of [-0.19, 0.19]) {
        const rim = new Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = y + dy;
        this.dbGroup.add(rim);
      }
    }

    // Vertical "index" spine through the core.
    const spine = new Mesh(
      new CylinderGeometry(0.05, 0.05, 3.4, 12),
      new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.8 }),
    );
    this.dbGroup.add(spine);

    // Tilted halo rings with orbiting index markers.
    const haloMat = new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.35 });
    const ring1 = new Mesh(new TorusGeometry(2.3, 0.012, 6, 160), haloMat);
    const ring2 = new Mesh(new TorusGeometry(2.75, 0.008, 6, 160), haloMat);
    ring1.rotation.x = Math.PI / 2.3;
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.y = 0.4;
    const markerGeo = new SphereGeometry(0.06, 12, 12);
    const markerMat = new MeshBasicMaterial({ color: COLORS.lilac });
    for (let i = 0; i < 6; i++) {
      const m = new Mesh(markerGeo, markerMat);
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.3, 0);
      ring1.add(m);
    }
    this.halo.add(ring1, ring2);

    this.scene.add(this.dbGroup, this.halo);
  }

  /** Source tables: small cubes with wireframe edges orbiting the core. */
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

  /** ETL streams: a bezier path per source, with particles travelling into the core. */
  private buildStreams(): void {
    const segments = 28;
    const lineMat = new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.28 });
    this.streamLines = this.sources.map(() => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array((segments + 1) * 3), 3));
      const line = new Line(g, lineMat);
      line.frustumCulled = false;
      this.scene.add(line);
      return line;
    });

    const perStream = this.isSmall ? 14 : 26;
    const count = SOURCE_COUNT * perStream;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.streamSeeds = new Float32Array(count * 2); // [stream index, phase]
    const palette = [new Color(COLORS.lilac), new Color(COLORS.violet), new Color(COLORS.magenta)];
    for (let i = 0; i < count; i++) {
      this.streamSeeds[i * 2] = i % SOURCE_COUNT;
      this.streamSeeds[i * 2 + 1] = Math.random();
      palette[i % 3]!.toArray(colors, i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    this.streamPoints = new Points(
      g,
      new PointsMaterial({
        size: 0.13,
        map: this.dotTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.streamPoints.frustumCulled = false;
    this.scene.add(this.streamPoints);
  }

  /** Schema graph: nodes on a sphere linked to nearest neighbours, like an ER diagram. */
  private buildGraph(): void {
    this.graph.position.set(-9, 1.2, -7);
    const n = 26;
    const nodes: Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const radius = 2.4 + Math.sin(i * 12.9898) * 0.35;
      nodes.push(new Vector3(Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius));
    }

    const tableGeo = new BoxGeometry(0.26, 0.18, 0.18);
    const tableEdges = new EdgesGeometry(tableGeo);
    const tableMat = new MeshBasicMaterial({ color: COLORS.deep });
    const edgeMat = new LineBasicMaterial({ color: COLORS.lilac });
    const keyGeo = new IcosahedronGeometry(0.09, 0);
    const keyMat = new MeshBasicMaterial({ color: COLORS.lilac });

    nodes.forEach((p, i) => {
      // Every third node is a "table", the rest are key/column nodes.
      const mesh = i % 3 === 0 ? new Mesh(tableGeo, tableMat) : new Mesh(keyGeo, keyMat);
      if (i % 3 === 0) mesh.add(new LineSegments(tableEdges, edgeMat));
      mesh.position.copy(p);
      this.graph.add(mesh);
    });

    // Link each node to its 2 nearest neighbours (deduplicated).
    const seen = new Set<string>();
    const linePos: number[] = [];
    nodes.forEach((p, i) => {
      nodes
        .map((q, j) => ({ j, d: p.distanceToSquared(q) }))
        .filter((e) => e.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          linePos.push(p.x, p.y, p.z, nodes[j]!.x, nodes[j]!.y, nodes[j]!.z);
          this.graphEdges.push([p, nodes[j]!]);
        });
    });
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(linePos), 3));
    this.graph.add(
      new LineSegments(lg, new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.45 })),
    );

    // Signals travelling along relationships (foreign-key lookups).
    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(new Float32Array(this.graphEdges.length * 3), 3));
    this.graphPulse = new Points(
      pg,
      new PointsMaterial({
        size: 0.16,
        color: COLORS.magenta,
        map: this.dotTexture(),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.graph.add(this.graphPulse);
    this.scene.add(this.graph);
  }

  /** Data-science zone: 3-D scatter plot of three clusters inside a plot box. */
  private buildScatter(): void {
    this.scatter.position.set(10, 1.2, -8);
    const centres = [new Vector3(-1, -0.6, 0.4), new Vector3(1.1, 0.5, -0.5), new Vector3(-0.2, 1, -1)];
    const hues = [COLORS.violet, COLORS.magenta, COLORS.sky];
    const per = this.isSmall ? 160 : 300;

    const positions = new Float32Array(per * 3 * 3);
    const colors = new Float32Array(per * 3 * 3);
    let o = 0;
    centres.forEach((c, ci) => {
      const col = new Color(hues[ci]);
      for (let i = 0; i < per; i++) {
        positions[o] = c.x + this.gauss() * 0.42;
        positions[o + 1] = c.y + this.gauss() * 0.42;
        positions[o + 2] = c.z + this.gauss() * 0.42;
        col.toArray(colors, o);
        o += 3;
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    this.scatter.add(
      new Points(
        g,
        new PointsMaterial({
          size: 0.075,
          vertexColors: true,
          map: this.dotTexture(),
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    );

    // Plot box + axes.
    const box = new LineSegments(
      new EdgesGeometry(new BoxGeometry(4.4, 4.4, 4.4)),
      new LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.25 }),
    );
    const axes = new BufferGeometry();
    axes.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-2.2, -2.2, 2.2, 2.4, -2.2, 2.2, -2.2, -2.2, 2.2, -2.2, 2.4, 2.2, -2.2, -2.2, 2.2, -2.2, -2.2, -2.4]), 3),
    );
    this.scatter.add(box, new LineSegments(axes, new LineBasicMaterial({ color: COLORS.lilac })));

    // k-means centroids.
    const cGeo = new OctahedronGeometry(0.18, 0);
    this.centroids = centres.map((c, ci) => {
      const m = new Mesh(cGeo, new MeshBasicMaterial({ color: hues[ci], wireframe: true }));
      m.position.copy(c);
      this.scatter.add(m);
      return m;
    });

    this.scene.add(this.scatter);
  }

  /** Data surface: a grid of bars whose heights ripple like live metrics. */
  private buildBars(): void {
    const size = this.isSmall ? 12 : 18;
    const gap = 0.92;
    const geo = new BoxGeometry(0.62, 1, 0.62);
    geo.translate(0, 0.5, 0); // grow upward from the floor
    const mat = new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.5,
      transparent: true,
      opacity: 0.88,
    });
    this.bars = new InstancedMesh(geo, mat, size * size);
    this.bars.position.set(0, -3.3, 0);

    const half = ((size - 1) * gap) / 2;
    for (let ix = 0; ix < size; ix++) {
      for (let iz = 0; iz < size; iz++) {
        const x = ix * gap - half;
        const z = iz * gap - half;
        const d = Math.hypot(x, z) / half;
        this.barCells.push({ x, z, falloff: MathUtils.clamp(1.15 - d, 0.08, 1) });
      }
    }
    this.updateBars(0);
    this.scene.add(this.bars);
  }

  private buildFloorAndDust(): void {
    const grid = new GridHelper(80, 80, COLORS.deep, 0x24163f);
    grid.position.y = -3.32;
    const gm = grid.material as Material;
    gm.transparent = true;
    gm.opacity = 0.45;
    this.scene.add(grid);

    const n = this.isSmall ? 600 : 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 22 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.dust = new Points(
      g,
      new PointsMaterial({
        size: 0.05,
        color: COLORS.lilac,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        map: this.dotTexture(),
      }),
    );
    this.scene.add(this.dust);
  }

  // ───────────────────────── Per-frame updates ─────────────────────────

  private updateStreams(t: number): void {
    // Rebuild each bezier path from the source's current world position.
    const starts = this.streamStarts;
    const ctrl = this.streamCtrl;
    this.sourceRing.updateMatrixWorld();
    this.sources.forEach((s, i) => {
      const start = s.getWorldPosition(starts[i]!);
      const c = ctrl[i]!.copy(start).multiplyScalar(0.45);
      c.y = start.y + 2.4;

      const attr = this.streamLines[i]!.geometry.getAttribute('position') as BufferAttribute;
      const segs = attr.count - 1;
      for (let j = 0; j <= segs; j++) {
        this.bezier(start, c, DB_TOP, j / segs, this.tmpC);
        attr.setXYZ(j, this.tmpC.x, this.tmpC.y, this.tmpC.z);
      }
      attr.needsUpdate = true;
    });

    const attr = this.streamPoints.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const si = this.streamSeeds[i * 2]!;
      const phase = this.streamSeeds[i * 2 + 1]!;
      const u = (t * 0.22 + phase) % 1;
      this.bezier(starts[si]!, ctrl[si]!, DB_TOP, u, this.tmpC);
      attr.setXYZ(i, this.tmpC.x, this.tmpC.y, this.tmpC.z);
    }
    attr.needsUpdate = true;
  }

  private updateGraph(t: number): void {
    this.graph.rotation.y = t * 0.1;
    this.graph.rotation.x = Math.sin(t * 0.2) * 0.15;
    const attr = this.graphPulse.geometry.getAttribute('position') as BufferAttribute;
    this.graphEdges.forEach(([a, b], i) => {
      const u = (t * 0.35 + i * 0.137) % 1;
      this.tmpC.lerpVectors(a, b, u);
      attr.setXYZ(i, this.tmpC.x, this.tmpC.y, this.tmpC.z);
    });
    attr.needsUpdate = true;
  }

  private updateScatter(t: number): void {
    this.scatter.rotation.y = t * 0.15;
    this.centroids.forEach((c, i) => {
      c.rotation.y = t * 1.2 + i;
      c.scale.setScalar(1 + 0.25 * Math.sin(t * 2 + i * 2));
    });
  }

  private updateBars(t: number): void {
    this.barCells.forEach((cell, i) => {
      const wave = Math.sin(cell.x * 0.55 + t * 0.9) + Math.cos(cell.z * 0.45 - t * 0.7) + Math.sin((cell.x + cell.z) * 0.3 + t * 0.5);
      const v = MathUtils.clamp((wave + 3) / 6, 0, 1); // 0…1
      const h = 0.08 + v * 1.9 * cell.falloff;
      this.dummy.position.set(cell.x, 0, cell.z);
      this.dummy.scale.set(1, h, 1);
      this.dummy.updateMatrix();
      this.bars.setMatrixAt(i, this.dummy.matrix);

      if (v < 0.5) this.color.lerpColors(this.barLow, this.barMid, v * 2);
      else this.color.lerpColors(this.barMid, this.barHigh, (v - 0.5) * 2);
      this.bars.setColorAt(i, this.color);
    });
    this.bars.instanceMatrix.needsUpdate = true;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
  }

  // ───────────────────────── Helpers ─────────────────────────

  private bezier(a: Vector3, c: Vector3, b: Vector3, u: number, out: Vector3): Vector3 {
    const v = 1 - u;
    return out.set(
      v * v * a.x + 2 * v * u * c.x + u * u * b.x,
      v * v * a.y + 2 * v * u * c.y + u * u * b.y,
      v * v * a.z + 2 * v * u * c.z + u * u * b.z,
    );
  }

  /** Box–Muller standard normal sample. */
  private gauss(): number {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  private dotTextureCache?: Texture;

  /** Soft round sprite so points render as glowing dots instead of squares. */
  private dotTexture(): Texture {
    if (this.dotTextureCache) return this.dotTextureCache;
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
    return (this.dotTextureCache = tex);
  }
}
