import { VizExprCompiler as C } from "./VizExprCompiler.mjs";
import { Color } from "./Color.mjs";

/**
 * Runtime engine for loading, compiling, and rendering 2D vizdesign JSON files.
 * Handles the full pipeline: fetch → parse → compile expressions → execute render steps at 60fps.
 */
export class VizEngine {

	/** @type {Map<string, object>} name → compiled design object */
	static #designs = new Map();

	/** @type {object|null} Currently active compiled design */
	static #activeDesign = null;

	/** @type {Map<string, Array>} design name → particle arrays */
	static #particleState = new Map();

	/** @type {Map<string, object>} design name → custom state (tetris grid, etc.) */
	static #customState = new Map();

	/** Frame counter for time-based effects */
	static #frame = 0;

	/** @type {Array} Manifest entries [{name, label, file, type}] */
	static #manifest = [];

	/** Base path for design files */
	static #basePath = "assets/designs/";

	// ═══════════════════════════════════════════════
	//  LOADING
	// ═══════════════════════════════════════════════

	/**
	 * Loads the manifest and all design files.
	 */
	static async loadManifest() {
		try {
			let resp = await fetch(VizEngine.#basePath + "manifest.json");
			let data = await resp.json();
			VizEngine.#manifest = data.designs || [];
			// Pre-load all designs
			let promises = VizEngine.#manifest.map(entry => VizEngine.loadDesign(entry.name, entry.file));
			await Promise.all(promises);
		} catch (e) {
			console.error("[VizEngine] Failed to load manifest:", e);
		}
	}

	/**
	 * Loads and compiles a single design file.
	 * @param {string} name
	 * @param {string} file
	 */
	static async loadDesign(name, file) {
		try {
			let resp = await fetch(VizEngine.#basePath + file);
			let raw = await resp.json();
			let compiled = VizEngine.#compileDesign(raw);
			VizEngine.#designs.set(name, compiled);
		} catch (e) {
			console.error("[VizEngine] Failed to load design:", name, e);
		}
	}

	/**
	 * Compiles all expressions in a raw design object.
	 */
	static #compileDesign(raw) {
		let d = {};
		d.name = raw.name;
		d.label = raw.label;
		d.type = raw.type;
		d.version = raw.version;
		d.description = raw.description;
		d.audio = raw.audio || { toff: 150, bassRange: 0.03, bassNormDivisor: 150 };
		d.config = raw.config || {};

		// Compile render steps
		d.render = VizEngine.#compileSteps(raw.render?.steps || []);

		// Compile particles
		if (raw.particles) {
			if (Array.isArray(raw.particles)) {
				d.particles = raw.particles.map(p => VizEngine.#compileParticleDef(p));
			} else {
				d.particles = [VizEngine.#compileParticleDef(raw.particles)];
			}
		} else {
			d.particles = null;
		}

		// Compile subroutines
		d.subroutines = {};
		if (raw.subroutines) {
			for (let [name, sub] of Object.entries(raw.subroutines)) {
				d.subroutines[name] = {
					params: sub.params || [],
					steps: VizEngine.#compileSteps(sub.steps || [])
				};
			}
		}

		return d;
	}

	static #compileSteps(steps) {
		return steps.map(step => VizEngine.#compileStep(step));
	}

	static #compileStep(step) {
		let s = { type: step.type };
		switch (step.type) {
			case "loop":
				s.var = step.var;
				s.from = C.compile(step.from);
				s.to = C.compile(step.to);
				s.direction = step.direction || "up";
				s.body = VizEngine.#compileSteps(step.body || []);
				break;

			case "let":
				s.name = step.name;
				s.expr = C.compile(step.expr);
				break;

			case "setStyle":
				s.prop = step.prop;
				s.expr = C.compile(step.expr);
				break;

			case "fillRect":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				s.w = C.compile(step.w);
				s.h = C.compile(step.h);
				break;

			case "strokeLine":
				s.x1 = C.compile(step.x1);
				s.y1 = C.compile(step.y1);
				s.x2 = C.compile(step.x2);
				s.y2 = C.compile(step.y2);
				break;

			case "arc":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				s.r = C.compile(step.r);
				s.startAngle = C.compile(step.startAngle ?? 0);
				s.endAngle = C.compile(step.endAngle ?? "=TWO_PI");
				s.fill = step.fill != null ? C.compile(step.fill) : null;
				s.stroke = step.stroke != null ? C.compile(step.stroke) : null;
				s.lineWidth = step.lineWidth != null ? C.compile(step.lineWidth) : null;
				s.counterClockwise = step.counterClockwise || false;
				break;

			case "ellipse":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				s.rx = C.compile(step.rx);
				s.ry = C.compile(step.ry);
				s.rotation = C.compile(step.rotation ?? 0);
				s.startAngle = C.compile(step.startAngle ?? 0);
				s.endAngle = C.compile(step.endAngle ?? "=TWO_PI");
				s.fill = step.fill != null ? C.compile(step.fill) : null;
				s.stroke = step.stroke != null ? C.compile(step.stroke) : null;
				break;

			case "path": {
				s.commands = (step.commands || []).map(cmd => {
					let c = { op: cmd.op };
					if (cmd.x !== undefined) c.x = C.compile(cmd.x);
					if (cmd.y !== undefined) c.y = C.compile(cmd.y);
					if (cmd.cpx !== undefined) c.cpx = C.compile(cmd.cpx);
					if (cmd.cpy !== undefined) c.cpy = C.compile(cmd.cpy);
					if (cmd.cp1x !== undefined) c.cp1x = C.compile(cmd.cp1x);
					if (cmd.cp1y !== undefined) c.cp1y = C.compile(cmd.cp1y);
					if (cmd.cp2x !== undefined) c.cp2x = C.compile(cmd.cp2x);
					if (cmd.cp2y !== undefined) c.cp2y = C.compile(cmd.cp2y);
					if (cmd.r !== undefined) c.r = C.compile(cmd.r);
					if (cmd.startAngle !== undefined) c.startAngle = C.compile(cmd.startAngle);
					if (cmd.endAngle !== undefined) c.endAngle = C.compile(cmd.endAngle);
					if (cmd.counterClockwise !== undefined) c.counterClockwise = cmd.counterClockwise;
					return c;
				});
				s.fill = step.fill != null ? C.compile(step.fill) : null;
				s.stroke = step.stroke != null ? C.compile(step.stroke) : null;
				s.lineWidth = step.lineWidth != null ? C.compile(step.lineWidth) : null;
				s.lineCap = step.lineCap || null;
				s.fillRule = step.fillRule || null;
				s.closePath = step.closePath || false;
				break;
			}

			case "conditional":
				s.condition = C.compile(step.condition);
				s.then = VizEngine.#compileSteps(step.then || []);
				s.else = VizEngine.#compileSteps(step.else || []);
				break;

			// ── Atomic canvas operations (for incremental path building) ──
			case "beginPath":
				break;

			case "moveTo":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				break;

			case "lineTo":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				break;

			case "quadraticCurveTo":
				s.cpx = C.compile(step.cpx);
				s.cpy = C.compile(step.cpy);
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				break;

			case "closePath":
				break;

			case "fill":
				s.style = step.style != null ? C.compile(step.style) : null;
				s.fillRule = step.fillRule || null;
				break;

			case "doStroke":
				s.style = step.style != null ? C.compile(step.style) : null;
				break;

			case "drawArrayPath": {
				s.arrays = step.arrays || [];
				s.stroke = step.stroke != null ? C.compile(step.stroke) : null;
				s.fill = step.fill != null ? C.compile(step.fill) : null;
				s.lineWidth = step.lineWidth != null ? C.compile(step.lineWidth) : null;
				s.lineCap = step.lineCap || null;
				s.startX = step.startX != null ? C.compile(step.startX) : null;
				s.startY = step.startY != null ? C.compile(step.startY) : null;
				s.endX = step.endX != null ? C.compile(step.endX) : null;
				s.endY = step.endY != null ? C.compile(step.endY) : null;
				s.closePath = step.closePath || false;
				s.fillRule = step.fillRule || null;
				s.curve = step.curve || false;
				s.perPointStroke = step.perPointStroke || false;
				break;
			}

			case "save":
			case "restore":
				// No additional params
				break;

			case "shadow":
				s.color = step.color != null ? C.compile(step.color) : null;
				s.blur = step.blur != null ? C.compile(step.blur) : null;
				break;

			case "clearShadow":
				break;

			case "gradient": {
				s.gradType = step.gradType || "linear";
				s.x0 = C.compile(step.x0);
				s.y0 = C.compile(step.y0);
				s.x1 = C.compile(step.x1);
				s.y1 = C.compile(step.y1);
				if (step.r0 !== undefined) s.r0 = C.compile(step.r0);
				if (step.r1 !== undefined) s.r1 = C.compile(step.r1);
				s.stops = (step.stops || []).map(st => ({
					offset: C.compile(st.offset),
					color: C.compile(st.color)
				}));
				s.assignTo = step.assignTo || "fillStyle";
				break;
			}

			case "roundRect":
				s.x = C.compile(step.x);
				s.y = C.compile(step.y);
				s.w = C.compile(step.w);
				s.h = C.compile(step.h);
				s.radii = C.compile(step.radii);
				s.fill = step.fill != null ? C.compile(step.fill) : null;
				s.stroke = step.stroke != null ? C.compile(step.stroke) : null;
				s.lineWidth = step.lineWidth != null ? C.compile(step.lineWidth) : null;
				break;

			case "call":
				s.name = step.name;
				s.args = (step.args || []).map(a => C.compile(a));
				break;

			case "accumulate":
				s.var = step.var;
				s.expr = C.compile(step.expr);
				break;

			case "initArray":
				s.array = step.array;
				break;

			case "pushArray":
				s.array = step.array;
				s.value = C.compileObject(step.value);
				break;

			case "forEachArray":
				s.array = step.array;
				s.itemVar = step.itemVar || "item";
				s.indexVar = step.indexVar || "idx";
				s.body = VizEngine.#compileSteps(step.body || []);
				break;

			case "return":
				break;

			default:
				// Copy all fields with compilation
				for (let k of Object.keys(step)) {
					if (k !== "type" && !(k in s)) {
						s[k] = C.compileObject(step[k]);
					}
				}
		}
		return s;
	}

	static #compileParticleDef(p) {
		return {
			name: p.name,
			maxCount: p.maxCount || 1000,
			spawn: {
				condition: C.compile(p.spawn?.condition ?? "=true"),
				count: C.compile(p.spawn?.count ?? 1),
				properties: C.compileObject(p.spawn?.properties || {})
			},
			update: {
				locals: C.compileObject(p.update?.locals || {}),
				rules: (p.update?.rules || []).map(r => ({
					prop: r.prop,
					expr: C.compile(r.expr)
				}))
			},
			remove: {
				condition: C.compile(p.remove?.condition ?? "=false")
			},
			draw: {
				steps: VizEngine.#compileSteps(p.draw?.steps || [])
			}
		};
	}

	// ═══════════════════════════════════════════════
	//  PUBLIC API
	// ═══════════════════════════════════════════════

	/**
	 * Sets the active design by name.
	 * @param {string} name
	 */
	static setActive(name) {
		let design = VizEngine.#designs.get(name);
		if (!design) return;
		if (VizEngine.#activeDesign !== design) {
			VizEngine.#activeDesign = design;
			// Reset particle state for new design
			if (design.particles) {
				for (let pd of design.particles) {
					VizEngine.#particleState.set(pd.name, []);
				}
			}
			// Reset custom state
			VizEngine.#customState.delete(name);
		}
	}

	/**
	 * Returns the list of all loaded designs for building dropdowns.
	 * @returns {Array<{name: string, label: string, type: string}>}
	 */
	static getDesignList() {
		return VizEngine.#manifest.map(e => ({ name: e.name, label: e.label, type: e.type }));
	}

	/**
	 * Returns whether a design name is a 3D design.
	 * @param {string} name
	 * @returns {boolean}
	 */
	static is3D(name) {
		let entry = VizEngine.#manifest.find(e => e.name === name);
		return entry ? entry.type === "3d" : false;
	}

	/**
	 * Returns the compiled design object by name.
	 * @param {string} name
	 * @returns {object|undefined}
	 */
	static getDesign(name) {
		return VizEngine.#designs.get(name);
	}

	/**
	 * Whether the engine has loaded designs.
	 */
	static get loaded() {
		return VizEngine.#designs.size > 0;
	}

	/**
	 * Renders the active design for one frame.
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Float32Array} dataArray
	 * @param {number} bufferLength
	 * @param {object} barColor - { r, g, b }
	 * @param {object} viz - The viz state object
	 * @param {object} [visualRef] - Reference to Visual class for static props
	 * @returns {number} Total energy (tre)
	 */
	static render(ctx, dataArray, bufferLength, barColor, viz, visualRef) {
		let d = VizEngine.#activeDesign;
		if (!d) return 0;

		VizEngine.#frame++;
		let scope = VizEngine.#buildScope(d, dataArray, bufferLength, barColor, viz, visualRef);

		// Particle systems
		if (d.particles) {
			for (let pd of d.particles) {
				VizEngine.#runParticleSystem(pd, ctx, scope);
			}
		}

		// Main render steps
		VizEngine.#executeSteps(d.render, ctx, scope, d);

		return scope.tre;
	}

	// ═══════════════════════════════════════════════
	//  SCOPE BUILDING
	// ═══════════════════════════════════════════════

	static #buildScope(design, dataArray, bufferLength, barColor, viz, visualRef) {
		let toff = design.audio.toff || 150;

		// Calculate bass
		let bassRange = design.audio.bassRange || 0.03;
		let bassBins = Math.max(1, Math.min(8, Math.floor(bufferLength * bassRange)));
		let bassSum = 0;
		let tre = 0;

		for (let i = 0; i < bassBins; i++) {
			let val = Math.max(0, dataArray[i] + toff);
			bassSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * (design.audio.bassNormDivisor || 150)));

