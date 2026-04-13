import * as THREE from "./ext/three.module.mjs";

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

	// ═══════════════════════════════════════════════
	//  PUBLIC API
	// ═══════════════════════════════════════════════

	/**
	 * Checks if a design name is a 3D design.
	 * @param {string} name
	 * @returns {boolean}
	 */
	static is3D(name) {
		return name === "3dbars" || name === "3dwaves" || name === "3dsphere";
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

		// Ambient light
		Visualizer3D.#scene.add(new THREE.AmbientLight(0xffffff, 0.3));
		let dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dirLight.position.set(5, 10, 7);
		Visualizer3D.#scene.add(dirLight);

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
		}

		if (design === "3dbars") Visualizer3D.#setupBars();
		else if (design === "3dwaves") Visualizer3D.#setupWaves();
		else if (design === "3dsphere") Visualizer3D.#setupSphere();

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
		}

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

void main() {
  float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
  float displacement = (u_frequency / 30.0) * (noise / 10.0);
  vec3 newPosition = position + normal * displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

		let fragmentShader = `
uniform float u_red;
uniform float u_green;
uniform float u_blue;
void main() {
  gl_FragColor = vec4(u_red, u_green, u_blue, 1.0);
}
`;

		let material = new THREE.ShaderMaterial({
			uniforms: {
				u_time: { value: 0.0 },
				u_frequency: { value: 0.0 },
				u_red: { value: 1.0 },
				u_green: { value: 0.0 },
				u_blue: { value: 0.4 }
			},
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			wireframe: true
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

		return tre;
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
			if (!Visualizer3D.#active || !Visualizer3D.orbitEnabled) return;
			// Only start orbit drag with left mouse button on the main page area
			// (not inside modals, overlays, or UI controls)
			if (e.button !== 0) return;
			let target = e.target;
			if (target.closest(".modal-overlay, .opt-overlay, .modal-container, button, input, select, textarea, a, label")) return;

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
}
