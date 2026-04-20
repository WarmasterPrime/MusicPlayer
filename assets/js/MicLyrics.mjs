/**
 * MicLyrics
 *
 * Feeds live microphone speech into the existing lyrics display pipeline by
 * exposing a Lyrics-compatible object with a `getAtTime()` method. When
 * active, it replaces `Visual.lyrics` with an object whose `getAtTime()`
 * returns the most-recently-spoken phrase from the user's mic.
 *
 * Why this shape: every renderer in the app (2D caption overlay, the 3D
 * Lyric-Particles target builder, ModalOptions preview, etc.) calls
 * `Visual.lyrics.getAtTime(ms)`. By exposing the same method signature we
 * plug straight into that pipeline with zero per-renderer changes.
 *
 * Uses the Web Speech API (`webkitSpeechRecognition` on Chrome/Edge,
 * `SpeechRecognition` in Firefox-nightly). Continuous mode with interim
 * results gives us word-by-word feedback that feels "live" rather than
 * batched after each sentence.
 */
export class MicLyrics {
	// ─── Lifecycle state ───────────────────────────────────────────────
	static #recognition = null;
	static #active = false;
	// Current phrase displayed. Updated on every interim result so the user
	// sees words appear as they speak. Cleared after #silenceMs of no input.
	static #currentText = "";
	// ms timestamp of the last successful recognition event. Used to expire
	// the caption after a gap so stale phrases don't linger forever.
	static #lastUpdate = 0;
	// How long to show the last phrase before clearing it. 4 seconds feels
	// about right — long enough to finish reading a line, short enough that
	// a mid-song pause doesn't leave stale text on screen.
	static #silenceMs = 4000;
	// Restored from the main Player's lyrics before we replaced them, so
	// stop() can put them back untouched.
	static #restoreLyrics = null;
	// Optional callback fired whenever the current text changes — used by
	// ModalOptions to flash a "listening..." indicator.
	static onUpdate = null;

	/**
	 * Feature check. Returns true when the current browser supports speech
	 * recognition (Chrome, Edge, and Chromium forks). Firefox currently
	 * requires a flag.
	 */
	static isSupported() {
		return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
	}

	/**
	 * Returns true if mic-lyrics mode is currently running.
	 */
	static isActive() {
		return MicLyrics.#active;
	}

	/**
	 * Starts listening. Replaces Visual.lyrics with a live shim so the
	 * existing lyric renderers pick up our text every frame.
	 * @returns {Promise<boolean>} true on success.
	 */
	static async start() {
		if (MicLyrics.#active) return true;
		if (!MicLyrics.isSupported()) {
			console.warn("[MicLyrics] SpeechRecognition not supported in this browser.");
			return false;
		}

		// Request mic access up-front so the browser shows its permission
		// prompt synchronously with the user click — avoids the confusing
		// "why did nothing happen?" moment.
		try {
			let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			// We don't keep the stream — SpeechRecognition manages its own —
			// but acquiring it forces the permission prompt and verifies the
			// device is usable.
			stream.getTracks().forEach(t => t.stop());
		} catch (e) {
			console.warn("[MicLyrics] Microphone permission denied:", e);
			return false;
		}

		let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		let rec = new SR();
		rec.continuous = true;        // keep listening until stop()
		rec.interimResults = true;    // show partial words as user speaks
		rec.lang = (navigator.language || "en-US");
		rec.maxAlternatives = 1;

		rec.onresult = function (event) {
			// The event carries ALL results since start; we only care about
			// the newest chunk so we walk from resultIndex forward and build
			// the interim transcript. Final results replace the interim.
			let interim = "";
			let finalText = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				let r = event.results[i];
				let t = r[0] ? r[0].transcript : "";
				if (r.isFinal) finalText += t;
				else interim += t;
			}
			let phrase = (finalText || interim).trim();
			if (phrase) {
				MicLyrics.#currentText = phrase;
				MicLyrics.#lastUpdate = Date.now();
				if (typeof MicLyrics.onUpdate === "function") {
					try { MicLyrics.onUpdate(phrase); } catch (e) {}
				}
			}
		};

		rec.onerror = function (e) {
			// "no-speech" fires routinely during silence in continuous mode;
			// swallow it so the console isn't flooded. Other errors surface.
			if (e && e.error && e.error !== "no-speech") {
				console.warn("[MicLyrics] recognition error:", e.error);
			}
		};

		rec.onend = function () {
			// Continuous mode still ends on some browsers after long silence
			// or tab blur — restart automatically so the user's toggle
			// matches reality without them having to click again.
			if (MicLyrics.#active) {
				try { rec.start(); } catch (e) {}
			}
		};

		try {
			rec.start();
		} catch (e) {
			console.warn("[MicLyrics] Failed to start recognition:", e);
			return false;
		}

		MicLyrics.#recognition = rec;
		MicLyrics.#active = true;
		MicLyrics.#currentText = "";
		MicLyrics.#lastUpdate = Date.now();

		// Install the live shim over the app's lyrics source. We keep the
		// previous Lyrics instance so stop() can restore it. The shim mimics
		// the two methods the renderers touch: getAtTime() and .value.
		let V = window.Visual;
		if (V) {
			MicLyrics.#restoreLyrics = V.lyrics || null;
			V.lyrics = MicLyrics.#buildShim();
			// Force the caption to start visible even if the toggle was off.
			V.lyricsEnabled = true;
		}

		return true;
	}

	/**
	 * Stops listening and restores the previous lyrics source (if any).
	 */
	static stop() {
		if (!MicLyrics.#active) return;
		MicLyrics.#active = false;
		try {
			if (MicLyrics.#recognition) MicLyrics.#recognition.stop();
		} catch (e) {}
		MicLyrics.#recognition = null;
		MicLyrics.#currentText = "";
		let V = window.Visual;
		if (V) {
			V.lyrics = MicLyrics.#restoreLyrics;
		}
		MicLyrics.#restoreLyrics = null;
	}

	/**
	 * Toggles mic-lyrics mode. Returns the new active state.
	 */
	static async toggle() {
		if (MicLyrics.#active) {
			MicLyrics.stop();
			return false;
		}
		return await MicLyrics.start();
	}

	/**
	 * Builds a Lyrics-shaped object that the rest of the app can poll for
	 * the current phrase. It ignores the time argument because live mic
	 * text has no song-time mapping — it always returns "what is being
	 * said right now", with auto-clear after silenceMs.
	 */
	static #buildShim() {
		return {
			// Marker so other code can detect a live source and avoid
			// treating it like a finite lyric array.
			live: true,
			format: "live-mic",
			value: [],
			getAtTime(_time) {
				if (!MicLyrics.#currentText) return "";
				if (Date.now() - MicLyrics.#lastUpdate > MicLyrics.#silenceMs) {
					MicLyrics.#currentText = "";
					return "";
				}
				return MicLyrics.#currentText;
			}
		};
	}
}
