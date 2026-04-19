import VJson from "./System/Data/VJson.mjs";

/**
 * Manages song lyrics with timestamp-based lookup.
 *
 * Supported storage formats (as returned by getLyrics.php / saveLyrics.php):
 *   1. Array   — [{timestamp: number, text: string}, ...]   (canonical editor format)
 *   2. Object  — {"0": "text", "1.5": "text", ...}          (legacy flat-map format)
 *   3. LRC     — raw "[mm:ss.xx]lyric\n..." string           (uploaded .lrc files)
 *
 * All formats are normalised at construction time into the array format so that
 * getAtTime() always operates on a consistent structure.
 */
export class Lyrics {

	/**
	 * Creates a new Lyrics instance from a raw lyrics value.
	 * @param {Array|object|string} lyricObject - Raw value from the server.
	 */
	constructor(lyricObject) {
		this.raw = lyricObject;
		this.format = Lyrics.getType(lyricObject);
		this.value = Lyrics.normalize(this.raw, this.format);
	}

	// ─── Public API ────────────────────────────────────────────────────────────

	/**
	 * Returns the lyric text that should be displayed at the given time.
	 * @param {number|string} time - Current position in milliseconds (number or numeric string).
	 * @returns {string|null}
	 */
	getAtTime(time) {
		return Lyrics.syncLyric(this.value, parseFloat(time));
	}

	// ─── Static helpers ────────────────────────────────────────────────────────

	/**
	 * Finds the lyric entry whose timestamp is closest to (but not exceeding) time.
	 * @param {Array<{timestamp:number,text:string}>} lyrics
	 * @param {number} time - Seconds.
	 * @returns {string|null}
	 */
	static syncLyric(lyrics, time) {
		if (!Array.isArray(lyrics) || lyrics.length === 0) return null;
		let best = null;
		let bestDiff = Infinity;
		for (let i = 0; i < lyrics.length; i++) {
			let diff = time - lyrics[i].timestamp;
			if (diff >= 0 && diff < bestDiff) {
				bestDiff = diff;
				best = lyrics[i].text;
			}
		}
		return best;
	}

	/**
	 * Parses a raw LRC string into the canonical array format.
	 * Timestamps are converted to **milliseconds** to match the rest of the
	 * system (which stores and compares using `currentTime * 1000`).
	 * Handles "[mm:ss.xx]" and "[mm:ss]" timestamps.
	 * @param {string} lrcString
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromLrc(lrcString) {
		const pattern = /^\[(?<timestamp>\d{1,2}:\d{2}(?:[.:]\d{1,3})?)\](?<text>.*)/;
		const lines = lrcString.split(/\r?\n/);
		const output = [];
		lines.forEach(line => {
			const match = line.match(pattern);
			if (!match) return;
			const { timestamp, text } = match.groups;
			const secs = Lyrics.parseTime(timestamp);
			if (!isNaN(secs)) {
				// Convert seconds → milliseconds to stay consistent with the
				// JSON-editor format and playLyrics() which passes (currentTime * 1000).
				output.push({ timestamp: Math.round(secs * 1000), text: text.trim() });
			}
		});
		return output.sort((a, b) => a.timestamp - b.timestamp);
	}

	/**
	 * Parses a time string "mm:ss.xx" or "mm:ss" into seconds.
	 * @param {string} time
	 * @returns {number} Seconds as float, or NaN on parse failure.
	 */
	static parseTime(time) {
		const parts = time.split(":");
		if (parts.length < 2) return NaN;
		const min = parseInt(parts[0], 10);
		const sec = parseFloat(parts[1].replace(",", "."));
		return min * 60 + sec;
	}

	/**
	 * Detects the storage format of the raw lyrics value.
	 * @param {*} obj
	 * @returns {"array"|"lrc"|"object"}
	 */
	static getType(obj) {
		if (typeof obj === "string") return "lrc";
		if (Array.isArray(obj)) return "array";
		if (obj && typeof obj === "object") {
			// Legacy flat-map: {"0": "text", ...}
			return "object";
		}
		return "array";
	}

	/**
	 * Determines if the given object has the specified property.
	 * @param {*} obj
	 * @param {*} prop
	 * @returns {boolean}
	 */
	static hasProperty(obj, prop) {
		return obj && typeof obj === "object" && (Object.prototype.hasOwnProperty.call(obj, prop) || Object.keys(obj).includes(prop));
	}

	/**
	 * Normalises any supported format into Array<{timestamp, text}>.
	 * @param {*} obj
	 * @param {string} format
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static normalize(obj, format) {
		if (format === "lrc") {
			return Lyrics.fromLrc(typeof obj === "string" ? obj : "");
		}
		if (format === "array") {
			if (!Array.isArray(obj)) return [];
			return obj
				.filter(e => e && typeof e === "object" && typeof e.timestamp === "number")
				.map(e => ({ timestamp: e.timestamp, text: String(e.text ?? "") }))
				.sort((a, b) => a.timestamp - b.timestamp);
		}
		// Legacy flat-map object {"0": "text", ...}
		if (obj && typeof obj === "object") {
			return Object.entries(obj)
				.map(([k, v]) => ({ timestamp: parseFloat(k), text: String(v) }))
				.filter(e => !isNaN(e.timestamp))
				.sort((a, b) => a.timestamp - b.timestamp);
		}
		return [];
	}
}
