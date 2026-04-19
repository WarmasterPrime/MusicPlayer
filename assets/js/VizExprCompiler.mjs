/**
 * Compiles expression strings (prefixed with "=") found in vizdesign JSON
 * into reusable JavaScript functions for 60fps render-loop evaluation.
 *
 * Expressions reference a scope object whose keys become local variables
 * inside the compiled function. Non-expression values pass through unchanged.
 */
export class VizExprCompiler {

	/** @type {Map<string, Function>} Compiled function cache keyed by expression source. */
	static #cache = new Map();

	/** Math helpers exposed inside every expression. */
	static #mathNames = [
		"sin", "cos", "tan", "asin", "acos", "atan", "atan2",
		"sqrt", "abs", "min", "max", "floor", "ceil", "round",
		"pow", "log", "exp", "sign", "trunc", "hypot"
	];

	/**
	 * Compiles a single expression string into a function.
	 * Non-expression values (no leading "=") are returned as-is.
	 *
	 * The returned function signature: `fn(scope) → value`
	 * where `scope` is a plain object whose own keys become variables.
	 *
	 * @param {*} expr - A string starting with "=" or any other value.
	 * @returns {Function|*} Compiled function or the original value.
	 */
	static compile(expr) {
		if (typeof expr !== "string" || expr.charAt(0) !== "=") return expr;

		let body = expr.slice(1).trim();
		if (VizExprCompiler.#cache.has(body)) return VizExprCompiler.#cache.get(body);

		// Build the function body: destructure scope, provide math helpers, return expression
		let fn;
		try {
			fn = new Function("$s",
				`"use strict";` +
				// Destructure math helpers
				`const {${VizExprCompiler.#mathNames.join(",")}} = Math;` +
				`const PI = Math.PI, TWO_PI = Math.PI * 2, random = Math.random;` +
				// Spread scope object into local variables via with-like destructuring
				// We use a Proxy-backed approach: the caller passes a scope, we eval against it
				`with($s){ return (${body}); }`
			);
		} catch (e) {
			console.error("[VizExprCompiler] Failed to compile:", body, e);
			fn = () => 0;
		}

		VizExprCompiler.#cache.set(body, fn);
		return fn;
	}

	/**
	 * Evaluates an expression or returns a literal.
	 * @param {Function|*} compiled - Output of compile().
	 * @param {object} scope - Current render scope.
	 * @returns {*}
	 */
	static eval(compiled, scope) {
		return typeof compiled === "function" ? compiled(scope) : compiled;
	}

	/**
	 * Deep-walks an object/array and compiles every "=" string in-place.
	 * Returns a new object (original is not mutated).
	 * @param {*} obj
	 * @returns {*}
	 */
	static compileObject(obj) {
		if (obj === null || obj === undefined) return obj;
		if (typeof obj === "string") return VizExprCompiler.compile(obj);
		if (Array.isArray(obj)) return obj.map(v => VizExprCompiler.compileObject(v));
		if (typeof obj === "object") {
			let out = {};
			for (let key of Object.keys(obj)) {
				out[key] = VizExprCompiler.compileObject(obj[key]);
			}
			return out;
		}
		return obj;
	}

	/**
	 * Clears the expression cache (useful for hot-reloading designs).
	 */
	static clearCache() {
		VizExprCompiler.#cache.clear();
	}
}
