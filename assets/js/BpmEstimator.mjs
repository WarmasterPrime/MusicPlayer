// BpmEstimator.mjs
// -----------------------------------------------------------------------------
// Lightweight, zero-allocation BPM tracker for audio visualizers.
//
// Strategy: we watch a short-window average of bass-band energy. Whenever that
// average crosses an adaptive threshold (mean + α·stdev) it counts as a beat.
// We record the wall-clock time of each beat in a ring buffer, then estimate
// BPM as the reciprocal of the median inter-beat-interval (IBI) over the last
// N beats. Median (rather than mean) makes the estimate robust against the
// occasional spurious onset or missed beat.
//
// This runs in tens of nanoseconds per frame — safe to call every render.
// -----------------------------------------------------------------------------

export class BpmEstimator {
	// ── Tunables ──
	// Size of the adaptive-baseline ring buffer (~1 second at 60fps).
	static #BASELINE_WIN = 64;
	// How many recent beats to median over (~8 seconds of beats at 120bpm).
	static #IBI_WIN = 16;
	// Minimum gap (ms) between two accepted beats; prevents double-triggers
	// from a single transient. 250ms = max 240 BPM.
	static #MIN_IBI_MS = 250;
	// Maximum gap (ms) — anything longer resets the history (song changed,
	// breakdown ended, etc.). 2500ms = min 24 BPM.
	static #MAX_IBI_MS = 2500;
	// Peak threshold coefficient: beat = energy > (mean + K·stdev).
	static #K = 1.25;
	// Smoothing factor for the reported BPM (lower = more responsive).
	static #BPM_SMOOTH = 0.35;

	// ── Per-instance state (created lazily on first update) ──
	#baseline = new Float32Array(BpmEstimator.#BASELINE_WIN);
	#baselineIdx = 0;
	#baselineFilled = false;
	#beatTimes = new Float64Array(BpmEstimator.#IBI_WIN);
	#beatIdx = 0;
	#beatCount = 0;
	#lastBeatTime = 0;
	#bpm = 120;   // sensible default before any beats detected

	/**
	 * Feeds a single frame's bass-band energy (0..1) into the estimator and
	 * returns the current smoothed BPM.
	 *
	 * Caller is expected to compute `bassEnergy` by the same formula every
	 * frame (e.g. `min(1, sum(bass-bins) / (bins * 150))`).
	 *
	 * @param {number} bassEnergy   Normalized bass energy in [0, 1].
	 * @param {number} [nowMs]      Optional timestamp override (for tests).
	 * @returns {number}            Smoothed BPM estimate.
	 */
	update(bassEnergy, nowMs) {
		let now = nowMs !== undefined ? nowMs : performance.now();

		// Ring-push latest energy into baseline buffer
		this.#baseline[this.#baselineIdx] = bassEnergy;
		this.#baselineIdx = (this.#baselineIdx + 1) % BpmEstimator.#BASELINE_WIN;
		if (this.#baselineIdx === 0) this.#baselineFilled = true;

		// Need a full window before beat detection starts (avoid spurious
		// early beats while the baseline warms up).
		if (!this.#baselineFilled) return this.#bpm;

		// Adaptive threshold: mean + K · stdev of the rolling window.
		let mean = 0;
		for (let i = 0; i < BpmEstimator.#BASELINE_WIN; i++) {
			mean += this.#baseline[i];
		}
		mean /= BpmEstimator.#BASELINE_WIN;
		let variance = 0;
		for (let i = 0; i < BpmEstimator.#BASELINE_WIN; i++) {
			let d = this.#baseline[i] - mean;
			variance += d * d;
		}
		variance /= BpmEstimator.#BASELINE_WIN;
		let stdev = Math.sqrt(variance);
		let thresh = mean + BpmEstimator.#K * stdev;

		// Beat detected?  Require a minimum gap to prevent double-triggers.
		if (bassEnergy > thresh && bassEnergy > 0.25 && (now - this.#lastBeatTime) >= BpmEstimator.#MIN_IBI_MS) {
			let ibi = now - this.#lastBeatTime;
			this.#lastBeatTime = now;
			// Record beat time for IBI history
			this.#beatTimes[this.#beatIdx] = now;
			this.#beatIdx = (this.#beatIdx + 1) % BpmEstimator.#IBI_WIN;
			if (this.#beatCount < BpmEstimator.#IBI_WIN) this.#beatCount++;

			// If the gap is too long, the previous beat is stale — keep the
			// time but don't use this gap as an IBI sample.
			if (ibi <= BpmEstimator.#MAX_IBI_MS && this.#beatCount >= 3) {
				let instantBpm = this.#computeInstantBpm();
				if (instantBpm > 40 && instantBpm < 220) {
					this.#bpm = this.#bpm * (1 - BpmEstimator.#BPM_SMOOTH) + instantBpm * BpmEstimator.#BPM_SMOOTH;
				}
			}
		}
		return this.#bpm;
	}

	/**
	 * Current smoothed BPM estimate (last value — does not advance state).
	 * @returns {number}
	 */
	getBpm() { return this.#bpm; }

	/**
	 * Seconds per beat at the current BPM — convenient for anim timing.
	 * @returns {number}
	 */
	getBeatPeriodSec() { return 60 / Math.max(1, this.#bpm); }

	/**
	 * Number of beats the estimator has observed since init.
	 * @returns {number}
	 */
	getBeatCount() { return this.#beatCount; }

	/**
	 * Resets internal history — call on song change, mic toggle, etc.
	 */
	reset() {
		this.#baseline.fill(0);
		this.#baselineIdx = 0;
		this.#baselineFilled = false;
		this.#beatTimes.fill(0);
		this.#beatIdx = 0;
		this.#beatCount = 0;
		this.#lastBeatTime = 0;
		this.#bpm = 120;
	}

	// ── internals ──

	/**
	 * Median of the IBIs represented by the beatTimes ring buffer, converted
	 * to BPM. We use median (not mean) so a single spurious beat doesn't
	 * throw off the estimate.
	 */
	#computeInstantBpm() {
		// Gather the last min(beatCount, IBI_WIN) beat times in chronological
		// order, then compute consecutive IBIs.
		let count = this.#beatCount;
		let ibis = new Array(count - 1);
		// Start index in the ring (oldest): beatIdx - count (with wrap)
		let start = (this.#beatIdx - count + BpmEstimator.#IBI_WIN) % BpmEstimator.#IBI_WIN;
		let prev = this.#beatTimes[start];
		for (let k = 1; k < count; k++) {
			let idx = (start + k) % BpmEstimator.#IBI_WIN;
			ibis[k - 1] = this.#beatTimes[idx] - prev;
			prev = this.#beatTimes[idx];
		}
		// Sort + take median
		ibis.sort(function (a, b) { return a - b; });
		let med = ibis[Math.floor(ibis.length / 2)];
		if (!(med > 0)) return 0;
		return 60000 / med;
	}
}

// Convenience: shared singleton for callers that don't need per-visualization
// independence (most of the 2D designs just want "what BPM is the song").
export const sharedBpm = new BpmEstimator();
