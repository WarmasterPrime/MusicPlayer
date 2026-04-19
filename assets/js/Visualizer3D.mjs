import * as THREE from "./ext/three.module.mjs";
import { sharedBpm } from "./BpmEstimator.mjs";

/**
 * Manages Three.js 3D visualization designs for the MusicPlayer.
 * Renders onto a WebGL canvas overlaid on the 2D canvas.
 * Designs: 3D Bars (grid), 3D Waves (morphing icosahedron), 3D Sphere (frequency-deformed sphere).
 * Includes mouse orbit controls for all designs.
 */
export class Visualizer3D {

	// ── Renderer state ──────────────────────────────
	static #renderer = null;
	static #scene = null;
	static #camera = null;
	static #canvas = null;
	static #active = false;
	static #currentDesign = "";

	// ── 3D Bars state ───────────────────────────────
	static #barMeshes = [];
	static #barGroup = null;

	// ── 3D Waves state ──────────────────────────────
	static #waveMesh = null;

	// ── 3D Sphere state ─────────────────────────────
	static #sphereMesh = null;
	static #sphereGeometry = null;
	static #sphereBasePositions = null;
	static #sphereLight = null;

	// ── Light object refs ────────────────────────────
	static #ambientLight = null;
	static #directionalLight = null;

	// ── Vertex Distortion state ──────────────────────
	static #vdMesh = null;

	// ── Plane Ripple state ───────────────────────────
	static #rippleMesh = null;
	static #rippleGeometry = null;
	static #rippleBasePositions = null;
	static #rippleRings = 0;
	static #rippleHistory = null;
	// Grid-based shallow-water simulation state for Plane Ripple.
	static #rippleWaveA = null;     // previous-step heights
	static #rippleWaveB = null;     // current-step heights
	static #rippleGridN = 0;         // grid resolution (N × N)
	static #rippleTexture = null;    // procedural water texture

	// ── Liquid Sphere state ──────────────────────────
	static #liquidMesh = null;
	static #liquidGeometry = null;
	static #liquidBasePositions = null;
	static #liquidGlowMesh = null;

	// ── Smoke Triangle state ─────────────────────────
	static #smokeTriangles = [];
	static #smokeParticleData = [];
	static #smokeParticleGeo = null;
	static #smokeParticleMat = null;
	static #smokeGroup = null;
	static #smokePrism = null;
	static #smokeBaseRadius = 0;
	static #smokeInnerRadius = 0;
	static #smokeNozzleDepth = 0;
	static #smokeMaxHeight = 0;
	static #smokeSampleTriangle = null;

	// ── Record Player state ──────────────────────────
	static #recordGroup = null;
	static #recordDisc = null;
	static #recordArm = null;
	static #recordLabel = null;
	static #recordGrooves = null;
	static #waveformPoints = null;
	static #recordLogoMesh = null;   // glowing "Virtma" 3D text plaque
	// Frequency bars that sit on top of the disc and rotate with it.
	static #recordBarGroup = null;
	static #recordBars = [];
	// Needle / stylus mesh — stored separately so we can land its tip
	// precisely on the spinning disc surface each frame.
	static #recordNeedle = null;

	// ── 3D Sand (Chladni cymatics) state ─────────────
	static #sandGroup = null;
	static #sandGeometry = null;
	static #sandMaterial = null;
	static #sandPoints = null;   // THREE.Points
	static #sandPlane = null;    // background plate mesh
	static #sandCount = 0;
	static #sandPositions = null;   // Float32Array of current positions
	static #sandBase = null;         // Float32Array of base positions (jittered)

	// ── DNA Helix state ─────────────────────────────
	static #dnaGroup = null;
	static #dnaStrandA = null;       // Line-strip mesh (strand 1)
	static #dnaStrandB = null;       // Line-strip mesh (strand 2)
	static #dnaStrandAGeo = null;
	static #dnaStrandBGeo = null;
	static #dnaRungGroup = null;     // Group of rung cylinders
	static #dnaRungs = [];           // { mesh, sphereA, sphereB, baseIdx }
	static #dnaSegments = 0;         // # points per strand
	static #dnaRotation = 0;

	// ── Neon Tunnel state ───────────────────────────
	static #tunnelGroup = null;
	static #tunnelRings = [];        // { mesh, geometry, baseR, z, birthFrame }
	static #tunnelFrame = 0;
	static #tunnelRingSegments = 48;
	static #tunnelMaxRings = 60;

	// ── Particle Sphere state ───────────────────────
	static #particleSphereGroup = null;
	static #particleSpherePoints = null;
	static #particleSphereGeometry = null;
	static #particleSphereBaseDirs = null;   // Float32Array — unit vectors (radial directions)
	static #particleSphereOffsets = null;    // Float32Array — current radial displacement per particle
	static #particleSphereVelocity = null;   // Float32Array — radial velocity per particle
	static #particleSphereBinNorm = null;    // Float32Array — normalized 0..1 angle per particle (precomputed)
	static #particleSpherePrevBass = 0;
	static #particleSphereCount = 0;
	static #particleSphereBaseRadius = 4.5;

	// Scratch Three.js vectors reused by hot render loops to avoid per-frame
	// allocations. Always reset/assign before reading; never hold references.
	static #scratchUp = new THREE.Vector3(0, 1, 0);
	static #scratchDir = new THREE.Vector3(0, 1, 0);

	// ── Histogram 3D state ──────────────────────────
	static #histogramGroup = null;
	static #histogramBars = [];       // meshes
	static #histogramHistory = null;   // Float32Array[row][col] ring buffer
	static #histogramRow = 0;
	static #histogramCols = 32;
	static #histogramRows = 10;

	// ── Audio Wave 3D (codesandbox-inspired) ────────
	static #audioWaveGroup = null;
	static #audioWavePoints = null;        // legacy Points (kept for back-compat)
	static #audioWaveGeometry = null;      // legacy BufferGeometry
	static #audioWaveBasePositions = null; // legacy spiral base
	static #audioWaveRotation = 0;
	static #audioWaveMesh = null;          // InstancedMesh of cubes (codesandbox style)
	static #audioWaveMatrix = null;        // scratch THREE.Matrix4
	static #audioWaveColor  = null;        // scratch THREE.Color
	static #audioWaveGridN = 0;            // cubes per side (half is mirrored)

	// ── Headphones 3D state ─────────────────────────
	static #headphonesGroup = null;
	static #headphonesLeftCup = null;
	static #headphonesRightCup = null;
	static #headphonesBand = null;
	static #headphonesWaves = [];   // { mesh, geometry, birthFrame, side }
	static #headphonesFrame = 0;

	// ── Lyric Particles state ───────────────────────
	static #lyricGroup = null;
	static #lyricPoints = null;
	static #lyricGeometry = null;
	static #lyricPositions = null;      // current positions
	static #lyricTargets = null;        // target positions (sphere or text)
	static #lyricVelocities = null;     // particle velocities
	static #lyricCount = 0;
	static #lyricLastText = "";

	// ── Gelatin Shape state ─────────────────────────
	static #gelatinMesh = null;
	static #gelatinGeometry = null;
	static #gelatinBasePositions = null;
	static #gelatinShape = "sphere";  // "cube" | "pyramid" | "sphere"
	static gelatinShape = "sphere";   // public config

	// ── Lyric Particles state ───────────────────────
	// Public config: how many point particles the lyric design renders with.
	// Exposed so the user can trade visual density for performance via the
	// ModalOptions UI. Clamped to [500, 30000] at rebuild time.
	static lyricParticleCount = 10000;
	// Constant-speed linear travel used by the lyric particles — each point
	// moves this many world units toward its target every frame. No spring,
	// no damping, no overshoot.
	static lyricParticleSpeed = 0.18;

	// ── Point Wave (CodeSandbox reference port) ─────
	// A 128×128 grid of points, Z displaced by a sum of two frequency bins
	// (one indexed by |x|, the other by |y|), producing a radially-symmetric
	// sine-wave pattern on a flat plane. Colored by a 4-step intensity
	// gradient in the fragment shader. Additive blending + a slow orbiting
	// camera-pole give it the glowing, flowing look.
	static #pwGroup = null;
	static #pwMesh = null;
	static #pwMaterial = null;
	static #pwGeometry = null;
	static #pwUniforms = null;
	static #pwCameraPole = null;
	static #pwStartTime = 0;

	// ── Dog / Guinea Pig Dancer state ───────────────
	static #dancerGroup = null;
	static #dancerBody = null;
	static #dancerHead = null;
	static #dancerTail = null;
	static #dancerLegs = [];     // array of leg meshes
	static #dancerEars = [];     // array of ear meshes
	static #dancerLastKind = "";
	static #dancerFrame = 0;

	// ── Camera movement modes ───────────────────────
	/** Camera movement mode: "static" | "orbit" | "spiral" | "fly" | "codesandbox" */
	static cameraMode = "static";
	static #cameraFrame = 0;

	// ── Orbit control state ─────────────────────────
	static #isDragging = false;
	static #prevMouseX = 0;
	static #prevMouseY = 0;
	static #orbitAngleX = 0;
	static #orbitAngleY = 0.3;
	static #orbitDistance = 20;

	// Bound listener references for cleanup
	static #onMouseDown = null;
	static #onMouseMove = null;
	static #onMouseUp = null;
	static #onWheel = null;

	// ── Public config ───────────────────────────────
	static autoRotate = true;
	static orbitEnabled = true;

	// ── Lighting config ─────────────────────────────
	static lightingEnabled = true;
	static ambientColor = "#ffffff";
	static ambientIntensity = 0.3;
	static directionalColor = "#ffffff";
	static directionalIntensity = 0.8;
	static directionalX = 5;
	static directionalY = 10;
	static directionalZ = 7;
	/** Material mode for non-shader meshes: "solid" | "wireframe" | "translucent" */
	static materialMode = "solid";

	// ── Liquid Sphere config ─────────────────────────
	/** 0.1 (watery/fast) → 1.0 (thick/slow) */
	static liquidViscosity = 0.6;
	/** 0.1 (subtle) → 1.0 (dramatic displacement) */
	static liquidDensity = 0.5;

	// ═══════════════════════════════════════════════
	//  PUBLIC API
	// ═══════════════════════════════════════════════

	/**
	 * Checks if a design name is a 3D design.
	 * @param {string} name
	 * @returns {boolean}
	 */
	static is3D(name) {
		return name === "3dbars" || name === "3dwaves" || name === "3dsphere"
			|| name === "vertexdistortion" || name === "planeripple"
			|| name === "liquidsphere" || name === "smoketriangle" || name === "recordplayer"
			|| name === "3dsand" || name === "dnahelix" || name === "neontunnel"
			|| name === "particlesphere" || name === "histogram3d" || name === "audiowave3d"
			|| name === "headphones3d" || name === "lyricparticles" || name === "gelatinshape"
			|| name === "dog3d" || name === "guineapig3d" || name === "pointwave";
	}

