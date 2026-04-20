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
		// Walk lines and track blank separators between timestamped entries.
		// A run of blank/non-timestamped lines between two timestamped lines is
		// preserved as a synthesized empty entry slotted halfway between them —
		// so "blank lines" in the source LRC translate to a visible gap at
		// playback time.
		const tokens = [];
		lines.forEach(line => {
			const match = line.match(pattern);
			if (match) {
				const secs = Lyrics.parseTime(match.groups.timestamp);
				if (!isNaN(secs)) {
					tokens.push({ type: "ts", time: Math.round(secs * 1000), text: match.groups.text.trim() });
				}
			} else if (line.trim().length === 0) {
				tokens.push({ type: "blank" });
			}
			// Non-timestamped, non-blank lines (e.g. [ar:...], [ti:...] metadata) are skipped.
		});
		const output = [];
		for (let i = 0; i < tokens.length; i++) {
			let t = tokens[i];
			if (t.type !== "ts") continue;
			output.push({ timestamp: t.time, text: t.text });
			// If a run of blank lines follows this ts, insert a synthetic empty
			// entry between this ts and the next ts (if any). Use the midpoint,
			// clamped so it's strictly after current and before next.
			let hasBlank = false;
			let j = i + 1;
			while (j < tokens.length && tokens[j].type === "blank") { hasBlank = true; j++; }
			if (hasBlank && j < tokens.length && tokens[j].type === "ts") {
				let nextTime = tokens[j].time;
				if (nextTime > t.time + 1) {
					let mid = Math.round((t.time + nextTime) / 2);
					output.push({ timestamp: mid, text: "" });
				}
			}
		}
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
	 * Parses an "hh:mm:ss,ms" or "hh:mm:ss.ms" time string into seconds.
	 * Used by SRT, VTT, SBV.
	 * @param {string} time
	 * @returns {number} Seconds as float, or NaN on parse failure.
	 */
	static parseHmsTime(time) {
		// Accept h:m:s.ms, h:m:s,ms, m:s.ms, m:s,ms
		let norm = time.trim().replace(",", ".");
		let parts = norm.split(":");
		if (parts.length === 3) {
			let h = parseFloat(parts[0]);
			let m = parseFloat(parts[1]);
			let s = parseFloat(parts[2]);
			if (isNaN(h) || isNaN(m) || isNaN(s)) return NaN;
			return h * 3600 + m * 60 + s;
		}
		if (parts.length === 2) {
			let m = parseFloat(parts[0]);
			let s = parseFloat(parts[1]);
			if (isNaN(m) || isNaN(s)) return NaN;
			return m * 60 + s;
		}
		return NaN;
	}

	/**
	 * Parses an SRT subtitle file into the canonical array format.
	 * Preserves empty gaps as `{timestamp, text: ""}` markers at each cue end.
	 * @param {string} srtString
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromSrt(srtString) {
		const cuePattern = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/;
		const blocks = srtString.replace(/\r\n/g, "\n").split(/\n\s*\n/);
		return Lyrics.#parseSubtitleBlocks(blocks, cuePattern);
	}

	/**
	 * Parses a WebVTT file into the canonical array format.
	 * @param {string} vttString
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromVtt(vttString) {
		// VTT header line is "WEBVTT" optionally followed by a description.
		// Cues may have an optional identifier line before the timestamp line.
		const cuePattern = /(\d{1,2}:\d{2}:\d{2}\.\d{1,3}|\d{1,2}:\d{2}\.\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{1,3}|\d{1,2}:\d{2}\.\d{1,3})/;
		// Drop WEBVTT header and NOTE/STYLE blocks
		let cleaned = vttString.replace(/\r\n/g, "\n");
		cleaned = cleaned.replace(/^WEBVTT[^\n]*\n/, "");
		// Remove any NOTE / STYLE / REGION blocks (paragraphs starting with the keyword)
		cleaned = cleaned.split(/\n\s*\n/).filter(block => {
			let firstLine = block.split("\n")[0].trim();
			return !/^(NOTE|STYLE|REGION)\b/.test(firstLine);
		}).join("\n\n");
		const blocks = cleaned.split(/\n\s*\n/);
		return Lyrics.#parseSubtitleBlocks(blocks, cuePattern);
	}

	/**
	 * Parses an SBV (YouTube SubViewer) file into the canonical array format.
	 * Format: "h:mm:ss.mmm,h:mm:ss.mmm\nText line\n\n..."
	 * @param {string} sbvString
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromSbv(sbvString) {
		const cuePattern = /(\d{1,2}:\d{2}:\d{2}\.\d{1,3})\s*,\s*(\d{1,2}:\d{2}:\d{2}\.\d{1,3})/;
		const blocks = sbvString.replace(/\r\n/g, "\n").split(/\n\s*\n/);
		return Lyrics.#parseSubtitleBlocks(blocks, cuePattern);
	}

	/**
	 * Parses a SUB file (either MicroDVD or SubViewer format) into the canonical array format.
	 * MicroDVD: "{frameStart}{frameEnd}Text line" — requires fps (defaults to 25).
	 * SubViewer: "hh:mm:ss.ms,hh:mm:ss.ms\nText line\n\n..."
	 * @param {string} subString
	 * @param {number} [fps=25] - Frames per second (MicroDVD only).
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromSub(subString, fps = 25) {
		let str = subString.replace(/\r\n/g, "\n");
		// MicroDVD: lines look like "{1}{75}Hello world"
		const microPattern = /^\{(\d+)\}\{(\d+)\}(.*)$/;
		if (str.split("\n").some(line => microPattern.test(line.trim()))) {
			const output = [];
			const lines = str.split("\n");
			let last = null;
			for (let i = 0; i < lines.length; i++) {
				let m = lines[i].trim().match(microPattern);
				if (!m) continue;
				let startFrame = parseInt(m[1], 10);
				let endFrame = parseInt(m[2], 10);
				let text = m[3].replace(/\|/g, "\n").trim();
				let startSec = startFrame / fps;
				let endSec = endFrame / fps;
				output.push({ timestamp: Math.round(startSec * 1000), text });
				// Gap marker at end of each cue
				if (endSec > startSec) {
					output.push({ timestamp: Math.round(endSec * 1000), text: "" });
				}
				last = endSec;
			}
			return Lyrics.#mergeAdjacentGaps(output);
		}
		// SubViewer: "hh:mm:ss.ms,hh:mm:ss.ms\nText"
		const cuePattern = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*,\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/;
		const blocks = str.split(/\n\s*\n/);
		return Lyrics.#parseSubtitleBlocks(blocks, cuePattern);
	}

	/**
	 * Parses a Scenarist Closed Caption (SCC) file into the canonical array format.
	 * SCC is a frame-accurate caption format with hex control-code pairs.
	 * This parser extracts only the cue timestamps and the decoded printable
	 * ASCII text — full SCC control-code semantics (pop-on, roll-up, positioning)
	 * are intentionally ignored, since we only need a linear lyric track.
	 * @param {string} sccString
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromScc(sccString) {
		let str = sccString.replace(/\r\n/g, "\n");
		// Skip header line "Scenarist_SCC V1.0"
		let lines = str.split("\n").filter(l => /^\d{1,2}:\d{2}:\d{2}[:;]\d{2}\t/.test(l.trim()));
		const output = [];
		const framesToMs = (h, m, s, f) => Math.round(((h * 3600 + m * 60 + s) * 1000) + (f * 1000 / 29.97));
		for (let i = 0; i < lines.length; i++) {
			let parts = lines[i].split(/\t/, 2);
			if (parts.length < 2) continue;
			let tMatch = parts[0].match(/^(\d{1,2}):(\d{2}):(\d{2})[:;](\d{2})$/);
			if (!tMatch) continue;
			let h = +tMatch[1], m = +tMatch[2], s = +tMatch[3], f = +tMatch[4];
			let ms = framesToMs(h, m, s, f);
			// Each pair of hex bytes may be a control code or an ASCII-char pair.
			// Strip non-ASCII control codes; emit printable chars.
			let hexPairs = parts[1].trim().split(/\s+/);
			let text = "";
			for (let j = 0; j < hexPairs.length; j++) {
				let pair = hexPairs[j];
				if (!/^[0-9a-fA-F]{4}$/.test(pair)) continue;
				let b1 = parseInt(pair.substr(0, 2), 16) & 0x7f;
				let b2 = parseInt(pair.substr(2, 2), 16) & 0x7f;
				// Control codes live in 0x10-0x1f; printable in 0x20-0x7e
				if (b1 >= 0x20 && b1 <= 0x7e) text += String.fromCharCode(b1);
				if (b2 >= 0x20 && b2 <= 0x7e) text += String.fromCharCode(b2);
			}
			text = text.trim();
			if (text.length > 0) {
				output.push({ timestamp: ms, text });
			}
		}
		return output.sort((a, b) => a.timestamp - b.timestamp);
	}

	/**
	 * Shared subtitle-block parser used by SRT / VTT / SBV / SubViewer SUB.
	 * Each block has one cue-timing line (matching cuePattern) followed by
	 * one or more text lines. Gap markers (empty text) are inserted at the
	 * end time of each cue so the gap between cues is preserved.
	 * @param {string[]} blocks - Blocks separated by blank lines.
	 * @param {RegExp} cuePattern - Must capture start and end time strings.
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static #parseSubtitleBlocks(blocks, cuePattern) {
		const output = [];
		for (let b = 0; b < blocks.length; b++) {
			let block = blocks[b];
			if (!block || block.trim().length === 0) continue;
			let blockLines = block.split("\n");
			let startSec = NaN, endSec = NaN;
			let textLines = [];
			let foundTiming = false;
			for (let i = 0; i < blockLines.length; i++) {
				let line = blockLines[i];
				if (!foundTiming) {
					let m = line.match(cuePattern);
					if (m) {
						startSec = Lyrics.parseHmsTime(m[1]);
						endSec = Lyrics.parseHmsTime(m[2]);
						foundTiming = true;
					}
				} else {
					textLines.push(line);
				}
			}
			if (!foundTiming || isNaN(startSec)) continue;
			// Strip HTML tags commonly found in VTT (<i>, <b>, <c.classname>, etc.)
			let text = textLines.join("\n").replace(/<[^>]+>/g, "").trim();
			output.push({ timestamp: Math.round(startSec * 1000), text });
			if (!isNaN(endSec) && endSec > startSec) {
				output.push({ timestamp: Math.round(endSec * 1000), text: "" });
			}
		}
		return Lyrics.#mergeAdjacentGaps(output.sort((a, b) => a.timestamp - b.timestamp));
	}

	/**
	 * Collapses adjacent gap markers and removes a gap marker that would
	 * immediately precede a real lyric (since the real lyric will replace it).
	 * @param {Array<{timestamp:number,text:string}>} arr
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static #mergeAdjacentGaps(arr) {
		const out = [];
		for (let i = 0; i < arr.length; i++) {
			let cur = arr[i];
			let prev = out.length > 0 ? out[out.length - 1] : null;
			// Drop a duplicate gap immediately after another gap
			if (prev && prev.text === "" && cur.text === "" && cur.timestamp - prev.timestamp < 50) continue;
			// If a gap marker is within a few ms of a following real lyric, skip it
			if (cur.text === "" && i + 1 < arr.length && arr[i + 1].text !== "" && arr[i + 1].timestamp - cur.timestamp < 50) continue;
			out.push(cur);
		}
		return out;
	}

	/**
	 * Parses any supported lyric format, auto-detecting by content signature or
	 * by the provided file extension (one of "lrc", "srt", "vtt", "sbv", "sub", "scc", "json").
	 * @param {string} text
	 * @param {string} [extension]
	 * @returns {Array<{timestamp:number,text:string}>}
	 */
	static fromAny(text, extension) {
		if (typeof text !== "string" || text.length === 0) return [];
		let ext = (extension || "").toLowerCase().replace(/^\./, "");
		// Content-sniffing when extension unknown
		if (!ext) {
			if (/^WEBVTT/i.test(text.trim())) ext = "vtt";
			else if (/^Scenarist_SCC/i.test(text.trim())) ext = "scc";
			else if (/^\d{1,2}:\d{2}:\d{2}\.\d{3}\s*,/m.test(text)) ext = "sbv";
			else if (/-->/m.test(text)) ext = "srt";
			else if (/^\{\d+\}\{\d+\}/m.test(text)) ext = "sub";
			else if (/^\[\d{1,2}:\d{2}/m.test(text)) ext = "lrc";
		}
		switch (ext) {
			case "lrc":  return Lyrics.fromLrc(text);
			case "srt":  return Lyrics.fromSrt(text);
			case "vtt":  return Lyrics.fromVtt(text);
			case "sbv":  return Lyrics.fromSbv(text);
			case "sub":  return Lyrics.fromSub(text);
			case "scc":  return Lyrics.fromScc(text);
			case "json":
				try {
					let parsed = JSON.parse(text);
					if (Array.isArray(parsed)) {
						return parsed.filter(e => e && typeof e === "object")
							.map(e => ({ timestamp: parseFloat(e.timestamp ?? 0), text: String(e.text ?? "") }))
							.filter(e => !isNaN(e.timestamp));
					}
					return [];
				} catch (_) { return []; }
			default:     return Lyrics.fromLrc(text); // fallback
		}
	}

	/**
	 * Serializes a canonical lyric array to an LRC-format string.
	 * Empty-text entries ARE emitted so that playback gaps are preserved
	 * when the LRC file is re-loaded.
	 * @param {Array<{timestamp:number,text:string}>} lyrics
	 * @returns {string}
	 */
	static toLrc(lyrics) {
		if (!Array.isArray(lyrics)) return "";
		const sorted = lyrics.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
		const fmt = ms => {
			let totalCs = Math.round(ms / 10);
			let centis = totalCs % 100;
			let totalSec = Math.floor(totalCs / 100);
			let secs = totalSec % 60;
			let mins = Math.floor(totalSec / 60);
			return "[" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0") + "." + String(centis).padStart(2, "0") + "]";
		};
		return sorted.map(l => fmt(l.timestamp || 0) + (l.text || "")).join("\n");
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