		// Calculate mid
		let midStart = bassBins;
		let midEnd = bufferLength;
		if (design.audio.midRange) {
			midStart = Math.floor(bufferLength * design.audio.midRange[0]);
			midEnd = Math.min(bufferLength, Math.floor(bufferLength * design.audio.midRange[1]));
		}
		let midSum = 0;
		let totalEnergy = 0;
		for (let i = bassBins; i < bufferLength; i++) {
			let val = Math.max(0, dataArray[i] + toff);
			tre += val;
			totalEnergy += val;
			if (i >= midStart && i < midEnd) midSum += val;
		}
		let mid = Math.min(1.0, midSum / (Math.max(1, midEnd - midStart) * (design.audio.midNormDivisor || 100)));
		let energyNorm = Math.min(1.0, totalEnergy / (Math.max(1, bufferLength - bassBins) * 120));
		let totalNorm = Math.min(1.0, tre / (bufferLength * 100));

		return {
			// Audio data
			data: dataArray,
			binCount: bufferLength,
			toff: toff,
			bass: bass,
			mid: mid,
			totalEnergy: totalEnergy,
			energyNorm: energyNorm,
			totalNorm: totalNorm,
			tre: tre,
			bassBins: bassBins,

			// Canvas dimensions
			width: viz.width,
			height: viz.height,

			// Bar config
			barWidth: viz.bar.width,
			barHeight: viz.bar.height,
			maxHeight: viz.bar.maxHeight,
			xOffset: visualRef?.xOffset ?? -1,

			// Colors (0-255)
			r: barColor.r,
			g: barColor.g,
			b: barColor.b,

			// Time
			time: performance.now() * 0.001,
			frame: VizEngine.#frame,

			// Config from Visual class
			fillPolygon: visualRef?.fillPolygon ?? true,
			polygonSides: visualRef?.polygonSides ?? 6,
			waterViscosity: visualRef?.waterViscosity ?? 0.92,
			waterTension: visualRef?.waterTension ?? 0.025,
			waterSpread: visualRef?.waterSpread ?? 0.25,

			// Custom state for this design
			_state: VizEngine.#getCustomState(VizEngine.#activeDesign?.name),

			// Temporary arrays for path building etc.
			_arrays: {},

			// Color helper
			Color: Color,
		};
	}

	static #getCustomState(name) {
		if (!name) return {};
		if (!VizEngine.#customState.has(name)) {
			VizEngine.#customState.set(name, {});
		}
		return VizEngine.#customState.get(name);
	}

	// ═══════════════════════════════════════════════
	//  STEP EXECUTION
	// ═══════════════════════════════════════════════

	static #executeSteps(steps, ctx, scope, design) {
		for (let i = 0; i < steps.length; i++) {
			let result = VizEngine.#executeStep(steps[i], ctx, scope, design);
			if (result === "__return__") return result;
		}
	}

	static #executeStep(step, ctx, scope, design) {
		switch (step.type) {

			case "loop":
				return VizEngine.#runLoop(step, ctx, scope, design);

			case "let":
				scope[step.name] = C.eval(step.expr, scope);
				break;

			case "setStyle":
				ctx[step.prop] = C.eval(step.expr, scope);
				break;

			case "fillRect":
				ctx.fillRect(
					C.eval(step.x, scope),
					C.eval(step.y, scope),
					C.eval(step.w, scope),
					C.eval(step.h, scope)
				);
				break;

			case "strokeLine": {
				let x1 = C.eval(step.x1, scope);
				let y1 = C.eval(step.y1, scope);
				let x2 = C.eval(step.x2, scope);
				let y2 = C.eval(step.y2, scope);
				ctx.beginPath();
				ctx.moveTo(x1, y1);
				ctx.lineTo(x2, y2);
				ctx.stroke();
				break;
			}

			case "arc": {
				let x = C.eval(step.x, scope);
				let y = C.eval(step.y, scope);
				let r = C.eval(step.r, scope);
				let sa = C.eval(step.startAngle, scope);
				let ea = C.eval(step.endAngle, scope);
				if (step.lineWidth != null) ctx.lineWidth = C.eval(step.lineWidth, scope);
				ctx.beginPath();
				ctx.arc(x, y, r, sa, ea, step.counterClockwise);
				if (step.fill != null) {
					ctx.fillStyle = C.eval(step.fill, scope);
					ctx.fill();
				}
				if (step.stroke != null) {
					ctx.strokeStyle = C.eval(step.stroke, scope);
					ctx.stroke();
				}
				break;
			}

			case "ellipse": {
				let x = C.eval(step.x, scope);
				let y = C.eval(step.y, scope);
				let rx = C.eval(step.rx, scope);
				let ry = C.eval(step.ry, scope);
				let rot = C.eval(step.rotation, scope);
				let sa = C.eval(step.startAngle, scope);
				let ea = C.eval(step.endAngle, scope);
				ctx.beginPath();
				ctx.ellipse(x, y, rx, ry, rot, sa, ea);
				if (step.fill != null) {
					ctx.fillStyle = C.eval(step.fill, scope);
					ctx.fill();
				}
				if (step.stroke != null) {
					ctx.strokeStyle = C.eval(step.stroke, scope);
					ctx.stroke();
				}
				break;
			}

			case "path": {
				if (step.lineWidth != null) ctx.lineWidth = C.eval(step.lineWidth, scope);
				if (step.lineCap) ctx.lineCap = step.lineCap;
				ctx.beginPath();
				for (let cmd of step.commands) {
					switch (cmd.op) {
						case "moveTo":
							ctx.moveTo(C.eval(cmd.x, scope), C.eval(cmd.y, scope));
							break;
						case "lineTo":
							ctx.lineTo(C.eval(cmd.x, scope), C.eval(cmd.y, scope));
							break;
						case "quadraticCurveTo":
							ctx.quadraticCurveTo(
								C.eval(cmd.cpx, scope), C.eval(cmd.cpy, scope),
								C.eval(cmd.x, scope), C.eval(cmd.y, scope)
							);
							break;
						case "bezierCurveTo":
							ctx.bezierCurveTo(
								C.eval(cmd.cp1x, scope), C.eval(cmd.cp1y, scope),
								C.eval(cmd.cp2x, scope), C.eval(cmd.cp2y, scope),
								C.eval(cmd.x, scope), C.eval(cmd.y, scope)
							);
							break;
						case "arc":
							ctx.arc(
								C.eval(cmd.x, scope), C.eval(cmd.y, scope),
								C.eval(cmd.r, scope),
								C.eval(cmd.startAngle, scope), C.eval(cmd.endAngle, scope),
								cmd.counterClockwise || false
							);
							break;
						case "closePath":
							ctx.closePath();
							break;
					}
				}
				if (step.closePath) ctx.closePath();
				if (step.fill != null) {
					ctx.fillStyle = C.eval(step.fill, scope);
					if (step.fillRule) ctx.fill(step.fillRule);
					else ctx.fill();
				}
				if (step.stroke != null) {
					ctx.strokeStyle = C.eval(step.stroke, scope);
					ctx.stroke();
				}
				break;
			}

			case "conditional":
				if (C.eval(step.condition, scope)) {
					let result = VizEngine.#executeSteps(step.then, ctx, scope, design);
					if (result === "__return__") return result;
				} else if (step.else && step.else.length > 0) {
					let result = VizEngine.#executeSteps(step.else, ctx, scope, design);
					if (result === "__return__") return result;
				}
				break;

			// ── Atomic canvas operations ──
			case "beginPath":
				ctx.beginPath();
				break;

			case "moveTo":
				ctx.moveTo(C.eval(step.x, scope), C.eval(step.y, scope));
				break;

			case "lineTo":
				ctx.lineTo(C.eval(step.x, scope), C.eval(step.y, scope));
				break;

			case "quadraticCurveTo":
				ctx.quadraticCurveTo(
					C.eval(step.cpx, scope), C.eval(step.cpy, scope),
					C.eval(step.x, scope), C.eval(step.y, scope)
				);
				break;

			case "closePath":
				ctx.closePath();
				break;

			case "fill":
				if (step.style != null) ctx.fillStyle = C.eval(step.style, scope);
				if (step.fillRule) ctx.fill(step.fillRule);
				else ctx.fill();
				break;

			case "doStroke":
				if (step.style != null) ctx.strokeStyle = C.eval(step.style, scope);
				ctx.stroke();
				break;

			case "drawArrayPath": {
				let arrays = step.arrays.map(name => scope._arrays[name] || []);
				if (step.lineWidth != null) ctx.lineWidth = C.eval(step.lineWidth, scope);
				if (step.lineCap) ctx.lineCap = step.lineCap;
				ctx.beginPath();
				if (step.startX != null) {
					ctx.moveTo(C.eval(step.startX, scope), C.eval(step.startY, scope));
				}
				for (let arr of arrays) {
					for (let pt of arr) {
						if (step.curve && pt._prev) {
							let cpx = (pt._prev.x + pt.x) / 2;
							let cpy = (pt._prev.y + pt.y) / 2;
							ctx.quadraticCurveTo(pt._prev.x, pt._prev.y, cpx, cpy);
						} else {
							ctx.lineTo(pt.x, pt.y);
						}
					}
				}
				if (step.endX != null) {
					ctx.lineTo(C.eval(step.endX, scope), C.eval(step.endY, scope));
				}
				if (step.closePath) ctx.closePath();
				if (step.fill != null) {
					ctx.fillStyle = C.eval(step.fill, scope);
					if (step.fillRule) ctx.fill(step.fillRule);
					else ctx.fill();
				}
				if (step.stroke != null) {
					ctx.strokeStyle = C.eval(step.stroke, scope);
					ctx.stroke();
				}
				break;
			}

			case "save":
				ctx.save();
				break;

			case "restore":
				ctx.restore();
				break;

			case "shadow":
				if (step.color != null) ctx.shadowColor = C.eval(step.color, scope);
				if (step.blur != null) ctx.shadowBlur = C.eval(step.blur, scope);
				break;

			case "clearShadow":
				ctx.shadowColor = "transparent";
				ctx.shadowBlur = 0;
				break;

			case "gradient": {
				let grad;
				if (step.gradType === "radial") {
					grad = ctx.createRadialGradient(
						C.eval(step.x0, scope), C.eval(step.y0, scope), C.eval(step.r0, scope),
						C.eval(step.x1, scope), C.eval(step.y1, scope), C.eval(step.r1, scope)
					);
				} else {
					grad = ctx.createLinearGradient(
						C.eval(step.x0, scope), C.eval(step.y0, scope),
						C.eval(step.x1, scope), C.eval(step.y1, scope)
					);
				}
				for (let st of step.stops) {
					grad.addColorStop(C.eval(st.offset, scope), C.eval(st.color, scope));
				}
				ctx[step.assignTo || "fillStyle"] = grad;
				break;
			}

			case "roundRect": {
				let x = C.eval(step.x, scope);
				let y = C.eval(step.y, scope);
				let w = C.eval(step.w, scope);
				let h = C.eval(step.h, scope);
				let radii = C.eval(step.radii, scope);
				if (step.lineWidth != null) ctx.lineWidth = C.eval(step.lineWidth, scope);
				ctx.beginPath();
				ctx.roundRect(x, y, w, h, radii);
				if (step.fill != null) {
					ctx.fillStyle = C.eval(step.fill, scope);
					ctx.fill();
				}
				if (step.stroke != null) {
					ctx.strokeStyle = C.eval(step.stroke, scope);
					ctx.stroke();
				}
				break;
			}

			case "call":
				return VizEngine.#callSubroutine(step, ctx, scope, design, 0);

			case "accumulate":
				scope[step.var] = C.eval(step.expr, scope);
				break;

			case "initArray":
				scope._arrays[step.array] = [];
				break;

			case "pushArray": {
				let arr = scope._arrays[step.array];
				if (!arr) { arr = []; scope._arrays[step.array] = arr; }
				let val = {};
				for (let [k, v] of Object.entries(step.value)) {
					val[k] = C.eval(v, scope);
				}
				arr.push(val);
				break;
			}

			case "forEachArray": {
				let arr = scope._arrays[step.array];
				if (arr) {
					for (let idx = 0; idx < arr.length; idx++) {
						scope[step.itemVar] = arr[idx];
						scope[step.indexVar] = idx;
						VizEngine.#executeSteps(step.body, ctx, scope, design);
					}
				}
				break;
			}

			case "return":
				return "__return__";
		}
	}

	static #runLoop(step, ctx, scope, design) {
		let from = C.eval(step.from, scope);
		let to = C.eval(step.to, scope);

		if (step.direction === "down") {
			for (let i = from; i >= to; i--) {
				scope[step.var] = i;
				let result = VizEngine.#executeSteps(step.body, ctx, scope, design);
				if (result === "__return__") return result;
			}
		} else {
			for (let i = from; i < to; i++) {
				scope[step.var] = i;
				let result = VizEngine.#executeSteps(step.body, ctx, scope, design);
				if (result === "__return__") return result;
			}
		}
	}

	static #callSubroutine(step, ctx, scope, design, depth) {
		if (depth > 10) return; // Recursion depth limit
		let sub = design?.subroutines?.[step.name];
		if (!sub) return;

		// Build subscope with args
		let subScope = Object.create(scope);
		let args = step.args || [];
		for (let i = 0; i < sub.params.length; i++) {
			subScope[sub.params[i]] = C.eval(args[i], scope);
		}
		subScope.__callDepth = depth + 1;

		// Execute steps, handling nested calls with incremented depth
		for (let s of sub.steps) {
			if (s.type === "call") {
				let result = VizEngine.#callSubroutineInner(s, ctx, subScope, design, depth + 1);
				if (result === "__return__") return;
			} else {
				let result = VizEngine.#executeStep(s, ctx, subScope, design);
				if (result === "__return__") return;
			}
		}
	}

	static #callSubroutineInner(step, ctx, scope, design, depth) {
		if (depth > 10) return;
		let sub = design?.subroutines?.[step.name];
		if (!sub) return;

		let subScope = Object.create(scope);
		let args = step.args || [];
		for (let i = 0; i < sub.params.length; i++) {
			subScope[sub.params[i]] = C.eval(args[i], scope);
		}

		for (let s of sub.steps) {
			if (s.type === "call") {
				let result = VizEngine.#callSubroutineInner(s, ctx, subScope, design, depth + 1);
				if (result === "__return__") return result;
			} else {
				let result = VizEngine.#executeStep(s, ctx, subScope, design);
				if (result === "__return__") return result;
			}
		}
	}

	// ═══════════════════════════════════════════════
	//  PARTICLE SYSTEMS
	// ═══════════════════════════════════════════════

	static #runParticleSystem(pd, ctx, scope) {
		let particles = VizEngine.#particleState.get(pd.name);
		if (!particles) {
			particles = [];
			VizEngine.#particleState.set(pd.name, particles);
		}

		// Spawn
		if (C.eval(pd.spawn.condition, scope)) {
			let count = Math.floor(C.eval(pd.spawn.count, scope));
			for (let s = 0; s < count; s++) {
				if (particles.length >= pd.maxCount) break;
				let p = {};
				for (let [key, expr] of Object.entries(pd.spawn.properties)) {
					p[key] = C.eval(expr, scope);
				}
				particles.push(p);
			}
		}

		// Compute locals
		let locals = {};
		for (let [key, expr] of Object.entries(pd.update.locals)) {
			locals[key] = C.eval(expr, scope);
		}

		// Update and remove (reverse iteration for splice safety)
		for (let i = particles.length - 1; i >= 0; i--) {
			let p = particles[i];

			// Inject particle and locals into scope
			scope.p = p;
			Object.assign(scope, locals);

			// Apply update rules
			for (let rule of pd.update.rules) {
				p[rule.prop] = C.eval(rule.expr, scope);
			}

			// Check removal
			if (C.eval(pd.remove.condition, scope)) {
				// Run pre-remove draw if any (e.g., splash effects)
				particles.splice(i, 1);
				continue;
			}
		}

		// Cap particle count
		if (particles.length > pd.maxCount) {
			particles.splice(0, particles.length - pd.maxCount);
		}

		// Draw each particle
		for (let i = 0; i < particles.length; i++) {
			scope.p = particles[i];
			scope.particleIndex = i;
			Object.assign(scope, locals);
			VizEngine.#executeSteps(pd.draw.steps, ctx, scope, VizEngine.#activeDesign);
		}

		// Clean up scope
		delete scope.p;
		delete scope.particleIndex;
	}
}