	/**
	 * Ensures the Three.js renderer and canvas exist, creates if needed.
	 * @param {number} width
	 * @param {number} height
	 */
	static #ensureRenderer(width, height) {
		if (!Visualizer3D.#renderer) {
			Visualizer3D.#canvas = document.createElement("canvas");
			Visualizer3D.#canvas.id = "three-canvas";
			Visualizer3D.#canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:3;pointer-events:none;";
			document.body.appendChild(Visualizer3D.#canvas);

			Visualizer3D.#renderer = new THREE.WebGLRenderer({
				canvas: Visualizer3D.#canvas,
				alpha: true,
				antialias: true
			});
			Visualizer3D.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			Visualizer3D.#renderer.setClearColor(0x000000, 0);
		}
		Visualizer3D.#renderer.setSize(width, height);
	}

	/**
	 * Activates the 3D renderer for a specific design.
	 * @param {string} design - "3dbars", "3dwaves", or "3dsphere"
	 * @param {number} width
	 * @param {number} height
	 */
	static activate(design, width, height) {
		Visualizer3D.#ensureRenderer(width, height);

		// Clean previous scene
		if (Visualizer3D.#scene) Visualizer3D.#disposeScene();

		Visualizer3D.#scene = new THREE.Scene();
		Visualizer3D.#camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

		// Ambient light (configurable)
		Visualizer3D.#ambientLight = new THREE.AmbientLight(
			new THREE.Color(Visualizer3D.ambientColor),
			Visualizer3D.lightingEnabled ? Visualizer3D.ambientIntensity : 0
		);
		Visualizer3D.#scene.add(Visualizer3D.#ambientLight);

		// Directional light (configurable)
		Visualizer3D.#directionalLight = new THREE.DirectionalLight(
			new THREE.Color(Visualizer3D.directionalColor),
			Visualizer3D.lightingEnabled ? Visualizer3D.directionalIntensity : 0
		);
		Visualizer3D.#directionalLight.position.set(
			Visualizer3D.directionalX,
			Visualizer3D.directionalY,
			Visualizer3D.directionalZ
		);
		Visualizer3D.#scene.add(Visualizer3D.#directionalLight);

		Visualizer3D.#currentDesign = design;

		// Set design-specific orbit defaults
		if (design === "3dbars") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.6;
			Visualizer3D.#orbitDistance = 22;
		} else if (design === "3dwaves") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.0;
			Visualizer3D.#orbitDistance = 12;
		} else if (design === "3dsphere") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.2;
			Visualizer3D.#orbitDistance = 12;
		} else if (design === "vertexdistortion") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.2;
			Visualizer3D.#orbitDistance = 14;
		} else if (design === "planeripple") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.65;
			Visualizer3D.#orbitDistance = 26;
		} else if (design === "liquidsphere") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.15;
			Visualizer3D.#orbitDistance = 11;
		} else if (design === "smoketriangle") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.3;
			Visualizer3D.#orbitDistance = 22;
		} else if (design === "recordplayer") {
			Visualizer3D.#orbitAngleX = 0.4;
			Visualizer3D.#orbitAngleY = 0.55;
			Visualizer3D.#orbitDistance = 19;
		} else if (design === "3dsand") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.75;
			Visualizer3D.#orbitDistance = 20;
		} else if (design === "dnahelix") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.15;
			Visualizer3D.#orbitDistance = 18;
		} else if (design === "neontunnel") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0;
			Visualizer3D.#orbitDistance = 2;
		} else if (design === "particlesphere") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.1;
			Visualizer3D.#orbitDistance = 14;
		} else if (design === "histogram3d") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.55;
			Visualizer3D.#orbitDistance = 20;
		} else if (design === "audiowave3d") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.35;
			Visualizer3D.#orbitDistance = 14;
		} else if (design === "headphones3d") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.15;
			Visualizer3D.#orbitDistance = 17;
		} else if (design === "lyricparticles") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.1;
			Visualizer3D.#orbitDistance = 14;
		} else if (design === "gelatinshape") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.2;
			Visualizer3D.#orbitDistance = 13;
		} else if (design === "dog3d" || design === "guineapig3d") {
			Visualizer3D.#orbitAngleX = 0;
			Visualizer3D.#orbitAngleY = 0.15;
			Visualizer3D.#orbitDistance = 14;
		}

		if (design === "3dbars") Visualizer3D.#setupBars();
		else if (design === "3dwaves") Visualizer3D.#setupWaves();
		else if (design === "3dsphere") Visualizer3D.#setupSphere();
		else if (design === "vertexdistortion") Visualizer3D.#setupVertexDistortion();
		else if (design === "planeripple") Visualizer3D.#setupPlaneRipple();
		else if (design === "liquidsphere") Visualizer3D.#setupLiquidSphere();
		else if (design === "smoketriangle") Visualizer3D.#setupSmokeTriangle();
		else if (design === "recordplayer") Visualizer3D.#setupRecordPlayer();
		else if (design === "3dsand") Visualizer3D.#setupSand();
		else if (design === "dnahelix") Visualizer3D.#setupDnaHelix();
		else if (design === "neontunnel") Visualizer3D.#setupNeonTunnel();
		else if (design === "particlesphere") Visualizer3D.#setupParticleSphere();
		else if (design === "histogram3d") Visualizer3D.#setupHistogram3D();
		else if (design === "audiowave3d") Visualizer3D.#setupAudioWave3D();
		else if (design === "headphones3d") Visualizer3D.#setupHeadphones3D();
		else if (design === "lyricparticles") Visualizer3D.#setupLyricParticles();
		else if (design === "gelatinshape") Visualizer3D.#setupGelatinShape();
		else if (design === "dog3d") Visualizer3D.#setupDancer("dog");
		else if (design === "guineapig3d") Visualizer3D.#setupDancer("guineapig");
		else if (design === "pointwave") Visualizer3D.#setupPointWave();

		// Apply current material mode to newly created meshes
		Visualizer3D.setMaterialMode(Visualizer3D.materialMode);

		Visualizer3D.#active = true;
		if (Visualizer3D.#canvas) {
			Visualizer3D.#canvas.style.display = "";
		}

		Visualizer3D.#attachMouseListeners();
	}

	/**
	 * Deactivates and hides the 3D renderer.
	 */
	static deactivate() {
		Visualizer3D.#active = false;
		Visualizer3D.#detachMouseListeners();
		if (Visualizer3D.#canvas) {
			Visualizer3D.#canvas.style.display = "none";
		}
	}

	/**
	 * Whether the 3D renderer is currently active.
	 */
	static get isActive() {
		return Visualizer3D.#active;
	}

	/**
	 * The currently active 3D design name.
	 */
	static get currentDesign() {
		return Visualizer3D.#currentDesign;
	}

	/**
	 * Updates scene lights to match the current lighting config fields.
	 * Call after modifying any static lighting property (color, intensity, position).
	 */
	static updateLighting() {
		if (Visualizer3D.#ambientLight) {
			Visualizer3D.#ambientLight.visible = Visualizer3D.lightingEnabled;
			Visualizer3D.#ambientLight.color.set(Visualizer3D.ambientColor);
			Visualizer3D.#ambientLight.intensity = Visualizer3D.ambientIntensity;
		}
		if (Visualizer3D.#directionalLight) {
			Visualizer3D.#directionalLight.visible = Visualizer3D.lightingEnabled;
			Visualizer3D.#directionalLight.color.set(Visualizer3D.directionalColor);
			Visualizer3D.#directionalLight.intensity = Visualizer3D.directionalIntensity;
			Visualizer3D.#directionalLight.position.set(
				Visualizer3D.directionalX,
				Visualizer3D.directionalY,
				Visualizer3D.directionalZ
			);
		}
	}

	/**
	 * Applies a material rendering mode ("solid" / "wireframe" / "translucent")
	 * to every mesh in the scene. For wireframe mode, each eligible mesh gets a
	 * precomputed LineSegments(WireframeGeometry) overlay instead of the slow
	 * `material.wireframe = true` path. That path forces Three.js to re-extract
	 * a line-index buffer every time the mesh's geometry updates and routes all
	 * draws through GL_LINES (a slow path on modern desktop GPUs — see
	 * WebGLGeometries.getWireframeAttribute). The overlay caches the edge list
	 * once per geometry, so zero per-frame wireframe cost.
	 *
	 * Meshes that mutate their vertex positions every frame (3D Sphere,
	 * Liquid Sphere, Plane Ripple — marked via `userData.animatedGeometry`),
	 * ShaderMaterial meshes, and InstancedMesh still use the classic
	 * `mat.wireframe` flag because precomputing an overlay for them would be
	 * wasteful (constant rebuilds) or incorrect (per-instance transforms lost).
	 *
	 * @param {"solid"|"wireframe"|"translucent"} mode
	 */
	static setMaterialMode(mode) {
		Visualizer3D.materialMode = mode;
		if (!Visualizer3D.#scene) return;
		Visualizer3D.#scene.traverse(function (obj) {
			if (!obj.isMesh) return;
			// Never touch the wireframe overlays themselves (they are added as
			// children of meshes as LineSegments, but .isMesh is false so this
			// guard is technically redundant — kept for clarity).
			if (obj.userData && obj.userData.isWireframeOverlay) return;

			let mats = Array.isArray(obj.material) ? obj.material : [obj.material];

			// Eligibility for the fast overlay path: must be a plain Mesh (not
			// InstancedMesh / SkinnedMesh), must not use ShaderMaterial, and
			// must not animate its vertex buffer every frame.
			let useOverlay =
				(mode === "wireframe") &&
				!obj.isInstancedMesh &&
				!obj.isSkinnedMesh &&
				!(obj.userData && obj.userData.animatedGeometry) &&
				!(mats[0] && mats[0].isShaderMaterial);

			mats.forEach(function (mat) {
				if (!mat) return;

				if (useOverlay) {
					// Suppress solid rendering but KEEP depth writes so the
					// overlay lines are occluded by nearer geometry naturally.
					// Save the original color-write flag so we can restore it.
					if (mat.userData.origColorWrite === undefined) {
						mat.userData.origColorWrite = mat.colorWrite !== false;
					}
					mat.colorWrite = false;
					mat.wireframe = false;
				} else {
					// Restore color writing if we previously suppressed it.
					if (mat.userData.origColorWrite !== undefined) {
						mat.colorWrite = mat.userData.origColorWrite;
						delete mat.userData.origColorWrite;
					}
					// Classic wireframe flag path (used for shader/instanced/animated meshes).
					mat.wireframe = (mode === "wireframe");
				}

				if (!mat.isShaderMaterial) {
					if (mode === "translucent") {
						mat.transparent = true;
						mat.opacity = 0.35;
					} else if (mode === "solid") {
						mat.transparent = true;
						mat.opacity = 0.9;
					} else {
						// wireframe — full opacity, no transparency needed
						mat.transparent = false;
						mat.opacity = 1.0;
					}
				}
				mat.needsUpdate = true;
			});

			// Manage the overlay LineSegments child.
			let existing = null;
			for (let c = 0; c < obj.children.length; c++) {
				if (obj.children[c].userData && obj.children[c].userData.isWireframeOverlay) {
					existing = obj.children[c];
					break;
				}
			}

			if (useOverlay) {
				if (!existing) {
					let wireGeo = new THREE.WireframeGeometry(obj.geometry);
					let lineMat = new THREE.LineBasicMaterial({
						color: 0xffffff,
						transparent: true,
						opacity: 0.9,
						depthWrite: false
					});
					// Share the underlying material's Color instance so runtime
					// color mutations (e.g. bars pulsing with bass) propagate to
					// the wireframe overlay for free — no per-frame sync needed.
					if (mats[0] && mats[0].color) {
						lineMat.color = mats[0].color;
					}
					existing = new THREE.LineSegments(wireGeo, lineMat);
					existing.userData.isWireframeOverlay = true;
					obj.add(existing);
				}
				existing.visible = true;
			} else if (existing) {
				existing.visible = false;
			}
		});
	}


	/**
	 * Sets a viewport region so the 3D render is clipped to a specific
	 * area of the canvas. Used by the layout system to position the 3D
	 * visualizer at the component's coordinates.
	 * WebGL viewport y is measured from the bottom of the canvas, so we
	 * flip the y coordinate here.
	 * @param {number} x - Left edge in CSS pixels.
	 * @param {number} y - Top edge in CSS pixels (will be flipped).
	 * @param {number} w - Width in CSS pixels.
	 * @param {number} h - Height in CSS pixels.
	 */
	static setViewport(x, y, w, h) {
		if (!Visualizer3D.#renderer) return;
		let canvas = Visualizer3D.#canvas;
		let canvasH = canvas ? canvas.height / Visualizer3D.#renderer.getPixelRatio() : h;
		let flippedY = canvasH - y - h;
		Visualizer3D.#renderer.setScissorTest(true);
		Visualizer3D.#renderer.setViewport(x, flippedY, w, h);
		Visualizer3D.#renderer.setScissor(x, flippedY, w, h);
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.aspect = w / h;
			Visualizer3D.#camera.updateProjectionMatrix();
		}
	}

	/**
	 * Resets the viewport to cover the full canvas.
	 */
	static clearViewport() {
		if (!Visualizer3D.#renderer || !Visualizer3D.#canvas) return;
		let w = Visualizer3D.#canvas.width / Visualizer3D.#renderer.getPixelRatio();
		let h = Visualizer3D.#canvas.height / Visualizer3D.#renderer.getPixelRatio();
		Visualizer3D.#renderer.setScissorTest(false);
		Visualizer3D.#renderer.setViewport(0, 0, w, h);
		Visualizer3D.#renderer.setScissor(0, 0, w, h);
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.aspect = w / h;
			Visualizer3D.#camera.updateProjectionMatrix();
		}
	}

	/**
	 * Renders one frame of the current 3D design.
	 * @param {Float32Array} dataArray - Frequency data from AnalyserNode.
	 * @param {number} bufferLength - Number of frequency bins.
	 * @param {object} barColor - { r, g, b } color 0-255.
	 * @returns {number} Total energy value.
	 */
	static render(dataArray, bufferLength, barColor) {
		if (!Visualizer3D.#active || !Visualizer3D.#renderer) return 0;

		let tre = 0;
		let toff = 150;

		switch (Visualizer3D.#currentDesign) {
			case "3dbars":
				tre = Visualizer3D.#renderBars(dataArray, bufferLength, barColor, toff);
				break;
			case "3dwaves":
				tre = Visualizer3D.#renderWaves(dataArray, bufferLength, barColor, toff);
				break;
			case "3dsphere":
				tre = Visualizer3D.#renderSphere(dataArray, bufferLength, barColor, toff);
				break;
			case "vertexdistortion":
				tre = Visualizer3D.#renderVertexDistortion(dataArray, bufferLength, barColor, toff);
				break;
			case "planeripple":
				tre = Visualizer3D.#renderPlaneRipple(dataArray, bufferLength, barColor, toff);
				break;
			case "liquidsphere":
				tre = Visualizer3D.#renderLiquidSphere(dataArray, bufferLength, barColor, toff);
				break;
			case "smoketriangle":
				tre = Visualizer3D.#renderSmokeTriangle(dataArray, bufferLength, barColor, toff);
				break;
			case "recordplayer":
				tre = Visualizer3D.#renderRecordPlayer(dataArray, bufferLength, barColor, toff);
				break;
			case "3dsand":
				tre = Visualizer3D.#renderSand(dataArray, bufferLength, barColor, toff);
				break;
			case "dnahelix":
				tre = Visualizer3D.#renderDnaHelix(dataArray, bufferLength, barColor, toff);
				break;
			case "neontunnel":
				tre = Visualizer3D.#renderNeonTunnel(dataArray, bufferLength, barColor, toff);
				break;
			case "particlesphere":
				tre = Visualizer3D.#renderParticleSphere(dataArray, bufferLength, barColor, toff);
				break;
			case "histogram3d":
				tre = Visualizer3D.#renderHistogram3D(dataArray, bufferLength, barColor, toff);
				break;
			case "audiowave3d":
				tre = Visualizer3D.#renderAudioWave3D(dataArray, bufferLength, barColor, toff);
				break;
			case "headphones3d":
				tre = Visualizer3D.#renderHeadphones3D(dataArray, bufferLength, barColor, toff);
				break;
			case "lyricparticles":
				tre = Visualizer3D.#renderLyricParticles(dataArray, bufferLength, barColor, toff);
				break;
			case "gelatinshape":
				tre = Visualizer3D.#renderGelatinShape(dataArray, bufferLength, barColor, toff);
				break;
			case "dog3d":
				tre = Visualizer3D.#renderDancer(dataArray, bufferLength, barColor, toff, "dog");
				break;
			case "guineapig3d":
				tre = Visualizer3D.#renderDancer(dataArray, bufferLength, barColor, toff, "guineapig");
				break;
			case "pointwave":
				tre = Visualizer3D.#renderPointWave(dataArray, bufferLength, barColor, toff);
				break;
		}

		Visualizer3D.#applyCameraMovement();
		Visualizer3D.#updateOrbit();
		Visualizer3D.#renderer.render(Visualizer3D.#scene, Visualizer3D.#camera);
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  3D BARS — Grid of frequency-driven bars
	// ═══════════════════════════════════════════════

	static #setupBars() {
		Visualizer3D.#barGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#barGroup);
		Visualizer3D.#barMeshes = [];

		let cols = 16;
		let rows = 8;
		let spacingX = 1.0;
		let spacingZ = 1.0;
		let geo = new THREE.BoxGeometry(0.2, 1, 0.2);

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				let mat = new THREE.MeshPhongMaterial({
					color: 0xffffff,
					emissive: 0x000000,
					transparent: true,
					opacity: 0.9
				});
				let mesh = new THREE.Mesh(geo, mat);
				mesh.position.x = (col - (cols - 1) / 2) * spacingX;
				mesh.position.z = (row - (rows - 1) / 2) * spacingZ;
				mesh.position.y = 0;
				Visualizer3D.#barGroup.add(mesh);
				Visualizer3D.#barMeshes.push(mesh);
			}
		}
	}

	static #renderBars(dataArray, bufferLength, barColor, toff) {
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let cols = 16;
		let rows = 8;
		let totalBars = cols * rows;

		for (let i = 0; i < totalBars; i++) {
			// Map bar index to a frequency bin (row-major order)
			let freqIdx = Math.min(bufferLength - 1, Math.floor((i / totalBars) * bufferLength));
			let val = Math.max(0, dataArray[freqIdx] + toff);
			tre += val;

			let height = (val / 300) * 12;
			if (height < 0.05) height = 0.05;

			let mesh = Visualizer3D.#barMeshes[i];
			mesh.scale.y = height;
			mesh.position.y = height / 2;

			let intensity = Math.min(1, val / 200);
			mesh.material.emissive.setRGB(r * intensity * 0.6, g * intensity * 0.6, b * intensity * 0.6);
			mesh.material.color.setRGB(
				r * (0.4 + intensity * 0.6),
				g * (0.4 + intensity * 0.6),
				b * (0.4 + intensity * 0.6)
			);
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  3D WAVES — Morphing wireframe icosahedron
	// ═══════════════════════════════════════════════

	static #setupWaves() {
		let geometry = new THREE.IcosahedronGeometry(4, 20);

		let vertexShader = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float pnoise(vec3 P, vec3 rep) {
  vec3 Pi0 = mod(floor(P), rep);
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

uniform float u_frequency;
uniform float u_time;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vDisp;

void main() {
  float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
  float displacement = (u_frequency / 30.0) * (noise / 10.0);
  vec3 newPosition = position + normal * displacement;
  vDisp = displacement;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(newPosition, 1.0);
  vViewPosition = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

		// Fragment shader: Phong-like lighting driven by the SCENE'S actual lights
		// (ambient + directional + optional rim) so user-controlled lighting settings
		// take effect here too. Scene uniforms (u_ambientColor, u_dirColor, u_dirDir)
		// are updated per-frame from the actual AmbientLight / DirectionalLight.
		let fragmentShader = `
uniform float u_red;
uniform float u_green;
uniform float u_blue;
uniform float u_frequency;

// Scene-light uniforms (driven by AmbientLight + DirectionalLight)
uniform vec3  u_ambientColor;
uniform vec3  u_dirColor;
uniform vec3  u_dirDir;       // world-space direction from surface toward light
uniform float u_dirEnabled;   // 1.0 if directional light is on, 0.0 otherwise

varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  vec3 baseColor = vec3(u_red, u_green, u_blue);

  // Transform world-space directional-light vector into view space so it aligns
  // with the view-space normal (vNormal = normalMatrix * normal).
  vec3 L = normalize((viewMatrix * vec4(u_dirDir, 0.0)).xyz);

  float d1  = max(dot(N, L), 0.0) * u_dirEnabled;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);

  // Specular (Blinn–Phong) from the directional light
  vec3  H    = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0) * 0.7 * u_dirEnabled;

  // Displacement glow: crests (high |vDisp|) get a freq-tied emissive boost
  float crest = clamp(abs(vDisp) * 2.5, 0.0, 1.0);
  float audio = clamp(u_frequency / 180.0, 0.0, 1.0);
  vec3  emissive = baseColor * crest * (0.35 + audio * 0.8);

  // Ambient comes from the scene's AmbientLight; directional modulates baseColor.
  vec3 ambient  = baseColor * u_ambientColor;
  vec3 diffuse  = baseColor * u_dirColor * d1;
  vec3 specular = u_dirColor * spec;

  vec3 color = ambient + diffuse + specular + baseColor * rim * 0.45 + emissive;
  gl_FragColor = vec4(color, 1.0);
}
`;

		let material = new THREE.ShaderMaterial({
			uniforms: {
				u_time: { value: 0.0 },
				u_frequency: { value: 0.0 },
				u_red: { value: 1.0 },
				u_green: { value: 0.0 },
				u_blue: { value: 0.4 },
				u_ambientColor: { value: new THREE.Vector3(1, 1, 1) },
				u_dirColor: { value: new THREE.Vector3(1, 1, 1) },
				u_dirDir: { value: new THREE.Vector3(0.5, 0.8, 0.6) },
				u_dirEnabled: { value: 1.0 }
			},
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			// Solid material per user request — the Phong-like fragment shader
			// handles shading so the surface reads as a real 3D object.
			wireframe: false
		});

		Visualizer3D.#waveMesh = new THREE.Mesh(geometry, material);
		Visualizer3D.#scene.add(Visualizer3D.#waveMesh);
	}

	static #renderWaves(dataArray, bufferLength, barColor, toff) {
		let tre = 0;
		if (!Visualizer3D.#waveMesh) return 0;

		let uniforms = Visualizer3D.#waveMesh.material.uniforms;

		// Compute average frequency energy
		let sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			let val = Math.max(0, dataArray[i] + toff);
			sum += val;
			tre += val;
		}
		let avgFrequency = sum / bufferLength;

		// Update uniforms
		uniforms.u_time.value = performance.now() * 0.001;
		uniforms.u_frequency.value = avgFrequency;
		uniforms.u_red.value = barColor.r / 255;
		uniforms.u_green.value = barColor.g / 255;
		uniforms.u_blue.value = barColor.b / 255;

		Visualizer3D.#pushSceneLightUniforms(uniforms);

		return tre;
	}

	/**
	 * Copies the current scene-light state (AmbientLight + DirectionalLight) into
	 * the given ShaderMaterial uniform bag. Any custom shader that declares the
	 * standard u_ambientColor / u_dirColor / u_dirDir / u_dirEnabled uniforms can
	 * reuse this so it automatically respects the user's Lighting dropdown
	 * (on/off, intensity, color, direction).
	 */
	static #pushSceneLightUniforms(uniforms) {
		if (!uniforms) return;
		let amb = Visualizer3D.#ambientLight;
		let dir = Visualizer3D.#directionalLight;
		let ambOn = amb && amb.visible !== false;
		let dirOn = dir && dir.visible !== false && dir.intensity > 0;
		if (uniforms.u_ambientColor) {
			if (ambOn) {
				uniforms.u_ambientColor.value.set(
					amb.color.r * amb.intensity,
					amb.color.g * amb.intensity,
					amb.color.b * amb.intensity
				);
			} else {
				uniforms.u_ambientColor.value.set(0, 0, 0);
			}
		}
		if (uniforms.u_dirEnabled && uniforms.u_dirColor && uniforms.u_dirDir) {
			if (dirOn) {
				uniforms.u_dirColor.value.set(
					dir.color.r * dir.intensity,
					dir.color.g * dir.intensity,
					dir.color.b * dir.intensity
				);
				// Three.js DirectionalLight points FROM position TO target (default origin);
				// the surface-to-light vector is (position - target), normalized.
				let px = dir.position.x, py = dir.position.y, pz = dir.position.z;
				let tx = dir.target ? dir.target.position.x : 0;
				let ty = dir.target ? dir.target.position.y : 0;
				let tz = dir.target ? dir.target.position.z : 0;
				let dx = px - tx, dy = py - ty, dz = pz - tz;
				let len = Math.hypot(dx, dy, dz) || 1;
				uniforms.u_dirDir.value.set(dx / len, dy / len, dz / len);
				uniforms.u_dirEnabled.value = 1.0;
			} else {
				uniforms.u_dirEnabled.value = 0.0;
			}
		}
	}

	// ═══════════════════════════════════════════════
	//  3D SPHERE — Frequency-deformed smooth sphere
	// ═══════════════════════════════════════════════

	static #setupSphere() {
		Visualizer3D.#sphereGeometry = new THREE.IcosahedronGeometry(4, 30);

		// Store base vertex positions for deformation
		let pos = Visualizer3D.#sphereGeometry.attributes.position;
		Visualizer3D.#sphereBasePositions = new Float32Array(pos.array.length);
		Visualizer3D.#sphereBasePositions.set(pos.array);

		let mat = new THREE.MeshPhongMaterial({
			color: 0xff0064,
			emissive: 0x110008,
			wireframe: true,
			transparent: true,
			opacity: 0.85,
			shininess: 80
		});
		Visualizer3D.#sphereMesh = new THREE.Mesh(Visualizer3D.#sphereGeometry, mat);
		// Marks the geometry as per-frame-animated so wireframe overlay skips it
		// and falls back to the classic material.wireframe path (rebuilding a
		// WireframeGeometry every frame would be wasteful here).
		Visualizer3D.#sphereMesh.userData.animatedGeometry = true;
		Visualizer3D.#scene.add(Visualizer3D.#sphereMesh);

		// Orbiting point light that pulses with bass
		Visualizer3D.#sphereLight = new THREE.PointLight(0xff0064, 1, 30);
		Visualizer3D.#sphereLight.position.set(6, 4, 6);
		Visualizer3D.#scene.add(Visualizer3D.#sphereLight);
	}

	static #renderSphere(dataArray, bufferLength, barColor, toff) {
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let geo = Visualizer3D.#sphereGeometry;
		let base = Visualizer3D.#sphereBasePositions;
		if (!geo || !base) return 0;

		let positions = geo.attributes.position;
		let vertexCount = positions.count;
		let time = performance.now() * 0.001;

		// Calculate bass for overall pulse
		let bassSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(bufferLength * 0.03)));
		for (let i = 0; i < bufferLength; i++) {
			let val = Math.max(0, dataArray[i] + toff);
			if (i < bassBins) bassSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		// Deform sphere vertices based on frequency data
		for (let v = 0; v < vertexCount; v++) {
			let bx = base[v * 3];
			let by = base[v * 3 + 1];
			let bz = base[v * 3 + 2];

			// Spherical coordinates from base vertex
			let theta = Math.atan2(bz, bx); // -PI to PI
			let len = Math.sqrt(bx * bx + by * by + bz * bz);
			let phi = (len > 0) ? Math.acos(Math.max(-1, Math.min(1, by / len))) : 0; // 0 to PI

			// Map theta to a frequency bin index
			let freqIdx = Math.min(bufferLength - 1, Math.floor(((theta + Math.PI) / (Math.PI * 2)) * bufferLength));
			let val = Math.max(0, dataArray[freqIdx] + toff);
			let displacement = (val / 300) * 1.5;

			// Perlin-like noise from simple JS sin/cos combination
			let noise = Math.sin(phi * 6 + time * 2) * Math.cos(theta * 4 + time * 1.5);
			let noiseDisplacement = noise * (val / 300) * 0.5;

			// Normalize vertex direction and push outward
			if (len === 0) len = 1;
			let nx = bx / len;
			let ny = by / len;
			let nz = bz / len;
			let baseRadius = 4; // matches IcosahedronGeometry radius
			let finalRadius = baseRadius + displacement + noiseDisplacement + bass * 0.3;

			positions.setXYZ(v, nx * finalRadius, ny * finalRadius, nz * finalRadius);
		}
		positions.needsUpdate = true;
		geo.computeVertexNormals();

		// Update colors
		Visualizer3D.#sphereMesh.material.color.setRGB(r, g, b);
		Visualizer3D.#sphereMesh.material.emissive.setRGB(r * bass * 0.5, g * bass * 0.5, b * bass * 0.5);

		// Slow auto-rotation of the sphere mesh itself
		Visualizer3D.#sphereMesh.rotation.y += 0.005;
		Visualizer3D.#sphereMesh.rotation.x += 0.002;

		// Orbit the point light and pulse with bass
		if (Visualizer3D.#sphereLight) {
			Visualizer3D.#sphereLight.position.x = Math.cos(time) * 8;
			Visualizer3D.#sphereLight.position.z = Math.sin(time) * 8;
			Visualizer3D.#sphereLight.color.setRGB(r, g, b);
			Visualizer3D.#sphereLight.intensity = 0.5 + bass * 2;
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  ORBIT CONTROLS
	// ═══════════════════════════════════════════════

	/**
	 * Computes camera position from spherical orbit coordinates
	 * and applies it each frame.
	 */
	static #updateOrbit() {
		if (!Visualizer3D.#camera) return;

		// Neon Tunnel uses its own forward-looking camera (the motion is in
		// the rings), so skip the orbit math entirely for that design.
		if (Visualizer3D.#currentDesign === "neontunnel") {
			Visualizer3D.#camera.position.set(0, 0, 6);
			Visualizer3D.#camera.lookAt(0, 0, -10);
			// Subtle immersive sway — applied AFTER lookAt so it sticks
			let t = performance.now() * 0.001;
			Visualizer3D.#camera.rotation.z = Math.sin(t * 0.8) * 0.05;
			return;
		}

		// Auto-rotate when enabled and not dragging
		if (Visualizer3D.autoRotate && !Visualizer3D.#isDragging) {
			Visualizer3D.#orbitAngleX += 0.003;
		}

		let d = Visualizer3D.#orbitDistance;
		let ax = Visualizer3D.#orbitAngleX;
		let ay = Visualizer3D.#orbitAngleY;

		Visualizer3D.#camera.position.x = d * Math.sin(ax) * Math.cos(ay);
		Visualizer3D.#camera.position.y = d * Math.sin(ay);
		Visualizer3D.#camera.position.z = d * Math.cos(ax) * Math.cos(ay);
		Visualizer3D.#camera.lookAt(0, 0, 0);
	}

	/**
	 * Attaches mouse/wheel listeners to document for orbit control.
	 * Uses document so the 3D canvas can stay pointer-events:none,
	 * allowing clicks/keyboard events to pass through to underlying elements.
	 */
	static #attachMouseListeners() {
		// Detach any existing listeners first
		Visualizer3D.#detachMouseListeners();

		Visualizer3D.#onMouseDown = (e) => {
			if (!Visualizer3D.#active) return;
			// Only start tracking left-button drags on the main page area
			// (not inside modals, overlays, or UI controls).
			if (e.button !== 0) return;
			let target = e.target;
			if (target.closest(".modal-overlay, .opt-overlay, .modal-container, button, input, select, textarea, a, label")) return;

			// Flag the drag so that auto-camera motion pauses. Orbit-specific
			// drag math is gated on orbitEnabled inside #onMouseMove, so this
			// flag also acts as a "user is actively interacting" signal.
			Visualizer3D.#isDragging = true;
			Visualizer3D.#prevMouseX = e.clientX;
			Visualizer3D.#prevMouseY = e.clientY;
		};

		Visualizer3D.#onMouseMove = (e) => {
			if (!Visualizer3D.#isDragging || !Visualizer3D.orbitEnabled) return;
			let dx = e.clientX - Visualizer3D.#prevMouseX;
			let dy = e.clientY - Visualizer3D.#prevMouseY;
			Visualizer3D.#prevMouseX = e.clientX;
			Visualizer3D.#prevMouseY = e.clientY;

			Visualizer3D.#orbitAngleX -= dx * 0.005;
			Visualizer3D.#orbitAngleY += dy * 0.005;

			// Clamp vertical angle to avoid flipping
			let limit = Math.PI / 2 - 0.1;
			Visualizer3D.#orbitAngleY = Math.max(-limit, Math.min(limit, Visualizer3D.#orbitAngleY));
		};

		Visualizer3D.#onMouseUp = () => {
			Visualizer3D.#isDragging = false;
		};

		Visualizer3D.#onWheel = (e) => {
			if (!Visualizer3D.#active || !Visualizer3D.orbitEnabled) return;
			// Only capture scroll on the main visualizer area, not inside modals/UI
			let target = e.target;
			if (target.closest(".modal-overlay, .opt-overlay, .modal-container")) return;

			e.preventDefault();
			Visualizer3D.#orbitDistance += e.deltaY * 0.02;
			Visualizer3D.#orbitDistance = Math.max(5, Math.min(50, Visualizer3D.#orbitDistance));
		};

		document.addEventListener("mousedown", Visualizer3D.#onMouseDown);
		document.addEventListener("mousemove", Visualizer3D.#onMouseMove);
		document.addEventListener("mouseup", Visualizer3D.#onMouseUp);
		document.addEventListener("wheel", Visualizer3D.#onWheel, { passive: false });
	}

	/**
	 * Removes all mouse/wheel listeners from document.
	 */
	static #detachMouseListeners() {
		if (Visualizer3D.#onMouseDown) {
			document.removeEventListener("mousedown", Visualizer3D.#onMouseDown);
			Visualizer3D.#onMouseDown = null;
		}
		if (Visualizer3D.#onMouseMove) {
			document.removeEventListener("mousemove", Visualizer3D.#onMouseMove);
			Visualizer3D.#onMouseMove = null;
		}
		if (Visualizer3D.#onMouseUp) {
			document.removeEventListener("mouseup", Visualizer3D.#onMouseUp);
			Visualizer3D.#onMouseUp = null;
		}
		if (Visualizer3D.#onWheel) {
			document.removeEventListener("wheel", Visualizer3D.#onWheel);
			Visualizer3D.#onWheel = null;
		}

		Visualizer3D.#isDragging = false;
	}

	// ═══════════════════════════════════════════════
	//  CLEANUP
	// ═══════════════════════════════════════════════

	static #disposeScene() {
		if (!Visualizer3D.#scene) return;
		Visualizer3D.#scene.traverse(obj => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
				else obj.material.dispose();
			}
		});
		while (Visualizer3D.#scene.children.length > 0) {
			Visualizer3D.#scene.remove(Visualizer3D.#scene.children[0]);
		}
		Visualizer3D.#barMeshes = [];
		Visualizer3D.#barGroup = null;
		Visualizer3D.#waveMesh = null;
		Visualizer3D.#sphereMesh = null;
		Visualizer3D.#sphereGeometry = null;
		Visualizer3D.#sphereBasePositions = null;
		Visualizer3D.#sphereLight = null;
		Visualizer3D.#ambientLight = null;
		Visualizer3D.#directionalLight = null;
		Visualizer3D.#vdMesh = null;
		Visualizer3D.#rippleMesh = null;
		Visualizer3D.#rippleGeometry = null;
		Visualizer3D.#rippleBasePositions = null;
		Visualizer3D.#rippleWaveA = null;
		Visualizer3D.#rippleWaveB = null;
		Visualizer3D.#rippleGridN = 0;
		if (Visualizer3D.#rippleTexture) {
			Visualizer3D.#rippleTexture.dispose();
			Visualizer3D.#rippleTexture = null;
		}
		Visualizer3D.#liquidMesh = null;
		Visualizer3D.#liquidGeometry = null;
		Visualizer3D.#liquidBasePositions = null;
		Visualizer3D.#smokeTriangles = [];
		Visualizer3D.#smokeParticleData = [];
		Visualizer3D.#smokeParticleGeo = null;
		Visualizer3D.#smokeGroup = null;
		Visualizer3D.#recordGroup = null;
		Visualizer3D.#recordDisc = null;
		Visualizer3D.#recordArm = null;
		Visualizer3D.#recordLabel = null;
		Visualizer3D.#waveformPoints = null;
		Visualizer3D.#recordGrooves = null;
		Visualizer3D.#recordBarGroup = null;
		Visualizer3D.#recordBars = [];
		Visualizer3D.#recordNeedle = null;
		Visualizer3D.#recordLogoMesh = null;
		Visualizer3D.#sandGroup = null;
		Visualizer3D.#sandGeometry = null;
		Visualizer3D.#sandMaterial = null;
		Visualizer3D.#sandPoints = null;
		Visualizer3D.#sandPlane = null;
		Visualizer3D.#sandPositions = null;
		Visualizer3D.#sandBase = null;
		Visualizer3D.#dnaGroup = null;
		Visualizer3D.#dnaStrandA = null;
		Visualizer3D.#dnaStrandB = null;
		Visualizer3D.#dnaStrandAGeo = null;
		Visualizer3D.#dnaStrandBGeo = null;
		Visualizer3D.#dnaRungGroup = null;
		Visualizer3D.#dnaRungs = [];
		Visualizer3D.#tunnelGroup = null;
		Visualizer3D.#tunnelRings = [];
		Visualizer3D.#particleSphereGroup = null;
		Visualizer3D.#particleSpherePoints = null;
		Visualizer3D.#particleSphereGeometry = null;
		Visualizer3D.#particleSphereBaseDirs = null;
		Visualizer3D.#particleSphereBinNorm = null;
		Visualizer3D.#particleSphereOffsets = null;
		Visualizer3D.#particleSphereVelocity = null;
		Visualizer3D.#histogramGroup = null;
		Visualizer3D.#histogramBars = [];
		Visualizer3D.#histogramHistory = null;
		Visualizer3D.#histogramRow = 0;
		Visualizer3D.#audioWaveGroup = null;
		Visualizer3D.#audioWavePoints = null;
		Visualizer3D.#audioWaveGeometry = null;
		Visualizer3D.#audioWaveBasePositions = null;
		Visualizer3D.#audioWaveMesh = null;
		Visualizer3D.#audioWaveMatrix = null;
		Visualizer3D.#audioWaveColor = null;
		Visualizer3D.#audioWaveGridN = 0;
		Visualizer3D.#headphonesGroup = null;
		Visualizer3D.#headphonesLeftCup = null;
		Visualizer3D.#headphonesRightCup = null;
		Visualizer3D.#headphonesBand = null;
		Visualizer3D.#headphonesWaves = [];
		Visualizer3D.#headphonesFrame = 0;
		Visualizer3D.#lyricGroup = null;
		Visualizer3D.#lyricPoints = null;
		Visualizer3D.#lyricGeometry = null;
		Visualizer3D.#lyricPositions = null;
		Visualizer3D.#lyricTargets = null;
		Visualizer3D.#lyricVelocities = null;
		Visualizer3D.#lyricLastText = "";
		Visualizer3D.#gelatinMesh = null;
		Visualizer3D.#gelatinGeometry = null;
		Visualizer3D.#gelatinBasePositions = null;
		Visualizer3D.#dancerGroup = null;
		Visualizer3D.#dancerBody = null;
		Visualizer3D.#dancerHead = null;
		Visualizer3D.#dancerTail = null;
		Visualizer3D.#dancerLegs = [];
		Visualizer3D.#dancerEars = [];
		Visualizer3D.#dancerFrame = 0;
		Visualizer3D.#pwGroup = null;
		Visualizer3D.#pwMesh = null;
		Visualizer3D.#pwMaterial = null;
		Visualizer3D.#pwGeometry = null;
		Visualizer3D.#pwUniforms = null;
		Visualizer3D.#pwCameraPole = null;
	}

	// ═══════════════════════════════════════════════
	//  VERTEX DISTORTION — Fresnel-glow noise blob
	// ═══════════════════════════════════════════════

	static #setupVertexDistortion() {
		let geo = new THREE.IcosahedronGeometry(5, 8);

		// Compact Perlin noise (same algorithm as 3D Waves)
		let pn = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.-15.)+10.);}
float pnoise(vec3 P,vec3 rep){
  vec3 Pi0=mod(floor(P),rep),Pi1=mod(Pi0+1.,rep);
  Pi0=mod289(Pi0);Pi1=mod289(Pi1);
  vec3 Pf0=fract(P),Pf1=Pf0-1.;
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x),iy=vec4(Pi0.yy,Pi1.yy);
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+Pi0.zzzz),ixy1=permute(ixy+Pi1.zzzz);
  vec4 gx0=ixy0*(1./7.),gy0=fract(floor(gx0)*(1./7.))-.5;gx0=fract(gx0);
  vec4 gz0=vec4(.5)-abs(gx0)-abs(gy0),sz0=step(gz0,vec4(0.));
  gx0-=sz0*(step(0.,gx0)-.5);gy0-=sz0*(step(0.,gy0)-.5);
  vec4 gx1=ixy1*(1./7.),gy1=fract(floor(gx1)*(1./7.))-.5;gx1=fract(gx1);
  vec4 gz1=vec4(.5)-abs(gx1)-abs(gy1),sz1=step(gz1,vec4(0.));
  gx1-=sz1*(step(0.,gx1)-.5);gy1-=sz1*(step(0.,gy1)-.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 n0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=n0.x;g010*=n0.y;g100*=n0.z;g110*=n0.w;
  vec4 n1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=n1.x;g011*=n1.y;g101*=n1.z;g111*=n1.w;
  vec3 fxyz=fade(Pf0);
  vec4 nz=mix(vec4(dot(g000,Pf0),dot(g100,vec3(Pf1.x,Pf0.yz)),dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),dot(g110,vec3(Pf1.xy,Pf0.z))),
              vec4(dot(g001,vec3(Pf0.xy,Pf1.z)),dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)),dot(g011,vec3(Pf0.x,Pf1.yz)),dot(g111,Pf1)),fxyz.z);
  vec2 nyz=mix(nz.xy,nz.zw,fxyz.y);
  return 2.2*mix(nyz.x,nyz.y,fxyz.x);
}`;

		let vertexShader = pn + `
