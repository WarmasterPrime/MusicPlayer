/**
 * Interactive first-time visitor tutorial for MusicPlayer.
 *
 * Shows a spotlight overlay with guided tooltip cards that include a
 * pointing arrow directed at the highlighted UI element. Panels that
 * auto-hide (left-panel, right menu) are temporarily revealed while
 * the tutorial is pointing at something inside them.
 *
 * localStorage key "mp-tutorial-v1-done" tracks whether it has been shown.
 *
 * Usage:
 *   Tutorial.start()       — auto-start (skips if already seen)
 *   Tutorial.startForce()  — always start regardless of history
 */
export class Tutorial {

	// ── Private state ───────────────────────────────────────────────────
	static #overlay    = null; // darkening wings container
	static #card       = null; // floating tooltip card
	static #arrow      = null; // pointing arrow element
	static #step       = 0;
	static #revealEls  = [];   // elements we forced visible this step

	static #STORAGE_KEY = "mp-tutorial-v1-done";

	// ── Step definitions ────────────────────────────────────────────────
	/**
	 * Each step:
	 *   target?      — primary CSS selector (first match wins; falls back to altTargets)
	 *   altTargets[] — additional selectors to try if target not found
	 *   reveal[]     — selectors of panels that need `.visible` class while this step is active
	 *   title/body/icon — card content
	 *   pos          — "above" | "below" | "left" | "right" | "center"
	 *   last         — marks final step
	 */
	static #steps = [
		{
			target: null,
			title:  "Welcome to MusicPlayer!",
			body:   "An audio-reactive visualizer that comes alive with every beat. Take a quick 30-second tour to discover what's here.",
			icon:   "🎵"
		},
		{
			target: "canvas",
			title:  "The Visualizer",
			body:   "The whole screen reacts to your music. Bars, particles, 3D spheres, lightning, cymatic sand — each frequency becomes visual.",
			icon:   "🎨",
			pos:    "center"
		},
		{
			target:     "#settings-btn",
			reveal:     ["#left-panel"],
			title:      "Customize Everything",
			body:       "Hover the left edge and click the gear ⚙. Pick from 20+ designs, tune colors, 3D lighting, particle effects, and build your own page layout — all applied live.",
			icon:       "⚙️",
			pos:        "right"
		},
		{
			target:     "#menu-tab",
			altTargets: ["#menu-trigger"],
			reveal:     ["#menu-tab"],
			title:      "Your Music Library",
			body:       "Hover the right edge to open the Songs panel. Upload any audio file or search the library — the visualizer reacts the moment music plays.",
			icon:       "🎧",
			pos:        "left"
		},
		{
			target:     "#login-btn-nav",
			altTargets: ["#register-btn-nav", "#auth-buttons"],
			reveal:     ["#left-panel"],
			title:      "Save Your Creations",
			body:       "Sign up free to save your layouts, playlists, and custom visual setups. Everything syncs across all your devices.",
			icon:       "☁️",
			pos:        "right"
		},
		{
			target: null,
			title:  "You're All Set! 🚀",
			body:   "Enjoy the show! You can replay this tour any time from your Profile settings.",
			icon:   "✨",
			last:   true
		}
	];

	// ═══════════════════════════════════════════════
	//  PUBLIC API
	// ═══════════════════════════════════════════════

	/**
	 * Starts the tutorial. Skips silently if the user has already completed it.
	 */
	static start() {
		if (localStorage.getItem(Tutorial.#STORAGE_KEY)) return;
		Tutorial.startForce();
	}

	/**
	 * Always starts the tutorial, ignoring whether it was previously shown.
	 */
	static startForce() {
		Tutorial.#step = 0;
		Tutorial.#create();
		Tutorial.#render();
	}

	/**
	 * Immediately closes and permanently dismisses the tutorial.
	 */
	static done() {
		localStorage.setItem(Tutorial.#STORAGE_KEY, "1");
		Tutorial.#destroy();
	}

	// ═══════════════════════════════════════════════
	//  DOM CONSTRUCTION
	// ═══════════════════════════════════════════════

	static #create() {
		Tutorial.#destroy();

		// Backdrop (four darkening wings + spotlight ring go here).
		// Fixed position so child coords map 1:1 with viewport rects.
		let bg = document.createElement("div");
		bg.id = "tutorial-bg";
		bg.style.cssText = "position:fixed;inset:0;z-index:9998;pointer-events:none;";
		Tutorial.#overlay = bg;
		document.body.appendChild(bg);

		// Pointing arrow (fixed positioned, hidden until a target is set)
		let arrow = document.createElement("div");
		arrow.id = "tutorial-arrow";
		arrow.style.cssText = [
			"position:fixed;z-index:9999;pointer-events:none;",
			"width:22px;height:22px;",
			"transform:rotate(0deg);transform-origin:center;",
			"transition:opacity 0.2s,top 0.25s,left 0.25s,transform 0.25s;",
			"opacity:0;"
		].join("");
		arrow.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">' +
			'<path d="M11 1 L21 21 L11 16 L1 21 Z" fill="rgba(100,170,255,0.95)" ' +
			'stroke="rgba(220,235,255,0.85)" stroke-width="1.2" stroke-linejoin="round"/></svg>';
		Tutorial.#arrow = arrow;
		document.body.appendChild(arrow);

		// Floating tooltip card
		let card = document.createElement("div");
		card.id = "tutorial-card";
		card.style.cssText = [
			"position:fixed;z-index:9999;",
			"background:linear-gradient(135deg,rgba(10,12,28,0.98),rgba(18,22,48,0.98));",
			"border:1px solid rgba(110,155,255,0.35);border-radius:14px;",
			"padding:22px 26px 18px;max-width:320px;min-width:250px;",
			"box-shadow:0 14px 55px rgba(0,0,0,0.9),0 0 0 1px rgba(80,120,255,0.08),",
			"inset 0 1px 0 rgba(255,255,255,0.05);",
			"color:#dde4ff;font-family:inherit;font-size:14px;line-height:1.55;",
			"pointer-events:all;",
			"transition:opacity 0.25s,transform 0.25s;",
			"opacity:0;transform:translateY(8px);"
		].join("");
		Tutorial.#card = card;
		document.body.appendChild(card);

		// Animate in
		requestAnimationFrame(function () {
			if (Tutorial.#card) {
				Tutorial.#card.style.opacity = "1";
				Tutorial.#card.style.transform = "translateY(0)";
			}
		});
	}

	// ═══════════════════════════════════════════════
	//  STEP RENDERING
	// ═══════════════════════════════════════════════

	static #render() {
		let step = Tutorial.#steps[Tutorial.#step];
		if (!step) { Tutorial.done(); return; }

		let card = Tutorial.#card;
		let bg   = Tutorial.#overlay;
		if (!card || !bg) return;

		// Release panels that were revealed on the previous step
		Tutorial.#unrevealAll();

		// Reveal any panels this step needs to anchor to
		if (Array.isArray(step.reveal)) {
			for (let sel of step.reveal) {
				let panel = document.querySelector(sel);
				if (panel && !panel.classList.contains("visible")) {
					panel.classList.add("visible");
					Tutorial.#revealEls.push(panel);
				}
			}
		}

		// CSS transitions on the panels take ~250ms. Give them one RAF, then
		// another RAF before measuring, so transforms have settled.
		requestAnimationFrame(function () {
			setTimeout(function () { Tutorial.#paintStep(step); }, 270);
		});
		// Also paint once immediately so the card text doesn't lag; the
		// spotlight ring will reposition after the reveal transition ends.
		Tutorial.#paintStep(step);
	}

	static #paintStep(step) {
		let card = Tutorial.#card;
		let bg   = Tutorial.#overlay;
		let arrow = Tutorial.#arrow;
		if (!card || !bg) return;

		// Resolve target (primary selector, then altTargets if provided)
		let targetEl = null;
		if (step.target) targetEl = Tutorial.#safeQuery(step.target);
		if (!targetEl && Array.isArray(step.altTargets)) {
			for (let sel of step.altTargets) {
				targetEl = Tutorial.#safeQuery(sel);
				if (targetEl) break;
			}
		}

		// Verify the resolved element actually has dimensions in the viewport;
		// if it's zero-sized or fully offscreen, treat as missing (falls back
		// to center overlay so the pointer doesn't glue to 0,0).
		let r = null;
		if (targetEl) {
			r = targetEl.getBoundingClientRect();
			let vw = window.innerWidth, vh = window.innerHeight;
			let onScreen = r.width > 2 && r.height > 2 &&
				r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
			if (!onScreen) r = null;
		}

		// Clear old wings/ring and render new ones
		bg.innerHTML = "";
		if (r) {
			let pad = 10;
			let vw  = window.innerWidth, vh = window.innerHeight;
			let T   = Math.max(0, r.top - pad);
			let B   = Math.min(vh, r.bottom + pad);
			let L   = Math.max(0, r.left - pad);
			let R   = Math.min(vw, r.right + pad);

			let wing = "position:absolute;background:rgba(0,0,0,0.74);pointer-events:all;";
			let wings = [
				"top:0;left:0;right:0;height:" + T + "px;",
				"top:" + B + "px;left:0;right:0;bottom:0;",
				"top:" + T + "px;left:0;width:" + L + "px;height:" + (B - T) + "px;",
				"top:" + T + "px;left:" + R + "px;right:0;height:" + (B - T) + "px;"
			];
			wings.forEach(function (s) {
				let d = document.createElement("div");
				d.style.cssText = wing + s;
				d.addEventListener("click", Tutorial.done);
				bg.appendChild(d);
			});

			// Spotlight highlight ring
			let ring = document.createElement("div");
			ring.style.cssText = [
				"position:absolute;",
				"top:" + T + "px;left:" + L + "px;",
				"width:" + (R - L) + "px;height:" + (B - T) + "px;",
				"border:2px solid rgba(100,170,255,0.75);",
				"border-radius:8px;",
				"box-shadow:0 0 22px rgba(80,150,255,0.38),inset 0 0 18px rgba(80,150,255,0.06);",
				"pointer-events:none;",
				"animation:tutorialPulse 1.6s ease-in-out infinite;"
			].join("");
			bg.appendChild(ring);

			// Inject pulse keyframes once
			if (!document.getElementById("tutorial-kf")) {
				let style = document.createElement("style");
				style.id = "tutorial-kf";
				style.textContent =
					"@keyframes tutorialPulse{" +
					"0%,100%{box-shadow:0 0 22px rgba(80,150,255,0.38),inset 0 0 18px rgba(80,150,255,0.06);}" +
					"50%{box-shadow:0 0 32px rgba(120,185,255,0.65),inset 0 0 26px rgba(120,185,255,0.1);}" +
					"}";
				document.head.appendChild(style);
			}

			Tutorial.#positionCard(r, step.pos || "below");
			Tutorial.#positionArrow(r, step.pos || "below");
		} else {
			// Full dark overlay (no spotlight)
			let full = document.createElement("div");
			full.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.7);pointer-events:all;";
			full.addEventListener("click", Tutorial.done);
			bg.appendChild(full);
			Tutorial.#positionCard(null, "center");
			if (arrow) arrow.style.opacity = "0";
		}

		// Render the card content (progress + buttons)
		Tutorial.#renderCardContent(step);
	}

	static #renderCardContent(step) {
		let card = Tutorial.#card;
		if (!card) return;

		let total   = Tutorial.#steps.length;
		let current = Tutorial.#step + 1;
		let isLast  = Tutorial.#step === total - 1;
		let isFirst = Tutorial.#step === 0;

		let dotsHtml = Tutorial.#steps.map(function (_, i) {
			let active = i === Tutorial.#step;
			return '<div style="width:' + (active ? 16 : 6) + 'px;height:4px;border-radius:2px;' +
				'transition:all 0.2s;background:' +
				(active ? "rgba(100,165,255,0.9)" : "rgba(120,140,210,0.25)") + ';"></div>';
		}).join("");

		card.innerHTML =
			'<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:13px;">' +
				'<span style="font-size:24px;line-height:1;flex-shrink:0;">' + Tutorial.#esc(step.icon || "💡") + '</span>' +
				'<div>' +
					'<div style="font-size:15px;font-weight:600;color:#eef2ff;letter-spacing:0.01em;">' + Tutorial.#esc(step.title) + '</div>' +
					'<div style="font-size:11px;color:rgba(140,165,255,0.55);margin-top:2px;">Step ' + current + ' of ' + total + '</div>' +
				'</div>' +
			'</div>' +
			'<p style="margin:0 0 18px;color:rgba(205,218,255,0.85);font-size:13px;line-height:1.6;">' + Tutorial.#esc(step.body) + '</p>' +
			'<div style="display:flex;gap:8px;align-items:center;">' +
				(!isFirst ? '<button id="tut-back" style="flex:0 0 auto;padding:7px 13px;border:1px solid rgba(110,145,255,0.22);border-radius:7px;background:rgba(255,255,255,0.04);color:rgba(170,195,255,0.75);cursor:pointer;font-size:12px;">← Back</button>' : "") +
				'<div style="flex:1;"></div>' +
				'<button id="tut-skip" style="padding:7px 12px;border:none;background:none;color:rgba(130,150,200,0.45);cursor:pointer;font-size:12px;">Skip</button>' +
				'<button id="tut-next" style="padding:9px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,rgba(70,125,255,0.92),rgba(110,70,255,0.92));color:#fff;cursor:pointer;font-size:13px;font-weight:500;letter-spacing:0.01em;">' +
					(isLast ? "Finish ✓" : "Next →") +
				'</button>' +
			'</div>' +
			'<div style="margin-top:14px;display:flex;gap:5px;justify-content:center;">' + dotsHtml + '</div>';

		card.querySelector("#tut-next").addEventListener("click", function () {
			if (Tutorial.#step >= Tutorial.#steps.length - 1) { Tutorial.done(); return; }
			Tutorial.#step++;
			Tutorial.#render();
		});
		card.querySelector("#tut-skip").addEventListener("click", Tutorial.done);
		let backBtn = card.querySelector("#tut-back");
		if (backBtn) {
			backBtn.addEventListener("click", function () {
				Tutorial.#step = Math.max(0, Tutorial.#step - 1);
				Tutorial.#render();
			});
		}
	}

	// ═══════════════════════════════════════════════
	//  POSITIONING
	// ═══════════════════════════════════════════════

	static #positionCard(targetRect, pos) {
		let card = Tutorial.#card;
		if (!card) return;
		let vw = window.innerWidth, vh = window.innerHeight;
		// Measure real card size rather than guessing
		let actual = card.getBoundingClientRect();
		let cardW = Math.max(260, Math.min(360, actual.width  || 326));
		let cardH = Math.max(160, Math.min(320, actual.height || 230));

		if (!targetRect || pos === "center") {
			card.style.left = Math.round((vw - cardW) / 2) + "px";
			card.style.top  = Math.round((vh - cardH) / 2) + "px";
			return;
		}

		let gap = 22;  // bigger gap so the arrow has room
		let x, y;

		if (pos === "below") {
			x = Math.min(vw - cardW - 12, Math.max(12, targetRect.left));
			y = targetRect.bottom + gap;
			if (y + cardH > vh - 10) y = targetRect.top - cardH - gap;
		} else if (pos === "above") {
			x = Math.min(vw - cardW - 12, Math.max(12, targetRect.left));
			y = targetRect.top - cardH - gap;
			if (y < 10) y = targetRect.bottom + gap;
		} else if (pos === "right") {
			x = targetRect.right + gap;
			y = Math.min(vh - cardH - 12, Math.max(12, targetRect.top + targetRect.height / 2 - cardH / 2));
			if (x + cardW > vw - 10) x = targetRect.left - cardW - gap;
		} else if (pos === "left") {
			x = targetRect.left - cardW - gap;
			y = Math.min(vh - cardH - 12, Math.max(12, targetRect.top + targetRect.height / 2 - cardH / 2));
			if (x < 10) x = targetRect.right + gap;
		} else {
			x = Math.min(vw - cardW - 12, Math.max(12, targetRect.left));
			y = targetRect.bottom + gap;
		}

		card.style.left = Math.round(Math.max(10, x)) + "px";
		card.style.top  = Math.round(Math.max(10, Math.min(vh - cardH - 10, y))) + "px";
	}

	static #positionArrow(targetRect, pos) {
		let arrow = Tutorial.#arrow;
		if (!arrow || !targetRect) return;
		let cx = targetRect.left + targetRect.width / 2;
		let cy = targetRect.top  + targetRect.height / 2;

		// Arrow sits just outside the spotlight ring, pointing inward
		// The SVG is a triangle with tip at top. Rotate accordingly.
		let offset = 16;
		let x, y, rot;
		if (pos === "below") {
			x = cx - 11;
			y = targetRect.bottom + offset;
			rot = 180; // point up
		} else if (pos === "above") {
			x = cx - 11;
			y = targetRect.top - offset - 22;
			rot = 0;   // point down? Arrow tip is top → want to point at target above = tip up
		} else if (pos === "right") {
			x = targetRect.right + offset;
			y = cy - 11;
			rot = -90; // tip left (toward target)
		} else if (pos === "left") {
			x = targetRect.left - offset - 22;
			y = cy - 11;
			rot = 90;  // tip right (toward target)
		} else {
			arrow.style.opacity = "0";
			return;
		}
		arrow.style.left = Math.round(x) + "px";
		arrow.style.top  = Math.round(y) + "px";
		arrow.style.transform = "rotate(" + rot + "deg)";
		arrow.style.opacity = "1";
	}

	// ═══════════════════════════════════════════════
	//  PANEL REVEAL HELPERS
	// ═══════════════════════════════════════════════

	/**
	 * Releases every panel we forcibly showed for the previous step.
	 */
	static #unrevealAll() {
		for (let el of Tutorial.#revealEls) {
			if (el && el.classList) el.classList.remove("visible");
		}
		Tutorial.#revealEls = [];
	}

	/**
	 * Safe querySelector — swallows invalid selectors.
	 */
	static #safeQuery(sel) {
		try { return document.querySelector(sel); } catch (e) { return null; }
	}

	// ═══════════════════════════════════════════════
	//  CLEANUP
	// ═══════════════════════════════════════════════

	static #destroy() {
		Tutorial.#unrevealAll();
		if (Tutorial.#overlay) { Tutorial.#overlay.remove(); Tutorial.#overlay = null; }
		if (Tutorial.#card)    { Tutorial.#card.remove();    Tutorial.#card    = null; }
		if (Tutorial.#arrow)   { Tutorial.#arrow.remove();   Tutorial.#arrow   = null; }
	}

	static #esc(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