uniform float u_frequency;
uniform float u_time;
varying float v_disp;
varying vec3  v_norm;
varying vec3  v_vpos;
void main(){
  float noise = 3.0 * pnoise(position * 0.8 + u_time * 0.55, vec3(10.));
  float d = (u_frequency / 22.) * (noise / 7.);
  v_disp = d;
  vec3 np = position + normal * d;
  vec4 mv = modelViewMatrix * vec4(np, 1.0);
  v_norm = normalMatrix * normal;
  v_vpos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

		let fragmentShader = `
uniform float u_red; uniform float u_green; uniform float u_blue;
uniform vec3  u_ambientColor;
uniform vec3  u_dirColor;
uniform vec3  u_dirDir;
uniform float u_dirEnabled;
varying float v_disp; varying vec3 v_norm; varying vec3 v_vpos;
void main(){
  vec3 N = normalize(v_norm);
  vec3 V = normalize(-v_vpos);
  vec3 L = normalize((viewMatrix * vec4(u_dirDir, 0.0)).xyz);
  float fresnel = pow(1.0 - max(0.,dot(N,V)), 3.0);
  float t = clamp(v_disp * 1.8 + 0.4, 0., 1.);
  vec3 base = vec3(u_red, u_green, u_blue);
  float diff = max(dot(N, L), 0.0) * u_dirEnabled;
  vec3 ambient  = base * u_ambientColor;
  vec3 diffuse  = base * u_dirColor * diff;
  vec3 emissive = base * (0.2 + t * 0.8);
  vec3 col = ambient + diffuse + emissive + fresnel * 0.85 * base;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.0);
}`;

		let mat = new THREE.ShaderMaterial({
			uniforms: {
				u_time:      { value: 0.0 },
				u_frequency: { value: 0.0 },
				u_red:       { value: 1.0 },
				u_green:     { value: 0.4 },
				u_blue:      { value: 1.0 },
				u_ambientColor: { value: new THREE.Vector3(1, 1, 1) },
				u_dirColor:     { value: new THREE.Vector3(1, 1, 1) },
				u_dirDir:       { value: new THREE.Vector3(0.5, 0.8, 0.6) },
				u_dirEnabled:   { value: 1.0 }
			},
			vertexShader,
			fragmentShader,
			wireframe: false
		});

		Visualizer3D.#vdMesh = new THREE.Mesh(geo, mat);
		Visualizer3D.#scene.add(Visualizer3D.#vdMesh);
	}

	static #renderVertexDistortion(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#vdMesh) return 0;
		let tre = 0, sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			sum += v; tre += v;
		}
		let u = Visualizer3D.#vdMesh.material.uniforms;
		u.u_time.value      = performance.now() * 0.001;
		u.u_frequency.value = sum / bufferLength;
		u.u_red.value       = barColor.r / 255;
		u.u_green.value     = barColor.g / 255;
		u.u_blue.value      = barColor.b / 255;
		Visualizer3D.#pushSceneLightUniforms(u);
		Visualizer3D.#vdMesh.rotation.y += 0.004;
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  PLANE RIPPLE — Horizontal mesh wave displacement
	// ═══════════════════════════════════════════════

	static #setupPlaneRipple() {
		// Grid resolution must match PlaneGeometry segment count so we can map
		// grid[i,j] → vertex[j*(N+1)+i] directly without interpolation.
		// Dropped from 80 → 64: reduces vertex count by ~37% with barely any
		// visual impact on the ripple simulation, and eliminates the edge-on
		// fill-rate storm that made this design lag when the camera was
		// coplanar with the water surface.
		let N = 64;
		Visualizer3D.#rippleGridN = N;
		Visualizer3D.#rippleGeometry = new THREE.PlaneGeometry(30, 30, N, N);
		let pos = Visualizer3D.#rippleGeometry.attributes.position;
		Visualizer3D.#rippleBasePositions = new Float32Array(pos.array.length);
		Visualizer3D.#rippleBasePositions.set(pos.array);

		// Wave simulation grids — two generations for finite-difference wave eq.
		let total = (N + 1) * (N + 1);
		Visualizer3D.#rippleWaveA = new Float32Array(total);
		Visualizer3D.#rippleWaveB = new Float32Array(total);

		// Procedural water normal/diffuse texture — soft blue gradient + noise so
		// the surface reads as water rather than a flat plastic sheet.
		let texCanvas = document.createElement("canvas");
		texCanvas.width = 256;
		texCanvas.height = 256;
		let tctx = texCanvas.getContext("2d");
		// Base gradient — deep water centre, brighter rim
		let grad = tctx.createRadialGradient(128, 128, 20, 128, 128, 180);
		grad.addColorStop(0, "#1a3a58");
		grad.addColorStop(0.5, "#2366a0");
		grad.addColorStop(1, "#70bfe0");
		tctx.fillStyle = grad;
		tctx.fillRect(0, 0, 256, 256);
		// Stippled foam / caustic flecks for texture
		for (let i = 0; i < 1800; i++) {
			let x = Math.random() * 256, y = Math.random() * 256;
			let a = 0.04 + Math.random() * 0.09;
			tctx.fillStyle = "rgba(220,240,255," + a + ")";
			tctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
		}
		// Soft horizontal bands mimicking light refraction
		for (let band = 0; band < 14; band++) {
			let y = Math.random() * 256;
			let h = 2 + Math.random() * 3;
			tctx.fillStyle = "rgba(180,220,255,0.06)";
			tctx.fillRect(0, y, 256, h);
		}
		let waterTex = new THREE.CanvasTexture(texCanvas);
		waterTex.wrapS = THREE.RepeatWrapping;
		waterTex.wrapT = THREE.RepeatWrapping;
		waterTex.repeat.set(1.4, 1.4);
		Visualizer3D.#rippleTexture = waterTex;

		// Opaque + FrontSide — when the camera is near-coplanar with the
		// plane, edge-on transparent fragments were causing huge overdraw
		// (entire screen ends up alpha-blended). Making the material
		// opaque and single-sided eliminates this perf cliff without
		// meaningfully changing how the water reads.
		let mat = new THREE.MeshPhongMaterial({
			color: 0xffffff,
			emissive: 0x000000,
			shininess: 120,
			specular: 0xaaddff,
			transparent: false,
			opacity: 1.0,
			side: THREE.FrontSide,
			map: waterTex
		});
		Visualizer3D.#rippleMesh = new THREE.Mesh(Visualizer3D.#rippleGeometry, mat);
		Visualizer3D.#rippleMesh.rotation.x = -Math.PI / 2;
		// Marks the geometry as per-frame-animated so wireframe overlay skips it.
		Visualizer3D.#rippleMesh.userData.animatedGeometry = true;
		Visualizer3D.#scene.add(Visualizer3D.#rippleMesh);

		// Legacy fields retained for dispose() safety.
		Visualizer3D.#rippleRings = 60;
		Visualizer3D.#rippleHistory = new Float32Array(Visualizer3D.#rippleRings);
	}

	/**
	 * Plane Ripple — real-time shallow-water simulation.
	 * Uses a finite-difference discretization of the 2D wave equation on an
	 * NxN grid. Bass peaks drop impulses, mid/high frequencies drip droplets
	 * at radii matching their bin index, so the whole plane stays active all
	 * the way to the edges rather than concentrating at the center.
	 */
	static #renderPlaneRipple(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#rippleMesh || !Visualizer3D.#rippleGeometry) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let geo = Visualizer3D.#rippleGeometry;
		let base = Visualizer3D.#rippleBasePositions;
		let positions = geo.attributes.position;
		let N = Visualizer3D.#rippleGridN;
		let w = N + 1;
		let A = Visualizer3D.#rippleWaveA;
		let B = Visualizer3D.#rippleWaveB;

		// Compute per-band energies for sensitivity
		let bassSum = 0, midSum = 0, highSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
			else highSum += v;
		}
		// Tighter norm so ripples feel responsive at moderate volume.
		let bass = Math.min(1.0, bassSum / (bassBins * 95));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 78));
		let high = Math.min(1.0, highSum / ((bufferLength - midEnd) * 55));

		// ── Wave equation step: B_new = 2B - A + c² (∇²B) - damping ──
		// We compute into A (reusing the old buffer), then swap.
		let c2 = 0.22;        // squared propagation speed (Δt=1 units)
		let damp = 0.990;     // per-step damping (waves slowly die down)
		for (let j = 1; j < N; j++) {
			let row = j * w;
			for (let i = 1; i < N; i++) {
				let idx = row + i;
				let lap = B[idx - 1] + B[idx + 1] + B[idx - w] + B[idx + w] - 4 * B[idx];
				let next = (2 * B[idx] - A[idx] + c2 * lap) * damp;
				A[idx] = next;
			}
		}
		// Swap buffers — A is now the new heightfield
		Visualizer3D.#rippleWaveA = B;
		Visualizer3D.#rippleWaveB = A;
		let H = A;

		// ── Inject impulses from audio — across the full plane ──
		// 1. Bass peaks drop a big impulse near the center
		if (bass > 0.18) {
			let cx = Math.floor(w / 2);
			let cy = Math.floor(w / 2);
			let kick = bass * 1.8;
			for (let dj = -2; dj <= 2; dj++) {
				for (let di = -2; di <= 2; di++) {
					let d = di * di + dj * dj;
					if (d > 4) continue;
					let fall = (5 - d) / 5;
					H[(cy + dj) * w + (cx + di)] += kick * fall;
				}
			}
		}
		// 2. Mid-freq droplets at mid-radius random positions
		if (mid > 0.1) {
			let drops = 1 + Math.floor(mid * 4);
			for (let d = 0; d < drops; d++) {
				let ang = Math.random() * Math.PI * 2;
				let rad = 0.25 + Math.random() * 0.45;
				let px = Math.floor(w / 2 + Math.cos(ang) * rad * N * 0.5);
				let py = Math.floor(w / 2 + Math.sin(ang) * rad * N * 0.5);
				if (px > 1 && px < N - 1 && py > 1 && py < N - 1) {
					H[py * w + px] += 0.6 + mid * 1.4;
					H[py * w + (px + 1)] += 0.25;
					H[py * w + (px - 1)] += 0.25;
					H[(py + 1) * w + px] += 0.25;
					H[(py - 1) * w + px] += 0.25;
				}
			}
		}
		// 3. High freqs — fine sparkles near the rim (so effects reach edges)
		if (high > 0.1) {
			let sparkles = 2 + Math.floor(high * 7);
			for (let s = 0; s < sparkles; s++) {
				let ang = Math.random() * Math.PI * 2;
				let rad = 0.58 + Math.random() * 0.35;
				let px = Math.floor(w / 2 + Math.cos(ang) * rad * N * 0.5);
				let py = Math.floor(w / 2 + Math.sin(ang) * rad * N * 0.5);
				if (px >= 0 && px <= N && py >= 0 && py <= N) {
					H[py * w + px] += 0.25 + high * 0.6;
				}
			}
		}
		// 4. Frequency-bin driven impulses distributed radially — each bin
		// affects a ring at its matching radius so the whole plane responds.
		let bins = Math.min(32, bufferLength);
		for (let k = 0; k < bins; k++) {
			let v = (Math.max(0, dataArray[k] + toff)) / 450;
			if (v < 0.04) continue;
			let ring = 0.08 + (k / bins) * 0.85;
			let theta = (performance.now() * 0.0005 + k * 0.91) % (Math.PI * 2);
			let px = Math.floor(w / 2 + Math.cos(theta) * ring * N * 0.5);
			let py = Math.floor(w / 2 + Math.sin(theta) * ring * N * 0.5);
			if (px > 0 && px < N && py > 0 && py < N) {
				H[py * w + px] += v * 0.55;
			}
		}

		// ── Write heightfield into vertex Z positions ──
		// PlaneGeometry vertex order is row-major: v = j*w + i, XY from base.
		// maxH soft-clips so a lucky super-spike doesn't explode the mesh.
		for (let j = 0; j <= N; j++) {
			let row = j * w;
			for (let i = 0; i <= N; i++) {
				let idx = row + i;
				let h = H[idx];
				if (h > 3) h = 3;
				else if (h < -3) h = -3;
				positions.setZ(idx, base[idx * 3 + 2] + h);
			}
		}
		positions.needsUpdate = true;
		// Recompute normals every other frame — lighting artifacts are
		// imperceptible at 30 Hz with this smooth a heightfield, and the
		// halved normal-cost is one of the biggest wins for edge-on perf.
		if (Visualizer3D._rippleFrame === undefined) Visualizer3D._rippleFrame = 0;
		Visualizer3D._rippleFrame++;
		if ((Visualizer3D._rippleFrame & 1) === 0) {
			geo.computeVertexNormals();
		}

		// Color tint — water stays bluish, barColor mixes in as accent
		let m = Visualizer3D.#rippleMesh.material;
		m.color.setRGB(0.55 + r * 0.45, 0.65 + g * 0.35, 0.75 + b * 0.25);
		m.emissive.setRGB(r * bass * 0.25, g * bass * 0.25, b * bass * 0.25);
		// Slow texture scroll — looks like a gentle current
		if (Visualizer3D.#rippleTexture) {
			Visualizer3D.#rippleTexture.offset.x += 0.0003 + bass * 0.001;
			Visualizer3D.#rippleTexture.offset.y += 0.0002 + mid * 0.0008;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  LIQUID SPHERE — Smooth viscous frequency blob
	// ═══════════════════════════════════════════════

	static #setupLiquidSphere() {
		Visualizer3D.#liquidGeometry = new THREE.IcosahedronGeometry(4, 25);
		let pos = Visualizer3D.#liquidGeometry.attributes.position;
		Visualizer3D.#liquidBasePositions = new Float32Array(pos.array.length);
		Visualizer3D.#liquidBasePositions.set(pos.array);

		// Neutral material — color/emissive are driven entirely by barColor at render-time
		let mat = new THREE.MeshPhongMaterial({
			color: 0xffffff, emissive: 0x000000,
			shininess: 160, transparent: true, opacity: 0.88
		});
		Visualizer3D.#liquidMesh = new THREE.Mesh(Visualizer3D.#liquidGeometry, mat);
		// Marks the geometry as per-frame-animated so wireframe overlay skips it.
		Visualizer3D.#liquidMesh.userData.animatedGeometry = true;
		Visualizer3D.#scene.add(Visualizer3D.#liquidMesh);
		// Interior halo removed — it was a static inner sphere that didn't
		// move with the audio and cluttered the silhouette.
		Visualizer3D.#liquidGlowMesh = null;
	}

	static #renderLiquidSphere(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#liquidMesh || !Visualizer3D.#liquidGeometry) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let geo = Visualizer3D.#liquidGeometry;
		let base = Visualizer3D.#liquidBasePositions;
		let positions = geo.attributes.position;
		let time = performance.now() * 0.001;

		let bassSum = 0, midSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midLen   = Math.max(1, Math.floor(bufferLength * 0.12));
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < bassBins + midLen) midSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / (midLen  * 120));

		let flow = (1.1 - Visualizer3D.liquidViscosity) * 2.2;
		let det  = 2.0 + Visualizer3D.liquidDensity * 4.0;

		for (let v = 0; v < positions.count; v++) {
			let bx = base[v * 3], by = base[v * 3 + 1], bz = base[v * 3 + 2];
			let len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
			let theta = Math.atan2(bz, bx);
			let phi   = Math.acos(Math.max(-1, Math.min(1, by / len)));
			let n1 = Math.sin(phi * det + time * flow) * Math.cos(theta * (det + 1) + time * flow * 0.75);
			let n2 = Math.sin(phi * (det + 2) - time * flow * 1.2) * Math.cos(theta * det - time * flow * 0.55);
			let n3 = Math.sin(phi * 2 + theta * 3 + time * flow * 0.3);
			let disp = (bass * 1.6 + mid * 0.9) * Visualizer3D.liquidDensity * (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);
			let rad = 4 + disp;
			positions.setXYZ(v, (bx / len) * rad, (by / len) * rad, (bz / len) * rad);
		}
		positions.needsUpdate = true;
		geo.computeVertexNormals();

		// Color entirely from barColor — no hardcoded hue offset
		Visualizer3D.#liquidMesh.material.color.setRGB(r, g, b);
		Visualizer3D.#liquidMesh.material.emissive.setRGB(r * bass * 0.45, g * bass * 0.45, b * bass * 0.45);
		Visualizer3D.#liquidMesh.material.opacity = 0.72 + bass * 0.22;
		Visualizer3D.#liquidMesh.rotation.y += 0.002;
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  SMOKE TRIANGLE — Triangular prisms + particle smoke
	// ═══════════════════════════════════════════════

	static #setupSmokeTriangle() {
		Visualizer3D.#smokeGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#smokeGroup);
		Visualizer3D.#smokeParticleData = [];

		// Rotate the whole group so the exhaust axis points horizontally
		// (+X direction). The emitter sits at the origin and blows smoke
		// off toward the right side of the viewport like a thruster nozzle.
		Visualizer3D.#smokeGroup.rotation.z = Math.PI / 2;

		// Hollow triangular nozzle — an equilateral prism with a smaller
		// inner triangle subtracted (simulated by a ring-of-triangles shape).
		// We build the "frame" explicitly as 3 long bars connecting the outer
		// and inner triangle vertices — this gives the exhaust-pipe aesthetic
		// without requiring CSG.
		let baseR = 2.4;
		let innerR = 1.5;
		let depth = 0.8;     // length of the nozzle (along the local Y / world X after rotation)
		// Outer / inner triangle vertices (XZ plane, Y along depth axis)
		let verts = [];
		for (let t = 0; t < 3; t++) {
			let a = Math.PI / 2 + t * (Math.PI * 2 / 3);
			verts.push({ ox: Math.cos(a) * baseR, oz: Math.sin(a) * baseR,
			             ix: Math.cos(a) * innerR, iz: Math.sin(a) * innerR });
		}
		// Build a BufferGeometry: front face (hollow ring triangulated with 6 quads),
		// back face, and 3 inner walls.
		let positions = [];
		let indices = [];
		function pushVert(x, y, z) { positions.push(x, y, z); return positions.length / 3 - 1; }
		// Front ring (y = +depth/2): quads between outer[i]/inner[i] and outer[(i+1)%3]/inner[(i+1)%3]
		for (let t = 0; t < 3; t++) {
			let v = verts[t], v2 = verts[(t + 1) % 3];
			let a = pushVert(v.ox, depth / 2, v.oz);
			let b = pushVert(v2.ox, depth / 2, v2.oz);
			let c = pushVert(v2.ix, depth / 2, v2.iz);
			let d = pushVert(v.ix, depth / 2, v.iz);
			indices.push(a, b, c, a, c, d);
		}
		// Back ring (y = -depth/2)
		for (let t = 0; t < 3; t++) {
			let v = verts[t], v2 = verts[(t + 1) % 3];
			let a = pushVert(v.ox, -depth / 2, v.oz);
			let b = pushVert(v.ix, -depth / 2, v.iz);
			let c = pushVert(v2.ix, -depth / 2, v2.iz);
			let d = pushVert(v2.ox, -depth / 2, v2.oz);
			indices.push(a, b, c, a, c, d);
		}
		// Outer wall (3 long quads, one per side)
		for (let t = 0; t < 3; t++) {
			let v = verts[t], v2 = verts[(t + 1) % 3];
			let a = pushVert(v.ox,  depth / 2, v.oz);
			let b = pushVert(v2.ox, depth / 2, v2.oz);
			let c = pushVert(v2.ox, -depth / 2, v2.oz);
			let d = pushVert(v.ox,  -depth / 2, v.oz);
			indices.push(a, b, c, a, c, d);
		}
		// Inner wall (faces inward — smoke appears to come out of these walls)
		for (let t = 0; t < 3; t++) {
			let v = verts[t], v2 = verts[(t + 1) % 3];
			let a = pushVert(v.ix,  depth / 2, v.iz);
			let b = pushVert(v.ix,  -depth / 2, v.iz);
			let c = pushVert(v2.ix, -depth / 2, v2.iz);
			let d = pushVert(v2.ix,  depth / 2, v2.iz);
			indices.push(a, b, c, a, c, d);
		}
		let nozzleGeo = new THREE.BufferGeometry();
		nozzleGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		nozzleGeo.setIndex(indices);
		nozzleGeo.computeVertexNormals();

		let prismMat = new THREE.MeshPhongMaterial({
			color: 0xffffff, emissive: 0x000000,
			shininess: 95, transparent: true, opacity: 0.93,
			side: THREE.DoubleSide
		});
		Visualizer3D.#smokePrism = new THREE.Mesh(nozzleGeo, prismMat);
		Visualizer3D.#smokeGroup.add(Visualizer3D.#smokePrism);

		Visualizer3D.#smokeBaseRadius = baseR;
		Visualizer3D.#smokeInnerRadius = innerR;
		Visualizer3D.#smokeNozzleDepth = depth;
		Visualizer3D.#smokeMaxHeight  = 22;

		// Particle system: ~1800 tiny particles for an actual smoke density
		// without killing frame-time. Smaller size + sizeAttenuation so far
		// particles fade away into the distance.
		let maxP = 1800;
		let pBuf = new Float32Array(maxP * 3).fill(-1000);
		Visualizer3D.#smokeParticleGeo = new THREE.BufferGeometry();
		Visualizer3D.#smokeParticleGeo.setAttribute("position", new THREE.BufferAttribute(pBuf, 3));
		Visualizer3D.#smokeParticleMat = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.12,
			transparent: true,
			opacity: 0.55,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		Visualizer3D.#smokeGroup.add(new THREE.Points(
			Visualizer3D.#smokeParticleGeo, Visualizer3D.#smokeParticleMat
		));

		for (let i = 0; i < maxP; i++) {
			Visualizer3D.#smokeParticleData.push({
				x: 0, y: 0, z: 0,
				vx: 0, vy: 0, vz: 0,
				life: 0, maxLife: 1,
				active: false
			});
		}

		// Sample a point on the INNER wall of the triangular nozzle, at a
		// random altitude along the depth axis. This gives the "exhaust
		// emerging from the walls" aesthetic the user requested.
		Visualizer3D.#smokeSampleTriangle = function (_radius) {
			// Pick one of the 3 inner walls
			let wall = Math.floor(Math.random() * 3);
			let v = verts[wall], v2 = verts[(wall + 1) % 3];
			let t = Math.random();   // position along wall
			let px = v.ix * (1 - t) + v2.ix * t;
			let pz = v.iz * (1 - t) + v2.iz * t;
			// Random position along the depth axis (nozzle length)
			let py = (Math.random() - 0.5) * depth;
			// Inward normal for this wall (points from wall to origin)
			let midX = (v.ix + v2.ix) * 0.5, midZ = (v.iz + v2.iz) * 0.5;
			let nmag = Math.sqrt(midX * midX + midZ * midZ) || 1;
			return {
				x: px, y: py, z: pz,
				nx: -midX / nmag, nz: -midZ / nmag
			};
		};
	}

	static #renderSmokeTriangle(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#smokeGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0, midSum = 0, highSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd   = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
			else highSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 110));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 90));
		let high = Math.min(1.0, highSum / ((bufferLength - midEnd) * 60));

		// Animate the emitter nozzle — subtle hum/pulse so it feels alive.
		// Spinning the nozzle around its exhaust axis (local Y) gives a
		// "turbine" motion without affecting smoke direction.
		let prismRotY = 0;
		if (Visualizer3D.#smokePrism) {
			let m = Visualizer3D.#smokePrism.material;
			m.color.setRGB(r * 0.45 + 0.25, g * 0.45 + 0.25, b * 0.45 + 0.25);
			m.emissive.setRGB(r * bass * 0.9, g * bass * 0.9, b * bass * 0.9);
			Visualizer3D.#smokePrism.rotation.y += 0.006 + bass * 0.02;
			Visualizer3D.#smokePrism.scale.set(1 + bass * 0.08, 1, 1 + bass * 0.08);
			prismRotY = Visualizer3D.#smokePrism.rotation.y;
		}
		// Pre-compute the prism's current rotation sin/cos so spawn positions
		// and inward normals match whatever angle the triangle is at THIS
		// frame — this is what makes the exhaust appear to rotate with the
		// nozzle rather than emerging from a stationary pattern.
		let prismCos = Math.cos(prismRotY);
		let prismSin = Math.sin(prismRotY);

		// Smoke particle lifecycle (in local-group coords; group rotates to
		// blow along world +X).
		let pData = Visualizer3D.#smokeParticleData;
		let pGeo  = Visualizer3D.#smokeParticleGeo;
		if (!pData || !pGeo) return tre;
		let arr = pGeo.attributes.position.array;

		let maxH = Visualizer3D.#smokeMaxHeight;
		// Spawn lots of tiny particles per frame — real smoke looks dense,
		// and the smaller particle size keeps perf reasonable.
		let spawnTarget = Math.floor(14 + bass * 38 + mid * 14);
		let spawned = 0;

		// Wind / jitter driven by audio — gives the exhaust its chaotic
		// turbulent look rather than laminar flow.
		let jitter = 0.003 + high * 0.014;

		for (let i = 0; i < pData.length; i++) {
			let p = pData[i];
			if (p.active) {
				p.x += p.vx;
				p.y += p.vy;
				p.z += p.vz;
				// Gentle taper of velocity on bass dip — engine idle vs thrust
				p.vy *= 0.997;
				// Random turbulence
				p.vx += (Math.random() - 0.5) * jitter;
				p.vz += (Math.random() - 0.5) * jitter;
				p.vx *= 0.988;
				p.vz *= 0.988;
				p.life += 0.022;
				// Particles that travel far along the exhaust axis (local +Y
				// → world +X after group rotation) should slow slightly and
				// spread outward, mimicking exhaust plume diffusion.
				if (p.y > 3) {
					let spread = 0.002 + bass * 0.005;
					p.vx += (p.x - 0) * spread;
					p.vz += (p.z - 0) * spread;
				}
				if (p.life > p.maxLife || p.y > maxH) p.active = false;
				arr[i * 3]     = p.x;
				arr[i * 3 + 1] = p.y;
				arr[i * 3 + 2] = p.z;
			} else if (spawned < spawnTarget) {
				// Spawn from the inner walls of the nozzle, rotated to match
				// the prism's current Y-rotation so particles emerge from
				// the walls IN THEIR CURRENT POSITIONS instead of a fixed
				// pattern. Each particle then gets an initial velocity
				// along the (also-rotated) inward-wall normal plus a large
				// +Y component along the exhaust axis.
				let pt = Visualizer3D.#smokeSampleTriangle(0);
				// Rotate spawn position around local Y by prismRotY
				p.x = pt.x * prismCos + pt.z * prismSin;
				p.z = -pt.x * prismSin + pt.z * prismCos;
				p.y = pt.y;
				// Base exhaust speed — bass drives thrust power
				let thrust = 0.12 + bass * 0.22 + mid * 0.06;
				p.vy = thrust + Math.random() * 0.05;
				// Rotate the inward-wall normal by the same angle so the
				// initial velocity direction also follows the nozzle.
				let rnx = pt.nx * prismCos + pt.nz * prismSin;
				let rnz = -pt.nx * prismSin + pt.nz * prismCos;
				p.vx = rnx * (0.015 + Math.random() * 0.02);
				p.vz = rnz * (0.015 + Math.random() * 0.02);
				p.life = 0;
				// Shorter max life so the plume doesn't clog memory at high
				// spawn rates — particles disappear into the distance.
				p.maxLife = 1.4 + Math.random() * 1.4;
				p.active = true;
				spawned++;
				arr[i * 3]     = p.x;
				arr[i * 3 + 1] = p.y;
				arr[i * 3 + 2] = p.z;
			} else {
				// Park inactive slots far off-screen so they don't render.
				arr[i * 3]     = 0;
				arr[i * 3 + 1] = -1000;
				arr[i * 3 + 2] = 0;
			}
		}
		pGeo.attributes.position.needsUpdate = true;

		// Particle color — slightly desaturated toward barColor, brighter on
		// bass for that "hot exhaust" glow.
		if (Visualizer3D.#smokeParticleMat) {
			Visualizer3D.#smokeParticleMat.color.setRGB(
				r * 0.7 + 0.3, g * 0.7 + 0.3, b * 0.7 + 0.3
			);
			Visualizer3D.#smokeParticleMat.opacity = 0.45 + bass * 0.3;
			Visualizer3D.#smokeParticleMat.size = 0.10 + bass * 0.03;
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  RECORD PLAYER — Turntable + holographic waveform
	// ═══════════════════════════════════════════════

	static #setupRecordPlayer() {
		Visualizer3D.#recordGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#recordGroup);

		// Wooden turntable base (warmer brown, beveled edges via flat top + thicker body)
		let base = new THREE.Mesh(
			new THREE.BoxGeometry(14, 0.65, 14),
			new THREE.MeshPhongMaterial({ color: 0x3a2518, shininess: 30, specular: 0x221100 })
		);
		base.position.y = -0.35;
		Visualizer3D.#recordGroup.add(base);

		// Darker inset for the deck surface
		let inset = new THREE.Mesh(
			new THREE.BoxGeometry(13.4, 0.08, 13.4),
			new THREE.MeshPhongMaterial({ color: 0x1a1310, shininess: 18 })
		);
		inset.position.y = 0.01;
		Visualizer3D.#recordGroup.add(inset);

		// Metal platter (rubber mat underneath the vinyl)
		let platter = new THREE.Mesh(
			new THREE.CylinderGeometry(5.5, 5.5, 0.22, 64),
			new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 45, specular: 0x444444 })
		);
		platter.position.y = 0.16;
		Visualizer3D.#recordGroup.add(platter);

		// Vinyl disc — slightly thicker, darker
		Visualizer3D.#recordDisc = new THREE.Mesh(
			new THREE.CylinderGeometry(5.1, 5.1, 0.08, 128),
			new THREE.MeshPhongMaterial({ color: 0x050505, shininess: 120, specular: 0x333333, emissive: 0x000000 })
		);
		Visualizer3D.#recordDisc.position.y = 0.31;
		Visualizer3D.#recordGroup.add(Visualizer3D.#recordDisc);

		// Groove rings on top of the disc — thin tori for that "pressed vinyl" look
		Visualizer3D.#recordGrooves = new THREE.Group();
		for (let r = 1.25; r < 5.0; r += 0.15) {
			let tor = new THREE.Mesh(
				new THREE.TorusGeometry(r, 0.01, 3, 96),
				new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 10, transparent: true, opacity: 0.55 })
			);
			tor.rotation.x = Math.PI / 2;
			tor.position.y = 0.36;
			Visualizer3D.#recordGrooves.add(tor);
		}
		Visualizer3D.#recordGroup.add(Visualizer3D.#recordGrooves);

		// Center label (slightly raised, colored)
		Visualizer3D.#recordLabel = new THREE.Mesh(
			new THREE.CylinderGeometry(1.25, 1.25, 0.02, 48),
			new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 50, emissive: 0x000000 })
		);
		Visualizer3D.#recordLabel.position.y = 0.365;
		Visualizer3D.#recordGroup.add(Visualizer3D.#recordLabel);

		// Inner label ring (decorative)
		let labelRing = new THREE.Mesh(
			new THREE.TorusGeometry(0.85, 0.025, 4, 48),
			new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 20 })
		);
		labelRing.rotation.x = Math.PI / 2;
		labelRing.position.y = 0.38;
		Visualizer3D.#recordGroup.add(labelRing);

		// Spindle (chrome)
		let spindle = new THREE.Mesh(
			new THREE.CylinderGeometry(0.08, 0.08, 0.45, 12),
			new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 120, specular: 0xffffff })
		);
		spindle.position.y = 0.58;
		Visualizer3D.#recordGroup.add(spindle);

		// ── Frequency bars on top of the disc ──
		// These are children of #recordDisc so they spin with the vinyl.
		// Arranged in a ring at inner radius 1.8 (outside the label but
		// well inside the disc edge at 5.1).
		Visualizer3D.#recordBarGroup = new THREE.Group();
		Visualizer3D.#recordBarGroup.position.y = 0.04; // sits just on top of the disc face
		Visualizer3D.#recordDisc.add(Visualizer3D.#recordBarGroup);
		Visualizer3D.#recordBars = [];
		let numBars = 48;
		let ringR = 3.6;
		for (let i = 0; i < numBars; i++) {
			let angle = (i / numBars) * Math.PI * 2;
			let geo = new THREE.BoxGeometry(0.16, 1.0, 0.16);
			let mat = new THREE.MeshPhongMaterial({
				color: 0xffffff, emissive: 0x000000, shininess: 90
			});
			let bar = new THREE.Mesh(geo, mat);
			bar.position.set(Math.cos(angle) * ringR, 0.5, Math.sin(angle) * ringR);
			Visualizer3D.#recordBarGroup.add(bar);
			Visualizer3D.#recordBars.push({ mesh: bar, angle: angle });
		}

		// ── Tonearm + stylus ──
		// Pivot placed at (5, 0.85, -6) with a straight arm of length 6.
		// Rotating arm around Y sweeps the needle tip on a circular arc that
		// stays OVER the disc (radius ≤ 5.1). See computed sweep in
		// #renderRecordPlayer: rotation 1.5 rad → tip at outer groove,
		// 0.9 rad → inner groove (just outside the label).
		let armLen = 6.0;
		Visualizer3D.#recordArm = new THREE.Group();
		Visualizer3D.#recordArm.position.set(5.0, 0.85, -6.0);

		// Pivot stand (reaches down to deck)
		let pivotStand = new THREE.Mesh(
			new THREE.CylinderGeometry(0.45, 0.5, 0.85, 16),
			new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 50 })
		);
		pivotStand.position.y = -0.425;
		Visualizer3D.#recordArm.add(pivotStand);

		// Pivot cap (chrome sphere)
		let pivotCap = new THREE.Mesh(
			new THREE.SphereGeometry(0.28, 16, 16),
			new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 120, specular: 0xffffff })
		);
		Visualizer3D.#recordArm.add(pivotCap);

		// Main arm (slim cylinder extending in local -X)
		let armCyl = new THREE.Mesh(
			new THREE.CylinderGeometry(0.06, 0.06, armLen, 10),
			new THREE.MeshPhongMaterial({ color: 0xb8b8c4, shininess: 100, specular: 0xffffff })
		);
		armCyl.rotation.z = Math.PI / 2;
		armCyl.position.x = -armLen / 2;
		Visualizer3D.#recordArm.add(armCyl);

		// Counterweight at +X end
		let weight = new THREE.Mesh(
			new THREE.CylinderGeometry(0.26, 0.26, 0.55, 16),
			new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 40 })
		);
		weight.rotation.z = Math.PI / 2;
		weight.position.x = 0.35;
		Visualizer3D.#recordArm.add(weight);

		// Headshell (flat block holding the cartridge) at the -X end of the arm.
		let headshell = new THREE.Mesh(
			new THREE.BoxGeometry(0.45, 0.18, 0.32),
			new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 35 })
		);
		headshell.position.set(-armLen - 0.12, -0.17, 0);
		Visualizer3D.#recordArm.add(headshell);

		// Stylus/needle — cone whose TIP sits at world y = 0.36 (just above
		// the disc top surface at 0.35). Pivot Y = 0.85. Needle cone height
		// 0.30, flipped to point -Y, centered at local y = -0.34 → tip at
		// local y = -0.49, world y = 0.85 − 0.49 = 0.36. ✓
		let needleH = 0.30;
		Visualizer3D.#recordNeedle = new THREE.Mesh(
			new THREE.ConeGeometry(0.04, needleH, 10),
			new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 120, specular: 0xffffff, emissive: 0x221100 })
		);
		Visualizer3D.#recordNeedle.rotation.x = Math.PI;
		Visualizer3D.#recordNeedle.position.set(-armLen - 0.12, -0.34, 0);
		Visualizer3D.#recordArm.add(Visualizer3D.#recordNeedle);

		Visualizer3D.#recordGroup.add(Visualizer3D.#recordArm);

		// ── Glowing "Virtma" brand plaque on the front of the turntable ──
		// Rendered via CanvasTexture so the glow is baked into the texture
		// and the plaque is self-lit (MeshBasicMaterial ignores scene lights).
		{
			let canvas = document.createElement("canvas");
			canvas.width = 512; canvas.height = 128;
			let cx = canvas.getContext("2d");
			// Dark transparent background so only the text itself glows
			cx.clearRect(0, 0, canvas.width, canvas.height);
			cx.textAlign = "center";
			cx.textBaseline = "middle";
			cx.font = "bold 84px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
			// Multi-pass outer glow
			cx.shadowColor = "rgba(110, 220, 255, 1)";
			cx.shadowBlur = 28;
			cx.fillStyle = "rgba(200, 240, 255, 0.95)";
			cx.fillText("Virtma", canvas.width / 2, canvas.height / 2);
			cx.shadowBlur = 14;
			cx.fillText("Virtma", canvas.width / 2, canvas.height / 2);
			// Core text (crisper)
			cx.shadowBlur = 0;
			cx.fillStyle = "#ffffff";
			cx.fillText("Virtma", canvas.width / 2, canvas.height / 2);

			let tex = new THREE.CanvasTexture(canvas);
			tex.needsUpdate = true;
			tex.anisotropy = 4;

			// Slim 3D slab on the front face of the base
			let plaqueW = 4.6, plaqueH = 1.15, plaqueD = 0.08;
			let plaqueMatBase = new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 30 });
			let plaqueMatGlow = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
			let plaqueGeo = new THREE.BoxGeometry(plaqueW, plaqueH, plaqueD);
			// Face order for BoxGeometry: +x, -x, +y, -y, +z, -z. We'll paint the
			// +Z face (front) with the glowing map and the rest with the dark base.
			let mats = [
				plaqueMatBase, plaqueMatBase,
				plaqueMatBase, plaqueMatBase,
				plaqueMatGlow, plaqueMatBase
			];
			let plaque = new THREE.Mesh(plaqueGeo, mats);
			// Sit on the front face of the base at y slightly above center
			plaque.position.set(0, 0.05, 7.04);
			Visualizer3D.#recordLogoMesh = plaque;
			Visualizer3D.#recordGroup.add(plaque);
		}

		// Subtle holographic waveform ring just outside the disc rim — kept
		// as a small accent now that the main visualization lives ON the disc.
		let ringN = 96, waveR = 6.1;
		let rPos = new Float32Array(ringN * 3);
		for (let i = 0; i < ringN; i++) {
			let a = (i / ringN) * Math.PI * 2;
			rPos[i * 3]     = Math.cos(a) * waveR;
			rPos[i * 3 + 1] = 0.45;
			rPos[i * 3 + 2] = Math.sin(a) * waveR;
		}
		let rGeo = new THREE.BufferGeometry();
		rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
		Visualizer3D.#waveformPoints = new THREE.Points(rGeo,
			new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false })
		);
		Visualizer3D.#recordGroup.add(Visualizer3D.#waveformPoints);
	}

	static #renderRecordPlayer(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#recordGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0, bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 110));

		// Disc spin (≈33⅓ RPM look) — grooves, label, and bar group are all
		// children of the disc, so one rotation spins everything together.
		let spinDelta = 0.022 + bass * 0.03;
		if (Visualizer3D.#recordDisc) Visualizer3D.#recordDisc.rotation.y += spinDelta;
		if (Visualizer3D.#recordGrooves) Visualizer3D.#recordGrooves.rotation.y += spinDelta;

		// Tonearm angle — needle starts at the OUTER groove and travels toward
		// the center as the song plays. With pivot at (5, 0.85, -6) and arm
		// length 6.0, rotation.y=1.5 puts the tip at the outer groove (r≈4.6)
		// and rotation.y=0.9 puts it near the label edge (r≈1.8).
		if (Visualizer3D.#recordArm) {
			let player = document.getElementById("player");
			let progress = (player && isFinite(player.duration) && player.duration > 0)
				? Math.max(0, Math.min(1, player.currentTime / player.duration)) : 0;
			Visualizer3D.#recordArm.rotation.y = 1.5 - progress * 0.6;
		}

		// Needle subtle vibration as it "reads" the grooves
		if (Visualizer3D.#recordNeedle) {
			let wob = (Math.random() - 0.5) * 0.003 * (0.3 + bass);
			Visualizer3D.#recordNeedle.position.x = -6.12 + wob;
		}

		// Label color — full barColor, pulsing on bass
		if (Visualizer3D.#recordLabel) {
			Visualizer3D.#recordLabel.material.color.setRGB(r, g, b);
			Visualizer3D.#recordLabel.material.emissive.setRGB(r * bass * 0.5, g * bass * 0.5, b * bass * 0.5);
		}

		// ── Drive the bar ring sitting on top of the disc ──
		// Each bar = one frequency bin. Bars scale in height with amplitude
		// and their color goes from neutral→barColor as they rise. Because
		// the bars are children of the disc, they spin WITH the vinyl.
		if (Visualizer3D.#recordBars && Visualizer3D.#recordBars.length) {
			let bars = Visualizer3D.#recordBars;
			let n = bars.length;
			for (let i = 0; i < n; i++) {
				let fi = Math.min(bufferLength - 1, Math.floor((i / n) * bufferLength));
				let v = Math.max(0, dataArray[fi] + toff);
				let h = Math.max(0.05, (v / 300) * 2.8);
				let bar = bars[i].mesh;
				bar.scale.y = h;
				bar.position.y = (1.0 * h) / 2; // keep base flush with disc top
				let intensity = Math.min(1, v / 220);
				bar.material.color.setRGB(
					r * (0.3 + intensity * 0.7),
					g * (0.3 + intensity * 0.7),
					b * (0.3 + intensity * 0.7)
				);
				bar.material.emissive.setRGB(
					r * intensity * 0.5,
					g * intensity * 0.5,
					b * intensity * 0.5
				);
			}
		}

		// Waveform ring (subtle accent outside the disc)
		if (Visualizer3D.#waveformPoints) {
			let rPos  = Visualizer3D.#waveformPoints.geometry.attributes.position;
			let ringN = rPos.count;
			let ringR = 6.1;
			for (let i = 0; i < ringN; i++) {
				let a  = (i / ringN) * Math.PI * 2;
				let fi = Math.min(bufferLength - 1, Math.floor((i / ringN) * bufferLength));
				let v  = Math.max(0, dataArray[fi] + toff);
				let d  = (v / 300) * 1.2;
				rPos.setXYZ(i, Math.cos(a) * (ringR + d), 0.45 + d * 0.3, Math.sin(a) * (ringR + d));
			}
			rPos.needsUpdate = true;
			Visualizer3D.#waveformPoints.material.color.setRGB(r, g, b);
			Visualizer3D.#waveformPoints.material.opacity = 0.35 + bass * 0.35;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  3D SAND — Chladni/cymatic sand patterns on a vibrating plate
	// ═══════════════════════════════════════════════

	static #setupSand() {
		Visualizer3D.#sandGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#sandGroup);

		// Plate (dark metal square)
		let plate = new THREE.Mesh(
			new THREE.BoxGeometry(14, 0.25, 14),
			new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 60, specular: 0x555555 })
		);
		plate.position.y = -0.14;
		Visualizer3D.#sandGroup.add(plate);
		Visualizer3D.#sandPlane = plate;

		// Sand grains — 80×80 grid with small positional jitter so the
		// field doesn't read as a perfectly synthetic lattice. Base
		// positions are remembered so grains stay anchored in x/z and
		// only hop vertically in response to audio.
		let count = 6400;
		Visualizer3D.#sandCount = count;
		let positions = new Float32Array(count * 3);
		let base      = new Float32Array(count * 3);
		let plateSize = 13;
		let gridN = 80;
		let step  = plateSize / gridN;
		let half  = plateSize * 0.5;
		for (let i = 0; i < count; i++) {
			let gx = i % gridN;
			let gz = Math.floor(i / gridN);
			let x = -half + gx * step + (Math.random() - 0.5) * step * 0.6;
			let z = -half + gz * step + (Math.random() - 0.5) * step * 0.6;
			positions[i * 3]     = x;
			positions[i * 3 + 1] = 0.02;
			positions[i * 3 + 2] = z;
			base[i * 3]     = x;
			base[i * 3 + 1] = 0.02;
			base[i * 3 + 2] = z;
		}
		Visualizer3D.#sandPositions = positions;
		Visualizer3D.#sandBase = base;

		Visualizer3D.#sandGeometry = new THREE.BufferGeometry();
		Visualizer3D.#sandGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

		Visualizer3D.#sandMaterial = new THREE.PointsMaterial({
			color: 0xe8c27a,
			size: 0.09,
			transparent: true,
			opacity: 0.95,
			sizeAttenuation: true,
			depthWrite: false
		});

		Visualizer3D.#sandPoints = new THREE.Points(Visualizer3D.#sandGeometry, Visualizer3D.#sandMaterial);
		Visualizer3D.#sandGroup.add(Visualizer3D.#sandPoints);
	}

	/**
	 * Sand on a vibrating plate — original first version.
	 * Each grain's frequency bin is picked by its radial distance from
	 * the center (inner = low freqs, outer = high freqs), producing the
	 * "ripple from the center outward" motion. Grains hop vertically
	 * only, never slide along the plate.
	 */
	static #renderSand(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#sandPoints || !Visualizer3D.#sandGeometry) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		let positions = Visualizer3D.#sandGeometry.attributes.position;
		let arr  = Visualizer3D.#sandPositions;
		let base = Visualizer3D.#sandBase;
		let count = Visualizer3D.#sandCount;

		let maxR = 9.2;
		let lift = 1.6;
		for (let i = 0; i < count; i++) {
			let bx = base[i * 3];
			let bz = base[i * 3 + 2];
			let dist = Math.sqrt(bx * bx + bz * bz);

			let binIdx = Math.min(bufferLength - 1, Math.floor((dist / maxR) * bufferLength));
			let v = Math.max(0, dataArray[binIdx] + toff);
			let amp = Math.min(1, v / 180);

			let height = amp * lift * (0.55 + bass * 0.45);

			arr[i * 3]     = bx;
			arr[i * 3 + 1] = 0.02 + height;
			arr[i * 3 + 2] = bz;
		}
		positions.needsUpdate = true;

		if (Visualizer3D.#sandMaterial) {
			let sr = 0.91 * (0.55 + r * 0.5);
			let sg = 0.76 * (0.55 + g * 0.5);
			let sb = 0.48 * (0.55 + b * 0.5);
			Visualizer3D.#sandMaterial.color.setRGB(sr, sg, sb);
			Visualizer3D.#sandMaterial.size = 0.085 + bass * 0.02;
			Visualizer3D.#sandMaterial.opacity = 0.9 + bass * 0.1;
		}
		if (Visualizer3D.#sandPlane) {
			Visualizer3D.#sandPlane.material.color.setRGB(
				0.1 + r * 0.05, 0.1 + g * 0.05, 0.1 + b * 0.05
			);
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  DNA HELIX — double helix with frequency-reactive base pairs
	// ═══════════════════════════════════════════════

	static #setupDnaHelix() {
		Visualizer3D.#dnaGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#dnaGroup);

		let segments = 64;
		Visualizer3D.#dnaSegments = segments;

		// Build two strand geometries as line strips with tube-like width via spheres.
		// We use small spheres along each strand (cheap + lets them glow individually).
		let strandAGeo = new THREE.BufferGeometry();
		let strandBGeo = new THREE.BufferGeometry();
		let posA = new Float32Array(segments * 3);
		let posB = new Float32Array(segments * 3);
		strandAGeo.setAttribute("position", new THREE.BufferAttribute(posA, 3));
		strandBGeo.setAttribute("position", new THREE.BufferAttribute(posB, 3));

		Visualizer3D.#dnaStrandAGeo = strandAGeo;
		Visualizer3D.#dnaStrandBGeo = strandBGeo;

		// Render strands as THREE.Line with solid bright color (backbone)
		let matA = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.9 });
		let matB = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.9 });
		Visualizer3D.#dnaStrandA = new THREE.Line(strandAGeo, matA);
		Visualizer3D.#dnaStrandB = new THREE.Line(strandBGeo, matB);
		Visualizer3D.#dnaGroup.add(Visualizer3D.#dnaStrandA);
		Visualizer3D.#dnaGroup.add(Visualizer3D.#dnaStrandB);

		// Rungs (base pairs): one cylinder connecting strand A at idx to strand B at idx,
		// every 3rd segment to keep geometry tidy.
		Visualizer3D.#dnaRungGroup = new THREE.Group();
		Visualizer3D.#dnaGroup.add(Visualizer3D.#dnaRungGroup);
		Visualizer3D.#dnaRungs = [];
		for (let i = 0; i < segments; i += 2) {
			let rungGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
			let rungMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x000000, shininess: 80 });
			let rung = new THREE.Mesh(rungGeo, rungMat);
			Visualizer3D.#dnaRungGroup.add(rung);
			// End-cap spheres (looks like phosphate backbone nodes)
			let sphGeo = new THREE.SphereGeometry(0.18, 10, 10);
			let sphMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x000000, shininess: 100 });
			let sphereA = new THREE.Mesh(sphGeo, sphMat);
			let sphereB = new THREE.Mesh(sphGeo, sphMat);
			Visualizer3D.#dnaRungGroup.add(sphereA);
			Visualizer3D.#dnaRungGroup.add(sphereB);
			Visualizer3D.#dnaRungs.push({ mesh: rung, sphereA: sphereA, sphereB: sphereB, baseIdx: i });
		}

		Visualizer3D.#dnaRotation = 0;
	}

	static #renderDnaHelix(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#dnaGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0, midSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd   = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));

		Visualizer3D.#dnaRotation += 0.006 + bass * 0.025;

		let segments = Visualizer3D.#dnaSegments;
		let turns = 2.6;             // number of full twists along the helix length
		let length = 14;             // Y span
		let posA = Visualizer3D.#dnaStrandAGeo.attributes.position.array;
		let posB = Visualizer3D.#dnaStrandBGeo.attributes.position.array;

		for (let i = 0; i < segments; i++) {
			let t = i / (segments - 1);             // 0..1 along length
			let y = (t - 0.5) * length;
			// Audio-driven radius: each strand point samples a frequency bin
			let fi = Math.min(bufferLength - 1, Math.floor(t * bufferLength));
			let v = Math.max(0, dataArray[fi] + toff);
			let radBase = 2.4;
			let rad = radBase + (v / 300) * 1.4 + bass * 0.5;
			let angle = t * Math.PI * 2 * turns + Visualizer3D.#dnaRotation;

			posA[i * 3]     = Math.cos(angle) * rad;
			posA[i * 3 + 1] = y;
			posA[i * 3 + 2] = Math.sin(angle) * rad;
			posB[i * 3]     = Math.cos(angle + Math.PI) * rad;
			posB[i * 3 + 1] = y;
			posB[i * 3 + 2] = Math.sin(angle + Math.PI) * rad;
		}
		Visualizer3D.#dnaStrandAGeo.attributes.position.needsUpdate = true;
		Visualizer3D.#dnaStrandBGeo.attributes.position.needsUpdate = true;

		// Color strands by barColor
		Visualizer3D.#dnaStrandA.material.color.setRGB(r, g, b);
		Visualizer3D.#dnaStrandB.material.color.setRGB(r * 0.85, g * 0.85, b);

		// Update rungs: position cylinder between strand A and strand B at baseIdx
		let rungs = Visualizer3D.#dnaRungs;
		// Reuse module-level scratch vectors so we don't allocate per rung per frame.
		let up = Visualizer3D.#scratchUp;
		let dir = Visualizer3D.#scratchDir;
		for (let k = 0; k < rungs.length; k++) {
			let item = rungs[k];
			let i = item.baseIdx;
			let ax = posA[i * 3],     ay = posA[i * 3 + 1],     az = posA[i * 3 + 2];
			let bx = posB[i * 3],     by = posB[i * 3 + 1],     bz = posB[i * 3 + 2];
			let mx = (ax + bx) / 2,   my = (ay + by) / 2,       mz = (az + bz) / 2;
			let dx = bx - ax,         dy = by - ay,             dz = bz - az;
			let len = Math.sqrt(dx * dx + dy * dy + dz * dz);
			item.mesh.position.set(mx, my, mz);
			item.mesh.scale.set(1, len, 1);

			// Orient cylinder's Y-axis along the A→B direction (normalize in place)
			let invLen = len > 1e-6 ? 1 / len : 0;
			dir.set(dx * invLen, dy * invLen, dz * invLen);
			item.mesh.quaternion.setFromUnitVectors(up, dir);

			// Color each rung from its frequency bin — rainbow along length
			let fi = Math.min(bufferLength - 1, Math.floor((i / segments) * bufferLength));
			let v = Math.max(0, dataArray[fi] + toff) / 255;
			let hue = (i / segments + Visualizer3D.#dnaRotation * 0.05) % 1;
			let rr = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2);
			let gg = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 2.09);
			let bb = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 4.18);
			// Blend with barColor
			rr = rr * 0.4 + r * 0.6;
			gg = gg * 0.4 + g * 0.6;
			bb = bb * 0.4 + b * 0.6;
			item.mesh.material.color.setRGB(rr, gg, bb);
			item.mesh.material.emissive.setRGB(rr * v * 0.85, gg * v * 0.85, bb * v * 0.85);

			// End-cap spheres glow by their own bin amp
			item.sphereA.position.set(ax, ay, az);
			item.sphereB.position.set(bx, by, bz);
			let sa = 0.15 + v * 0.3;
			item.sphereA.scale.set(sa, sa, sa);
			item.sphereB.scale.set(sa, sa, sa);
			item.sphereA.material.color.setRGB(rr, gg, bb);
			item.sphereB.material.color.setRGB(rr, gg, bb);
			item.sphereA.material.emissive.setRGB(rr * v, gg * v, bb * v);
			item.sphereB.material.emissive.setRGB(rr * v, gg * v, bb * v);
		}

		// Gentle lateral tilt on mid frequencies
		Visualizer3D.#dnaGroup.rotation.z = Math.sin(performance.now() * 0.0005) * 0.12 + mid * 0.08;

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  NEON TUNNEL — rings receding into the distance
	// ═══════════════════════════════════════════════

	static #setupNeonTunnel() {
		Visualizer3D.#tunnelGroup = new THREE.Group();
		Visualizer3D.#scene.add(Visualizer3D.#tunnelGroup);
		Visualizer3D.#tunnelRings = [];
		Visualizer3D.#tunnelFrame = 0;

		// Pre-seed some rings so we don't start empty
		for (let i = 0; i < Visualizer3D.#tunnelMaxRings; i++) {
			Visualizer3D.#spawnTunnelRing(-i * 1.2);
		}

		// Move camera inside the tunnel — looking forward (-Z)
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.position.set(0, 0, 6);
			Visualizer3D.#camera.lookAt(0, 0, -10);
		}
	}

	static #spawnTunnelRing(zStart) {
		let segs = Visualizer3D.#tunnelRingSegments;
		let positions = new Float32Array((segs + 1) * 3);
		let baseR = 3.5;
		for (let s = 0; s <= segs; s++) {
			let a = (s / segs) * Math.PI * 2;
			positions[s * 3]     = Math.cos(a) * baseR;
			positions[s * 3 + 1] = Math.sin(a) * baseR;
			positions[s * 3 + 2] = 0;
		}
		let geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		let mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
		let ring = new THREE.LineLoop(geo, mat);
		ring.position.z = zStart;
		Visualizer3D.#tunnelGroup.add(ring);
		Visualizer3D.#tunnelRings.push({ mesh: ring, geometry: geo, baseR: baseR, z: zStart, birthFrame: Visualizer3D.#tunnelFrame });
	}

	static #renderNeonTunnel(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#tunnelGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0, midSum = 0, highSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd   = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
			else highSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));
		let high = Math.min(1.0, highSum / ((bufferLength - midEnd) * 90));

		Visualizer3D.#tunnelFrame++;

		// Forward speed: faster on bass (camera stays put, rings fly past)
		let speed = 0.15 + bass * 0.35;

		// Update rings
		let rings = Visualizer3D.#tunnelRings;
		let segs = Visualizer3D.#tunnelRingSegments;
		for (let k = rings.length - 1; k >= 0; k--) {
			let ring = rings[k];
			ring.mesh.position.z += speed;

			// Deform ring vertices based on frequency bins — each vertex picks
			// a bin corresponding to its angle.  Per-ring phase offset so the
			// pattern rotates down the tunnel.
			let pos = ring.geometry.attributes.position.array;
			let ringPhase = k * 0.15 + Visualizer3D.#tunnelFrame * 0.004;
			for (let s = 0; s <= segs; s++) {
				let a = (s / segs) * Math.PI * 2;
				let fi = (Math.floor(((a / (Math.PI * 2)) * bufferLength + ring.birthFrame * 2) % bufferLength));
				let v = Math.max(0, dataArray[fi] + toff);
				// Distortion radius scales with bin amplitude
				let deform = ring.baseR + (v / 220) * 1.1 + Math.sin(a * 3 + ringPhase) * 0.15 * high;
				pos[s * 3]     = Math.cos(a) * deform;
				pos[s * 3 + 1] = Math.sin(a) * deform;
			}
			ring.geometry.attributes.position.needsUpdate = true;

			// Color — further rings dimmer, hue shifted by their distance
			let distT = Math.min(1, (ring.mesh.position.z + 60) / 70);
			let ageHue = (k * 0.05 + Visualizer3D.#tunnelFrame * 0.003) % 1;
			let hr = r * 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ageHue * Math.PI * 2));
			let hg = g * 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ageHue * Math.PI * 2 + 2.09));
			let hb = b * 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ageHue * Math.PI * 2 + 4.18));
			ring.mesh.material.color.setRGB(hr, hg, hb);
			ring.mesh.material.opacity = 0.25 + (1 - distT) * 0.75;

			// Recycle rings that pass the camera
			if (ring.mesh.position.z > 8) {
				Visualizer3D.#tunnelGroup.remove(ring.mesh);
				ring.geometry.dispose();
				ring.mesh.material.dispose();
				rings.splice(k, 1);
			}
		}

		// Spawn a fresh ring at the far end when we're below max
		while (rings.length < Visualizer3D.#tunnelMaxRings) {
			// New ring appears deep in the distance
			let farthest = Math.min.apply(null, rings.map(function (x) { return x.mesh.position.z; }));
			Visualizer3D.#spawnTunnelRing(farthest - 1.2);
		}

		// Slight camera sway for immersion
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.rotation.z = Math.sin(Visualizer3D.#tunnelFrame * 0.01) * 0.04 + mid * 0.05;
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  PARTICLE SPHERE — Disperses on bass, reforms in silence
	// ═══════════════════════════════════════════════

	static #setupParticleSphere() {
		let count = 3500;
		let geo = new THREE.BufferGeometry();
		let positions = new Float32Array(count * 3);
		let colors = new Float32Array(count * 3);
		let baseDirs = new Float32Array(count * 3);
		let binNorm = new Float32Array(count);
		let R = Visualizer3D.#particleSphereBaseRadius;
		let TWO_PI = Math.PI * 2;
		for (let i = 0; i < count; i++) {
			// Uniform sphere via marsaglia
			let u = Math.random() * 2 - 1;
			let t = Math.random() * TWO_PI;
			let s = Math.sqrt(1 - u * u);
			let dx = s * Math.cos(t), dy = u, dz = s * Math.sin(t);
			baseDirs[i * 3] = dx;
			baseDirs[i * 3 + 1] = dy;
			baseDirs[i * 3 + 2] = dz;
			positions[i * 3] = dx * R;
			positions[i * 3 + 1] = dy * R;
			positions[i * 3 + 2] = dz * R;
			colors[i * 3] = 0.4 + Math.random() * 0.6;
			colors[i * 3 + 1] = 0.6 + Math.random() * 0.4;
			colors[i * 3 + 2] = 0.9;
			// Precompute normalized angle 0..1 for frequency bin mapping.
			// Avoids atan2() per particle per frame in the hot render loop.
			binNorm[i] = (Math.atan2(dz, dx) + Math.PI) / TWO_PI;
		}
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		let mat = new THREE.PointsMaterial({
			size: 0.07,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		let points = new THREE.Points(geo, mat);
		Visualizer3D.#particleSphereGroup = new THREE.Group();
		Visualizer3D.#particleSphereGroup.add(points);
		Visualizer3D.#scene.add(Visualizer3D.#particleSphereGroup);
		Visualizer3D.#particleSpherePoints = points;
		Visualizer3D.#particleSphereGeometry = geo;
		Visualizer3D.#particleSphereBaseDirs = baseDirs;
		Visualizer3D.#particleSphereBinNorm = binNorm;
		Visualizer3D.#particleSphereOffsets = new Float32Array(count);  // all zero
		Visualizer3D.#particleSphereVelocity = new Float32Array(count);
		Visualizer3D.#particleSphereCount = count;
		Visualizer3D.#particleSpherePrevBass = 0;
	}

	static #renderParticleSphere(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#particleSpherePoints) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let bassSum = 0, midSum = 0, highSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd   = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
			else highSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));
		let high = Math.min(1.0, highSum / ((bufferLength - midEnd) * 90));
		let totalNorm = Math.min(1.0, tre / (bufferLength * 120));

		// Detect a bass drop (rising edge)
		let bassKick = Math.max(0, bass - Visualizer3D.#particleSpherePrevBass - 0.06);
		Visualizer3D.#particleSpherePrevBass = bass;

		// Silence: totalNorm < 0.08. Strong reforming spring.
		let silence = totalNorm < 0.08;

		let pos = Visualizer3D.#particleSphereGeometry.attributes.position.array;
		let col = Visualizer3D.#particleSphereGeometry.attributes.color.array;
		let baseDirs = Visualizer3D.#particleSphereBaseDirs;
		let binNorm = Visualizer3D.#particleSphereBinNorm;
		let offsets = Visualizer3D.#particleSphereOffsets;
		let vels = Visualizer3D.#particleSphereVelocity;
		let R = Visualizer3D.#particleSphereBaseRadius;
		let count = Visualizer3D.#particleSphereCount;
		let binMax = bufferLength - 1;

		// Per-particle update: Hooke's law-ish spring back to the sphere,
		// with dispersal velocity imparted on bass kicks.
		let springK = silence ? 0.12 : 0.03;
		let damping = silence ? 0.82 : 0.94;
		let freqSpread = high * 0.35;   // high freq adds a shimmer displacement

		for (let i = 0; i < count; i++) {
			let i3 = i * 3;
			let dx = baseDirs[i3];
			let dy = baseDirs[i3 + 1];
			let dz = baseDirs[i3 + 2];

			// Bin index is precomputed at setup (normalized angle × bufferLength).
			let binIdx = (binNorm[i] * bufferLength) | 0;
			if (binIdx > binMax) binIdx = binMax;
			let dv = dataArray[binIdx] + toff;
			let fv = dv > 0 ? dv / 220 : 0;

			// Bass kick: add outward velocity
			if (bassKick > 0.05) {
				vels[i] += bassKick * (1.5 + Math.random() * 2.5) * (0.6 + fv * 0.8);
			}

			// Spring back toward base radius
			let spring = -springK * offsets[i];
			// Frequency-driven jitter added to the spring force
			let jitter = (fv - 0.3) * 0.15 + freqSpread * (Math.random() - 0.5) * 0.4;
			vels[i] = vels[i] * damping + spring + jitter;
			offsets[i] += vels[i];

			let rad = R + offsets[i];
			pos[i3]     = dx * rad;
			pos[i3 + 1] = dy * rad;
			pos[i3 + 2] = dz * rad;

			// Color: tint toward red on dispersal, toward bar color otherwise
			let off = offsets[i];
			if (off < 0) off = -off;
			let disp = off > 4 ? 1 : off * 0.25;
			col[i3]     = r + disp * (1 - r) * 0.6;
			col[i3 + 1] = g * (1 - disp * 0.3);
			col[i3 + 2] = b * (1 - disp * 0.5);
		}
		Visualizer3D.#particleSphereGeometry.attributes.position.needsUpdate = true;
		Visualizer3D.#particleSphereGeometry.attributes.color.needsUpdate = true;

		if (Visualizer3D.autoRotate) {
			Visualizer3D.#particleSphereGroup.rotation.y += 0.004 + mid * 0.01;
			Visualizer3D.#particleSphereGroup.rotation.x += 0.001 + bass * 0.003;
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  HISTOGRAM 3D — Rolling spectrogram
	// ═══════════════════════════════════════════════

	static #setupHistogram3D() {
		let cols = Visualizer3D.#histogramCols;
		let rows = Visualizer3D.#histogramRows;
		let geo = new THREE.BoxGeometry(0.28, 1, 0.28);
		let group = new THREE.Group();
		let bars = [];
		let history = new Array(rows);
		for (let r = 0; r < rows; r++) {
			history[r] = new Float32Array(cols);
			for (let c = 0; c < cols; c++) {
				let mat = new THREE.MeshPhongMaterial({
					color: 0xffffff,
					emissive: 0x000000,
					transparent: true,
					opacity: 0.9
				});
				let mesh = new THREE.Mesh(geo, mat);
				mesh.position.x = (c - (cols - 1) / 2) * 0.38;
				mesh.position.z = (r - (rows - 1) / 2) * 0.8;
				mesh.position.y = 0;
				mesh.scale.y = 0.05;
				group.add(mesh);
				bars.push(mesh);
			}
		}
		Visualizer3D.#scene.add(group);
		Visualizer3D.#histogramGroup = group;
		Visualizer3D.#histogramBars = bars;
		Visualizer3D.#histogramHistory = history;
		Visualizer3D.#histogramRow = 0;
	}

	static #renderHistogram3D(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#histogramGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let cols = Visualizer3D.#histogramCols;
		let rows = Visualizer3D.#histogramRows;

		// Capture current frame into the "front" history row (on BPM beats)
		// but also every frame (so silence → flattens over time).
		let curRow = Visualizer3D.#histogramHistory[Visualizer3D.#histogramRow];
		for (let c = 0; c < cols; c++) {
			let binIdx = Math.min(bufferLength - 1, Math.floor((c / cols) * bufferLength));
			let val = Math.max(0, dataArray[binIdx] + toff);
			tre += val;
			curRow[c] = val / 220;   // normalize
		}
		Visualizer3D.#histogramRow = (Visualizer3D.#histogramRow + 1) % rows;

		// Draw: each 3D row shows a time slice (oldest at back).
		let bars = Visualizer3D.#histogramBars;
		for (let r0 = 0; r0 < rows; r0++) {
			// Index rotation: most recent row at z = max (front)
			let histIdx = (Visualizer3D.#histogramRow - r0 - 1 + rows) % rows;
			let row = Visualizer3D.#histogramHistory[histIdx];
			for (let c = 0; c < cols; c++) {
				let mesh = bars[r0 * cols + c];
				let h = Math.max(0.05, row[c] * 8);
				mesh.scale.y = h;
				mesh.position.y = h / 2;
				// Color: freq + age fade
				let ageFade = 1 - (r0 / rows) * 0.7;
				let intensity = Math.min(1, row[c] * 1.5);
				mesh.material.color.setRGB(
					r * intensity * ageFade + 0.2 * intensity,
					g * intensity * ageFade + 0.1 * intensity * (1 - c / cols),
					b * intensity * ageFade + 0.3 * intensity * (c / cols)
				);
				mesh.material.emissive.setRGB(
					r * intensity * 0.3,
					g * intensity * 0.2,
					b * intensity * 0.4
				);
			}
		}

		if (Visualizer3D.autoRotate) {
			Visualizer3D.#histogramGroup.rotation.y += 0.003;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  AUDIO WAVE 3D — Matrix of cubes with corner-mirror symmetry
	//  Inspired by: https://codesandbox.io/p/sandbox/3d-audio-visualizer-267ty9
	//  A large grid of cubes covers the scene; each cube's height is driven
	//  by an audio bin. The grid is 4-way mirrored so each quadrant mirrors
	//  the others — producing a calm, meditative symmetry.
	// ═══════════════════════════════════════════════

	static #setupAudioWave3D() {
		// Even-N grid so the mirror split is clean (half * 2).
		let gridN = 40;
		Visualizer3D.#audioWaveGridN = gridN;
		let total = gridN * gridN;

		let boxGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
		let mat = new THREE.MeshPhongMaterial({
			color: 0xffffff,
			shininess: 40,
			specular: 0x666666,
			flatShading: false
		});

		let mesh = new THREE.InstancedMesh(boxGeo, mat, total);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		// Enable per-instance color so each cube can tint independently.
		mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
		mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

		// Place each cube on a grid. Cubes are tall-ish (y-up) so their
		// height scales easily with amplitude.
		let spacing = 0.65;
		let half = (gridN - 1) / 2;
		let matrix = new THREE.Matrix4();
		for (let i = 0; i < gridN; i++) {
			for (let j = 0; j < gridN; j++) {
				let idx = i * gridN + j;
				let x = (i - half) * spacing;
				let z = (j - half) * spacing;
				matrix.makeScale(1, 0.05, 1).setPosition(x, 0.025, z);
				mesh.setMatrixAt(idx, matrix);
				mesh.setColorAt
					? mesh.setColorAt(idx, new THREE.Color(0.25, 0.3, 0.55))
					: null;
			}
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		Visualizer3D.#audioWaveGroup = new THREE.Group();
		Visualizer3D.#audioWaveGroup.add(mesh);
		Visualizer3D.#scene.add(Visualizer3D.#audioWaveGroup);
		Visualizer3D.#audioWaveMesh = mesh;
		Visualizer3D.#audioWaveMatrix = new THREE.Matrix4();
		Visualizer3D.#audioWaveColor  = new THREE.Color();
	}

	static #renderAudioWave3D(dataArray, bufferLength, barColor, toff) {
		let mesh = Visualizer3D.#audioWaveMesh;
		if (!mesh) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;

		let bassSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		let gridN = Visualizer3D.#audioWaveGridN;
		let half  = (gridN - 1) / 2;
		let halfN = gridN / 2;
		let spacing = 0.65;
		let matrix = Visualizer3D.#audioWaveMatrix;
		let colScr = Visualizer3D.#audioWaveColor;

		// Corner-mirror symmetry:
		//   - fold (i,j) into the first quadrant via (min(i, N-1-i), min(j, N-1-j))
		//   - freqIndex = Manhattan-ish distance in that quadrant
		// Each quadrant therefore mirrors the others, and the wave flows
		// inward from all four corners.
		let maxQ = halfN;                // max distance inside one quadrant
		let maxD = maxQ + maxQ;          // max Manhattan distance

		for (let i = 0; i < gridN; i++) {
			let qi = i < halfN ? i : gridN - 1 - i;
			for (let j = 0; j < gridN; j++) {
				let qj = j < halfN ? j : gridN - 1 - j;
				// Map folded (qi, qj) → a single frequency bin.
				// Manhattan distance gives diagonal symmetry that matches
				// "each corner is a mirror of each corner".
				let d = qi + qj;
				let binIdx = Math.min(bufferLength - 1, Math.floor((d / maxD) * bufferLength));
				let v = Math.max(0, dataArray[binIdx] + toff);
				let amp = Math.min(1, v / 180);

				let idx = i * gridN + j;
				let h = 0.08 + amp * 3.5 + bass * 0.4;

				let x = (i - half) * spacing;
				let z = (j - half) * spacing;
				matrix.makeScale(1, h, 1).setPosition(x, h / 2, z);
				mesh.setMatrixAt(idx, matrix);

				// Per-cube color: dim base → bright barColor as amp grows.
				let cR = r * (0.2 + amp * 0.8);
				let cG = g * (0.2 + amp * 0.8);
				let cB = b * (0.2 + amp * 0.8) + 0.1 * (1 - amp);
				colScr.setRGB(cR, cG, cB);
				if (mesh.setColorAt) mesh.setColorAt(idx, colScr);
			}
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  HEADPHONES 3D — Ear cups emit sound waves
	// ═══════════════════════════════════════════════

	static #setupHeadphones3D() {
		let group = new THREE.Group();
		// Ear cups (two cylinders rotated onto the x axis)
		let cupGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.8, 36);
		let cupMatL = new THREE.MeshPhongMaterial({ color: 0x222233, emissive: 0x111122, shininess: 60 });
		let cupMatR = new THREE.MeshPhongMaterial({ color: 0x222233, emissive: 0x111122, shininess: 60 });
		let leftCup = new THREE.Mesh(cupGeo, cupMatL);
		leftCup.rotation.z = Math.PI / 2;
		leftCup.position.x = -4.5;
		group.add(leftCup);
		let rightCup = new THREE.Mesh(cupGeo, cupMatR);
		rightCup.rotation.z = Math.PI / 2;
		rightCup.position.x = 4.5;
		group.add(rightCup);

		// Inner driver (colored disc)
		let driverGeo = new THREE.CircleGeometry(1.6, 32);
		let driverMat = new THREE.MeshPhongMaterial({ color: 0xff5a5a, emissive: 0x331111, side: THREE.DoubleSide });
		let leftDriver = new THREE.Mesh(driverGeo, driverMat);
		leftDriver.rotation.y = Math.PI / 2;
		leftDriver.position.x = -4.05;
		group.add(leftDriver);
		let rightDriver = new THREE.Mesh(driverGeo, driverMat);
		rightDriver.rotation.y = -Math.PI / 2;
		rightDriver.position.x = 4.05;
		group.add(rightDriver);

		// Headband (torus arc) — arc points UP so the headphones sit
		// naturally over the ear cups. TorusGeometry with a Math.PI arc
		// already spans the upper half-plane, so no extra rotation needed.
		let bandGeo = new THREE.TorusGeometry(4.5, 0.22, 12, 32, Math.PI);
		let bandMat = new THREE.MeshPhongMaterial({ color: 0x444455, shininess: 80 });
		let band = new THREE.Mesh(bandGeo, bandMat);
		band.position.y = 0.1;
		group.add(band);

		Visualizer3D.#scene.add(group);
		Visualizer3D.#headphonesGroup = group;
		Visualizer3D.#headphonesLeftCup = leftCup;
		Visualizer3D.#headphonesRightCup = rightCup;
		Visualizer3D.#headphonesBand = band;
		Visualizer3D.#headphonesWaves = [];
		Visualizer3D.#headphonesFrame = 0;
	}

	static #renderHeadphones3D(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#headphonesGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let bassSum = 0, midSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));

		Visualizer3D.#headphonesFrame++;
		let totalNorm = Math.min(1, tre / (bufferLength * 120));

		// Spawn a wave ring from each cup at beat-aligned intervals.
		// Waves are thin torus rings that expand outward along the cup axis.
		let beatP = sharedBpm.getBeatPeriodSec ? sharedBpm.getBeatPeriodSec() : 0.5;
		let spawnInterval = Math.max(6, Math.round(beatP * 60 / 2));  // half-beat spacing
		if (Visualizer3D.#headphonesFrame % spawnInterval === 0 && totalNorm > 0.1) {
			let amp = Math.min(1, bass * 1.3 + mid * 0.5);
			let sides = amp > 0.35 ? [-1, 1] : [Math.random() < 0.5 ? -1 : 1];
			for (let si = 0; si < sides.length; si++) {
				let side = sides[si];
				let ringGeo = new THREE.TorusGeometry(0.3, 0.05, 8, 28);
				let ringMat = new THREE.MeshBasicMaterial({
					color: new THREE.Color(r, g, b),
					transparent: true,
					opacity: 0.85,
					blending: THREE.AdditiveBlending,
					depthWrite: false
				});
				let ring = new THREE.Mesh(ringGeo, ringMat);
				ring.rotation.y = Math.PI / 2;
				ring.position.x = side * 5.0;
				Visualizer3D.#headphonesGroup.add(ring);
				Visualizer3D.#headphonesWaves.push({
					mesh: ring,
					geometry: ringGeo,
					material: ringMat,
					birthFrame: Visualizer3D.#headphonesFrame,
					side: side,
					baseAmp: amp
				});
			}
		}

		// Update existing waves: expand outward, fade opacity
		for (let i = Visualizer3D.#headphonesWaves.length - 1; i >= 0; i--) {
			let w = Visualizer3D.#headphonesWaves[i];
			let age = Visualizer3D.#headphonesFrame - w.birthFrame;
			// Speed of sound mapping: expand at ~0.12 units/frame, growing with bass
			let travel = age * (0.18 + w.baseAmp * 0.25);
			let scale = 1 + travel;
			w.mesh.scale.set(scale, scale, scale);
			w.mesh.position.x = w.side * (5.0 + travel * 0.5);
			w.material.opacity = Math.max(0, 0.85 - travel * 0.1);
			if (w.material.opacity <= 0 || travel > 9) {
				Visualizer3D.#headphonesGroup.remove(w.mesh);
				w.geometry.dispose();
				w.material.dispose();
				Visualizer3D.#headphonesWaves.splice(i, 1);
			}
		}

		// Driver color pulses with bass
		let pulse = 0.3 + bass * 0.9;
		if (Visualizer3D.#headphonesLeftCup) {
			Visualizer3D.#headphonesLeftCup.material.emissive.setRGB(r * pulse * 0.3, g * pulse * 0.3, b * pulse * 0.3);
			Visualizer3D.#headphonesRightCup.material.emissive.setRGB(r * pulse * 0.3, g * pulse * 0.3, b * pulse * 0.3);
		}

		// Slight nod of the headphones in sync with beat
		if (Visualizer3D.autoRotate) {
			Visualizer3D.#headphonesGroup.rotation.y = Math.sin(Visualizer3D.#headphonesFrame * 0.008) * 0.3 + mid * 0.2;
			Visualizer3D.#headphonesGroup.rotation.x = Math.sin(Visualizer3D.#headphonesFrame * 0.015) * 0.08;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  LYRIC PARTICLES — forms lyrics text or a sphere
	// ═══════════════════════════════════════════════

	static #setupLyricParticles() {
		// Pull the particle count from the user-configurable public field.
		// Clamp to a sane range so extreme values can't crash the renderer.
		let count = Math.max(500, Math.min(30000, Math.floor(Visualizer3D.lyricParticleCount) || 10000));
		let geo = new THREE.BufferGeometry();
		let positions = new Float32Array(count * 3);
		let colors = new Float32Array(count * 3);
		// Start scattered across a sphere
		let R = 4;
		for (let i = 0; i < count; i++) {
			let u = Math.random() * 2 - 1;
			let t = Math.random() * Math.PI * 2;
			let s = Math.sqrt(1 - u * u);
			positions[i * 3]     = s * Math.cos(t) * R;
			positions[i * 3 + 1] = u * R;
			positions[i * 3 + 2] = s * Math.sin(t) * R;
			colors[i * 3] = 0.5;
			colors[i * 3 + 1] = 0.8;
			colors[i * 3 + 2] = 1.0;
		}
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		let mat = new THREE.PointsMaterial({
			size: 0.1,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		let points = new THREE.Points(geo, mat);
		Visualizer3D.#lyricGroup = new THREE.Group();
		Visualizer3D.#lyricGroup.add(points);
		Visualizer3D.#scene.add(Visualizer3D.#lyricGroup);
		Visualizer3D.#lyricPoints = points;
		Visualizer3D.#lyricGeometry = geo;
		Visualizer3D.#lyricPositions = positions;
		Visualizer3D.#lyricTargets = new Float32Array(count * 3);
		Visualizer3D.#lyricVelocities = new Float32Array(count * 3);
		Visualizer3D.#lyricCount = count;
		Visualizer3D.#lyricLastText = "";
		// Initial targets: the same sphere distribution as positions
		Visualizer3D.#lyricTargets.set(positions);
	}

	/**
	 * Renders the requested text into an offscreen canvas and converts the
	 * opaque pixels to a set of target positions for the lyric particles.
	 * Adds a small random z-depth so the text reads as 3D rather than flat.
	 * Returns a Float32Array of length count*3, or null if text is empty.
	 */
	static #buildTextTargets(text, count) {
		if (!text) return null;
		// Wider canvas for longer lyric lines.
		let cvs = document.createElement("canvas");
		cvs.width = 1024;
		cvs.height = 192;
		let cx = cvs.getContext("2d");
		cx.fillStyle = "#000";
		cx.fillRect(0, 0, cvs.width, cvs.height);
		cx.fillStyle = "#fff";
		// Auto-shrink font size if the text is too wide to fit the canvas.
		let fontSize = 120;
		cx.font = "bold " + fontSize + "px sans-serif";
		while (fontSize > 32 && cx.measureText(text).width > cvs.width - 20) {
			fontSize -= 4;
			cx.font = "bold " + fontSize + "px sans-serif";
		}
		cx.textAlign = "center";
		cx.textBaseline = "middle";
		cx.fillText(text, cvs.width / 2, cvs.height / 2);
		let img = cx.getImageData(0, 0, cvs.width, cvs.height);
		// Gather all opaque pixels
		let bright = [];
		let step = 2;
		for (let y = 0; y < cvs.height; y += step) {
			for (let x = 0; x < cvs.width; x += step) {
				let idx = (y * cvs.width + x) * 4;
				if (img.data[idx] > 100) {
					bright.push([x, y]);
				}
			}
		}
		if (bright.length === 0) return null;
		let out = new Float32Array(count * 3);
		// World space: width 16, height 3. z-thickness ±0.25 for 3D depth.
		let sx = 16 / cvs.width;
		let sy = 3  / cvs.height;
		for (let i = 0; i < count; i++) {
			let p = bright[i % bright.length];
			out[i * 3]     = (p[0] - cvs.width / 2) * sx;
			out[i * 3 + 1] = -(p[1] - cvs.height / 2) * sy;
			// z-jitter gives letters a subtle thickness so they read as 3D.
			out[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
		}
		return out;
	}

	/**
	 * Pulls the currently-playing lyric line from the live Lyrics instance
	 * attached to the Visualizer (Visual.lyrics). Returns "" if no lyrics
	 * are loaded or no line matches the current time.
	 */
	static #getActiveLyric() {
		let V = (typeof window !== "undefined") ? window.Visual : null;
		if (!V || !V.lyrics || typeof V.lyrics.getAtTime !== "function") return "";
		let player = document.getElementById("player");
		if (!player) return "";
		// Lyrics.getAtTime expects the time the same way the rest of the
		// system calls it — as "currentTime * 1000" (milliseconds) because
		// the canonical lyric array stores timestamps in ms.
		let ms = (player.currentTime || 0) * 1000;
		try {
			let line = V.lyrics.getAtTime(ms.toString());
			return (line && line !== "]") ? line : "";
		} catch (e) {
			return "";
		}
	}

	static #renderLyricParticles(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#lyricPoints) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let bassSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let totalNorm = Math.min(1.0, tre / (bufferLength * 120));

		// Pull the current lyric from the live Lyrics module.
		let curLyric = Visualizer3D.#getActiveLyric();
		let showText = curLyric && curLyric.length > 0;

		// Re-target whenever the active lyric line changes — this is what
		// makes the particles "flow" from one line to the next.
		if (showText && curLyric !== Visualizer3D.#lyricLastText) {
			let tgt = Visualizer3D.#buildTextTargets(curLyric, Visualizer3D.#lyricCount);
			if (tgt) {
				Visualizer3D.#lyricTargets = tgt;
				Visualizer3D.#lyricLastText = curLyric;
			}
		} else if (!showText && Visualizer3D.#lyricLastText !== "") {
			// No active lyric — fall back to a scattered sphere so the
			// particles still have something to form.
			let count = Visualizer3D.#lyricCount;
			let sphereTgt = new Float32Array(count * 3);
			let R = 4;
			for (let i = 0; i < count; i++) {
				let u = Math.random() * 2 - 1;
				let t = Math.random() * Math.PI * 2;
				let s = Math.sqrt(1 - u * u);
				sphereTgt[i * 3]     = s * Math.cos(t) * R;
				sphereTgt[i * 3 + 1] = u * R;
				sphereTgt[i * 3 + 2] = s * Math.sin(t) * R;
			}
			Visualizer3D.#lyricTargets = sphereTgt;
			Visualizer3D.#lyricLastText = "";
		}

		// Pure spring-damper. Each particle is pulled toward its target
		// by a spring (k) and damped. That is the entire motion model —
		// no noise, no sin/cos, no linear overrides. The natural slight
		// bounce of a damped spring is all there is.
		let pos = Visualizer3D.#lyricGeometry.attributes.position.array;
		let col = Visualizer3D.#lyricGeometry.attributes.color.array;
		let vel = Visualizer3D.#lyricVelocities;
		let tgt = Visualizer3D.#lyricTargets;
		let count = Visualizer3D.#lyricCount;
		let k = 0.06;
		let damp = 0.88;
		for (let i = 0; i < count; i++) {
			let i3 = i * 3;
			let binIdx = Math.floor((i / count) * bufferLength);
			let fv = Math.max(0, dataArray[binIdx] + toff) / 220;

			let ax = (tgt[i3]     - pos[i3])     * k;
			let ay = (tgt[i3 + 1] - pos[i3 + 1]) * k;
			let az = (tgt[i3 + 2] - pos[i3 + 2]) * k;

			vel[i3]     = (vel[i3]     + ax) * damp;
			vel[i3 + 1] = (vel[i3 + 1] + ay) * damp;
			vel[i3 + 2] = (vel[i3 + 2] + az) * damp;

			pos[i3]     += vel[i3];
			pos[i3 + 1] += vel[i3 + 1];
			pos[i3 + 2] += vel[i3 + 2];

			// Color (frequency-driven brightness).
			let intensity = Math.min(1, fv * 1.5 + totalNorm * 0.5);
			col[i3]     = r * intensity + 0.1 * (1 - intensity);
			col[i3 + 1] = g * intensity + 0.1 * (1 - intensity);
			col[i3 + 2] = b * intensity + 0.2 * (1 - intensity);
		}
		Visualizer3D.#lyricGeometry.attributes.position.needsUpdate = true;
		Visualizer3D.#lyricGeometry.attributes.color.needsUpdate = true;

		if (Visualizer3D.autoRotate && !showText) {
			Visualizer3D.#lyricGroup.rotation.y += 0.003 + bass * 0.01;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  GELATIN SHAPE — Cube / Pyramid / Sphere that wobbles
	// ═══════════════════════════════════════════════

	static #setupGelatinShape() {
		let shape = Visualizer3D.gelatinShape || "sphere";
		Visualizer3D.#gelatinShape = shape;
		let geo;
		let flatShading = false;
		if (shape === "cube") {
			geo = new THREE.BoxGeometry(4, 4, 4, 24, 24, 24);
		} else if (shape === "pyramid") {
			// heightSegments=1 so each side is a SINGLE TRIANGLE (one flat
			// face per side of the pyramid) instead of being subdivided
			// into dozens of strips that would triangulate under shading.
			// flatShading=true then gives each face a single per-face
			// normal so the four sides read as crisp flat walls.
			geo = new THREE.ConeGeometry(3.2, 4.5, 4, 1);
			flatShading = true;
		} else {
			geo = new THREE.SphereGeometry(3, 48, 32);
		}
		let mat = new THREE.MeshPhongMaterial({
			color: 0x66ccff,
			emissive: 0x113355,
			shininess: 120,
			transparent: true,
			opacity: 0.75,
			side: THREE.DoubleSide,
			flatShading: flatShading
		});
		let mesh = new THREE.Mesh(geo, mat);
		// Marks the geometry as per-frame-animated so wireframe overlay skips it.
		mesh.userData.animatedGeometry = true;
		Visualizer3D.#scene.add(mesh);
		Visualizer3D.#gelatinMesh = mesh;
		Visualizer3D.#gelatinGeometry = geo;
		let pos = geo.attributes.position.array;
		Visualizer3D.#gelatinBasePositions = new Float32Array(pos.length);
		Visualizer3D.#gelatinBasePositions.set(pos);
	}

	/**
	 * Forces a live rebuild of the gelatin geometry — used by ModalOptions
	 * when the user changes the Gelatin Shape dropdown so the new geometry
	 * appears without having to switch designs.
	 */
	static rebuildGelatin() {
		if (Visualizer3D.#gelatinMesh) {
			Visualizer3D.#scene.remove(Visualizer3D.#gelatinMesh);
			if (Visualizer3D.#gelatinGeometry) Visualizer3D.#gelatinGeometry.dispose();
			if (Visualizer3D.#gelatinMesh.material) Visualizer3D.#gelatinMesh.material.dispose();
		}
		Visualizer3D.#setupGelatinShape();
	}

	/**
	 * Forces a live rebuild of the lyric-particles point cloud — used by
	 * ModalOptions when the user changes the particle-count slider so the
	 * new count takes effect without switching designs.
	 */
	static rebuildLyricParticles() {
		if (Visualizer3D.#lyricPoints) {
			if (Visualizer3D.#lyricGroup && Visualizer3D.#scene) {
				Visualizer3D.#scene.remove(Visualizer3D.#lyricGroup);
			}
			if (Visualizer3D.#lyricGeometry) Visualizer3D.#lyricGeometry.dispose();
			if (Visualizer3D.#lyricPoints.material) Visualizer3D.#lyricPoints.material.dispose();
		}
		Visualizer3D.#lyricPoints = null;
		Visualizer3D.#lyricGroup = null;
		Visualizer3D.#lyricGeometry = null;
		Visualizer3D.#lyricPositions = null;
		Visualizer3D.#lyricTargets = null;
		Visualizer3D.#lyricVelocities = null;
		Visualizer3D.#lyricLastText = "";
		Visualizer3D.#setupLyricParticles();
	}

	static #renderGelatinShape(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#gelatinMesh) return 0;
		// If shape option changed, rebuild
		if (Visualizer3D.gelatinShape !== Visualizer3D.#gelatinShape) {
			if (Visualizer3D.#gelatinMesh) {
				Visualizer3D.#scene.remove(Visualizer3D.#gelatinMesh);
				Visualizer3D.#gelatinGeometry.dispose();
				Visualizer3D.#gelatinMesh.material.dispose();
			}
			Visualizer3D.#setupGelatinShape();
		}

		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let bassSum = 0, midSum = 0, highSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
			else highSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));
		let high = Math.min(1.0, highSum / ((bufferLength - midEnd) * 90));

		let pos = Visualizer3D.#gelatinGeometry.attributes.position.array;
		let base = Visualizer3D.#gelatinBasePositions;
		let t = Visualizer3D.#dancerFrame * 0.02;
		Visualizer3D.#dancerFrame++;
		for (let i = 0; i < pos.length; i += 3) {
			let bx = base[i], by = base[i + 1], bz = base[i + 2];
			let len = Math.sqrt(bx * bx + by * by + bz * bz) + 1e-5;
			// Jiggle proportional to vertex distance-from-center (outer wobbles more)
			let wobble = Math.sin(bx * 0.8 + t * 2) * Math.cos(by * 0.8 + t * 1.6) * Math.sin(bz * 0.8 + t * 2.4);
			let disp = (bass * 0.6 + mid * 0.35 + high * 0.2) * 0.55 * wobble;
			let k = 1 + disp / len;
			pos[i]     = bx * k;
			pos[i + 1] = by * k;
			pos[i + 2] = bz * k;
		}
		Visualizer3D.#gelatinGeometry.attributes.position.needsUpdate = true;
		Visualizer3D.#gelatinGeometry.computeVertexNormals();

		// Color tint
		let mat = Visualizer3D.#gelatinMesh.material;
		mat.color.setRGB(0.3 + r * 0.5, 0.6 + g * 0.3, 0.9 * (1 - bass * 0.4) + b * 0.1);
		mat.emissive.setRGB(r * bass * 0.5, g * bass * 0.3, b * bass * 0.4);

		if (Visualizer3D.autoRotate) {
			Visualizer3D.#gelatinMesh.rotation.y += 0.004 + mid * 0.008;
			Visualizer3D.#gelatinMesh.rotation.x += 0.002 + bass * 0.004;
		}
		return tre;
	}

	// ═══════════════════════════════════════════════
	//  DANCER (Dog / Guinea Pig) — Stylized procedural model
	// ═══════════════════════════════════════════════

	static #setupDancer(kind) {
		Visualizer3D.#dancerLastKind = kind;
		let group = new THREE.Group();

		// Body proportions differ by species.
		let bodyScale, headScale, earScale, bodyColor, earColor, noseColor;
		if (kind === "dog") {
			bodyScale = { x: 1.6, y: 1.0, z: 2.8 };
			headScale = 1.1;
			earScale = 0.8;
			bodyColor = 0xc99862;     // caramel
			earColor  = 0x6d3a17;     // darker
			noseColor = 0x1a1a1a;
		} else {
			// Guinea pig — rounder, shorter
			bodyScale = { x: 1.4, y: 1.2, z: 2.0 };
			headScale = 1.0;
			earScale = 0.55;
			bodyColor = 0xd4a880;     // tan
			earColor  = 0x775544;
			noseColor = 0x332222;
		}

		// Body — elongated sphere
		let bodyGeo = new THREE.SphereGeometry(1, 24, 16);
		let bodyMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 15 });
		let body = new THREE.Mesh(bodyGeo, bodyMat);
		body.scale.set(bodyScale.x, bodyScale.y, bodyScale.z);
		body.position.y = 1.1;
		group.add(body);

		// Head
		let headGeo = new THREE.SphereGeometry(0.85 * headScale, 20, 14);
		let headMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 15 });
		let head = new THREE.Mesh(headGeo, headMat);
		head.position.set(0, 1.7, bodyScale.z + 0.2);
		group.add(head);

		// Snout (dog only)
		if (kind === "dog") {
			let snoutGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.7, 16);
			let snoutMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 20 });
			let snout = new THREE.Mesh(snoutGeo, snoutMat);
			snout.rotation.x = Math.PI / 2;
			snout.position.set(0, 1.55, bodyScale.z + 0.9);
			group.add(snout);
			// Nose
			let noseGeo = new THREE.SphereGeometry(0.14, 10, 8);
			let noseMat = new THREE.MeshPhongMaterial({ color: noseColor });
			let nose = new THREE.Mesh(noseGeo, noseMat);
			nose.position.set(0, 1.55, bodyScale.z + 1.28);
			group.add(nose);
		} else {
			// Guinea pig nose
			let noseGeo = new THREE.SphereGeometry(0.16, 10, 8);
			let noseMat = new THREE.MeshPhongMaterial({ color: noseColor });
			let nose = new THREE.Mesh(noseGeo, noseMat);
			nose.position.set(0, 1.65, bodyScale.z + 0.95);
			group.add(nose);
		}

		// Eyes
		let eyeGeo = new THREE.SphereGeometry(0.12, 10, 8);
		let eyeMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 120 });
		let eyeL = new THREE.Mesh(eyeGeo, eyeMat);
		eyeL.position.set(-0.3 * headScale, 1.9, bodyScale.z + 0.75);
		group.add(eyeL);
		let eyeR = new THREE.Mesh(eyeGeo, eyeMat);
		eyeR.position.set( 0.3 * headScale, 1.9, bodyScale.z + 0.75);
		group.add(eyeR);

		// Ears
		let earGeo;
		if (kind === "dog") {
			earGeo = new THREE.ConeGeometry(0.35, 0.9 * earScale, 8);
		} else {
			earGeo = new THREE.SphereGeometry(0.35 * earScale, 12, 8);
		}
		let earMat = new THREE.MeshPhongMaterial({ color: earColor, shininess: 10 });
		let earL = new THREE.Mesh(earGeo, earMat);
		let earR = new THREE.Mesh(earGeo, earMat);
		earL.position.set(-0.55 * headScale, 2.25, bodyScale.z + 0.15);
		earR.position.set( 0.55 * headScale, 2.25, bodyScale.z + 0.15);
		if (kind === "dog") {
			earL.rotation.z = -0.2;
			earR.rotation.z = 0.2;
		}
		group.add(earL);
		group.add(earR);

		// Legs — 4 cylinders
		let legGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 10);
		let legMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 15 });
		let legs = [];
		let lz = bodyScale.z * 0.7;
		let lx = bodyScale.x * 0.65;
		let legPositions = [
			[-lx, 0.5, -lz], [lx, 0.5, -lz],
			[-lx, 0.5,  lz], [lx, 0.5,  lz]
		];
		for (let i = 0; i < 4; i++) {
			let leg = new THREE.Mesh(legGeo, legMat);
			leg.position.set(legPositions[i][0], legPositions[i][1], legPositions[i][2]);
			group.add(leg);
			legs.push(leg);
		}

		// Tail
		let tail = null;
		if (kind === "dog") {
			let tailGeo = new THREE.ConeGeometry(0.15, 1.0, 8);
			let tail2 = new THREE.Mesh(tailGeo, bodyMat);
			tail2.position.set(0, 1.4, -bodyScale.z - 0.3);
			tail2.rotation.x = Math.PI / 3;
			group.add(tail2);
			tail = tail2;
		}

		Visualizer3D.#scene.add(group);
		Visualizer3D.#dancerGroup = group;
		Visualizer3D.#dancerBody = body;
		Visualizer3D.#dancerHead = head;
		Visualizer3D.#dancerTail = tail;
		Visualizer3D.#dancerLegs = legs;
		Visualizer3D.#dancerEars = [earL, earR];
		Visualizer3D.#dancerFrame = 0;
	}

	static #renderDancer(dataArray, bufferLength, barColor, toff, kind) {
		if (!Visualizer3D.#dancerGroup) return 0;
		let tre = 0;
		let r = barColor.r / 255, g = barColor.g / 255, b = barColor.b / 255;
		let bassSum = 0, midSum = 0;
		let bassBins = Math.max(1, Math.floor(bufferLength * 0.05));
		let midEnd = Math.floor(bufferLength * 0.35);
		for (let i = 0; i < bufferLength; i++) {
			let v = Math.max(0, dataArray[i] + toff);
			tre += v;
			if (i < bassBins) bassSum += v;
			else if (i < midEnd) midSum += v;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid  = Math.min(1.0, midSum  / ((midEnd - bassBins) * 120));

		Visualizer3D.#dancerFrame++;
		let frame = Visualizer3D.#dancerFrame;

		// Dance tempo = BPM. Oscillator period in frames = 3600 / bpm (beats/sec at 60fps).
		let bpm = sharedBpm.getBpm();
		let beatFrames = Math.max(10, 3600 / Math.max(40, bpm));
		let phase = (frame / beatFrames) * Math.PI * 2;   // radians per full beat

		// Body bob (up/down with beat)
		if (Visualizer3D.#dancerBody) {
			let bob = Math.sin(phase) * (0.25 + bass * 0.5);
			Visualizer3D.#dancerBody.position.y = 1.1 + bob;
			Visualizer3D.#dancerBody.rotation.z = Math.sin(phase * 0.5) * 0.08;
		}

		// Head nod
		if (Visualizer3D.#dancerHead) {
			Visualizer3D.#dancerHead.rotation.x = Math.sin(phase * 1.0) * (0.15 + bass * 0.25);
			Visualizer3D.#dancerHead.rotation.y = Math.sin(phase * 0.5) * 0.1;
			Visualizer3D.#dancerHead.position.y = 1.7 + Math.sin(phase) * 0.15 * bass;
		}

		// Ears bounce (dog ears flop, guinea pig ears wiggle)
		for (let i = 0; i < Visualizer3D.#dancerEars.length; i++) {
			let ear = Visualizer3D.#dancerEars[i];
			let side = i === 0 ? -1 : 1;
			if (kind === "dog") {
				ear.rotation.x = Math.sin(phase * 2 + side * 0.3) * (0.25 + bass * 0.3);
			} else {
				ear.rotation.z = side * 0.2 + Math.sin(phase * 2 + side) * 0.3 * (0.3 + mid * 0.5);
			}
		}

		// Legs step alternately (diagonal pairs) on the beat
		for (let i = 0; i < Visualizer3D.#dancerLegs.length; i++) {
			let leg = Visualizer3D.#dancerLegs[i];
			// Diagonal pairing: 0 & 3 move together, 1 & 2 move together
			let pairPhase = (i === 0 || i === 3) ? 0 : Math.PI;
			let step = Math.sin(phase * 2 + pairPhase);
			leg.position.y = 0.5 + Math.max(0, step) * (0.15 + bass * 0.25);
		}

		// Tail wag (dog)
		if (Visualizer3D.#dancerTail) {
			Visualizer3D.#dancerTail.rotation.z = Math.sin(phase * 3) * (0.4 + bass * 0.6);
		}

		// Whole-body sway
		if (Visualizer3D.autoRotate) {
			Visualizer3D.#dancerGroup.rotation.y = Math.sin(phase * 0.25) * 0.4 + frame * 0.002;
			Visualizer3D.#dancerGroup.position.y = Math.sin(phase * 2) * 0.08 * mid;
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  CAMERA MOVEMENT MODES
	// ═══════════════════════════════════════════════

	/**
	 * Applies a time-based camera movement on top of the orbit transform.
	 * Uses `cameraMode` to pick the movement style. Only the relative offset
	 * is applied — #updateOrbit() then computes the final world position.
	 */
	static #applyCameraMovement() {
		Visualizer3D.#cameraFrame++;
		let mode = Visualizer3D.cameraMode;
		if (!mode || mode === "static") return;

		// Pause all automatic camera motion while the user is dragging the
		// mouse. This lets the user take manual control of the camera
		// without the auto-motion fighting them — on mouse-up the motion
		// resumes from wherever the user left off.
		if (Visualizer3D.#isDragging) return;

		let f = Visualizer3D.#cameraFrame;
		let bpm = sharedBpm.getBpm();
		let beatPhase = (f / Math.max(10, 3600 / Math.max(40, bpm))) * Math.PI * 2;

		switch (mode) {
			case "orbit":
				Visualizer3D.#orbitAngleX += 0.004;
				break;
			case "spiral":
				Visualizer3D.#orbitAngleX += 0.003;
				Visualizer3D.#orbitAngleY = 0.3 + Math.sin(f * 0.005) * 0.3;
				break;
			case "fly":
				Visualizer3D.#orbitAngleX += Math.sin(f * 0.003) * 0.004;
				Visualizer3D.#orbitDistance = Visualizer3D.#orbitDistance + Math.sin(f * 0.007) * 0.08;
				break;
			case "codesandbox":
				// Smooth spiral-in + pull-back tied to beat (inspired by the
				// codesandbox example). Distance pulses with each beat.
				Visualizer3D.#orbitAngleX += 0.0035;
				Visualizer3D.#orbitAngleY = 0.25 + Math.sin(f * 0.004) * 0.2;
				// Subtle zoom in/out
				let beatZoom = 1 + Math.sin(beatPhase) * 0.04;
				Visualizer3D.#orbitDistance *= beatZoom / (1 + Math.sin(beatPhase - 0.05) * 0.04);
				break;
		}
	}

	/**
	 * Handles window resize.
	 * @param {number} width
	 * @param {number} height
	 */
	static resize(width, height) {
		if (Visualizer3D.#renderer) {
			Visualizer3D.#renderer.setSize(width, height);
		}
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.aspect = width / height;
			Visualizer3D.#camera.updateProjectionMatrix();
		}
	}

	// ═══════════════════════════════════════════════
	//  POINT WAVE — 3D audio visualizer (port of the
	//  CodeSandbox reference: 267ty9-3000.csb.app).
	//
	//  Plane of 128×128 points, Z-displaced per-vertex by
	//      z = sin(u_data_arr[|x|]/48 + u_data_arr[|y|]/48) * amplitude
	//  producing a radially-symmetric sine interference pattern. The
	//  fragment shader remaps z/amplitude into a stepped color palette
	//  and we pair it with additive blending for the glowing look.
	//  A parent "cameraPole" slowly swings the camera in a Lissajous
	//  orbit while audio plays.
	// ═══════════════════════════════════════════════

	static #setupPointWave() {
		let segs = 128;
		let geo = new THREE.PlaneGeometry(segs / 2, segs / 2, segs, segs);

		// We pack 64 frequency bins into the u_data_arr uniform. The shader
		// reads bins at integer indices [0..63], indexed by |position.x| /
		// |position.y| (which for a 64-unit half-plane ranges 0..32, so we
		// safely clamp below).
		Visualizer3D.#pwUniforms = {
			u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
			u_time:       { value: 0 },
			u_mouse:      { value: new THREE.Vector2(0, 0) },
			u_data_arr:   { value: new Float32Array(64) },
			u_amplitude:  { value: 2.0 }
		};

		let vert = [
			"varying float amplitude;",
			"varying float z;",
			"uniform float u_amplitude;",
			"uniform float u_data_arr[64];",
			"void main() {",
			"  amplitude = u_amplitude;",
			"  float x = abs(position.x);",
			"  float y = abs(position.y);",
			"  float fx = floor(min(x, 63.0) + 0.5);",
			"  float fy = floor(min(y, 63.0) + 0.5);",
			"  z = sin(u_data_arr[int(fx)]/48.0 + u_data_arr[int(fy)]/48.0) * u_amplitude;",
			"  gl_PointSize = clamp(pow(floor(z*2.0 - 1.0), 2.0)/4.0, 2.0, 7.0);",
			"  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, z, 1.0);",
			"}"
		].join("\n");

		let frag = [
			"#ifdef GL_ES",
			"precision mediump float;",
			"#endif",
			"varying float amplitude;",
			"varying float z;",
			"void main() {",
			"  float intensity = smoothstep(1.0, 0.0, z / amplitude);",
			"  gl_FragColor = vec4(0.01, 0.0, 0.1, 0.2);",
			"  if (intensity > 0.3) {",
			"    gl_FragColor = vec4(intensity/12.0, intensity/15.0, 1.0 - min(intensity, 0.6), 0.3);",
			"  }",
			"  if (intensity > 0.8) {",
			"    gl_FragColor = vec4(0.3, 0.1, 0.8, 0.2);",
			"  }",
			"  if (intensity > 0.9999) {",
			"    gl_FragColor = vec4(0.0, 0.2, 0.6, 0.2);",
			"  }",
			"}"
		].join("\n");

		let mat = new THREE.ShaderMaterial({
			uniforms: Visualizer3D.#pwUniforms,
			vertexShader: vert,
			fragmentShader: frag,
			blending: THREE.AdditiveBlending,
			transparent: true,
			depthWrite: false
		});

		let mesh = new THREE.Points(geo, mat);
		mesh.rotation.x = Math.PI / 2;
		mesh.position.y = -20;   // drop the plane below eye level
		mesh.position.z = -80;   // and push it forward so the camera has
		                         // room to take in the full 128-unit span
		mesh.scale.x *= 2;
		mesh.scale.y *= 2;

		let group = new THREE.Group();
		group.add(mesh);
		Visualizer3D.#scene.add(group);

		// A parent cameraPole Object3D so we can swing the camera in an orbit.
		// We don't reparent Visualizer3D.#camera (it's shared with every other
		// 3D design), so we instead track the pole ourselves and write the
		// camera's world position from it in the render loop.
		Visualizer3D.#pwCameraPole = new THREE.Object3D();
		Visualizer3D.#scene.add(Visualizer3D.#pwCameraPole);

		Visualizer3D.#pwGroup = group;
		Visualizer3D.#pwMesh = mesh;
		Visualizer3D.#pwMaterial = mat;
		Visualizer3D.#pwGeometry = geo;
		Visualizer3D.#pwStartTime = performance.now() * 0.001;

		// Camera is pulled way back so the whole 128-unit plane comfortably
		// fits in the viewport at the default 50° FOV. Orbit/zoom controls
		// still work — users can dolly in closer if they want detail.
		if (Visualizer3D.#camera) {
			Visualizer3D.#camera.position.set(0, 80, 180);
			Visualizer3D.#camera.lookAt(0, -20, -80);
		}
	}

	static #renderPointWave(dataArray, bufferLength, barColor, toff) {
		if (!Visualizer3D.#pwMesh || !Visualizer3D.#pwUniforms) return 0;

		// Total energy for tre return; also downsample 256 bins → 64 for the
		// shader uniform (reference uses fftSize=512 → 256 bins, then reads
		// the first 64; we have 512 bins usually, so average groups of 8).
		let tre = 0;
		let uArr = Visualizer3D.#pwUniforms.u_data_arr.value;
		let group = Math.max(1, Math.floor(bufferLength / 64));
		for (let j = 0; j < 64; j++) {
			let s = 0, n = 0;
			let base = j * group;
			for (let k = 0; k < group && base + k < bufferLength; k++) {
				let v = Math.max(0, dataArray[base + k] + toff);
				s += v; n++;
				tre += v;
			}
			uArr[j] = n > 0 ? s / n : 0;
		}
		// tre covers only the first 64*group bins; sweep remaining bins.
		for (let i = 64 * group; i < bufferLength; i++) {
			tre += Math.max(0, dataArray[i] + toff);
		}

		let t = performance.now() * 0.001 - Visualizer3D.#pwStartTime;
		Visualizer3D.#pwUniforms.u_time.value = t;

		// Lissajous camera swing — orbits the plane at a comfortable
		// viewing distance so the whole grid remains in frame.
		if (Visualizer3D.autoRotate) {
			Visualizer3D.#pwCameraPole.rotation.y += 0.002;
			if (Visualizer3D.#camera) {
				let cx = 60 * Math.sin(t / 10);
				let cz = 180 + 25 * Math.sin(t / 15);
				let cy = 75 + 15 * Math.sin(t / 12);
				Visualizer3D.#camera.position.set(cx, cy, cz);
				Visualizer3D.#camera.lookAt(0, -20, -80);
			}
		}
		return tre;
	}
}
