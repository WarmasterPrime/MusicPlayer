import { Api } from "./Api.mjs";
import { Toast } from "./Toast.mjs";
import { Lyrics } from "./Lyrics.mjs";

/**
 * Lyric Creator — a dedicated, near-fullscreen modal for building timed
 * lyric tracks from an audio file. Inspired by lyricpotato.com.
 *
 * Features
 * ────────
 * • Drag-drop or pick an audio file; waveform extracted via Web Audio API
 * • Horizontal scrollable waveform with seekable playhead
 * • Multi-track lyric timeline beneath the waveform
 * • Drag lyric blocks to reposition; right-click for edit/split/delete
 * • Right-click on empty timeline → create block at playhead
 * • Autoscroll option keeps playhead centered while playing
 * • Finish button compiles to LRC and saves via saveLyrics.php
 * • Pauses the visualizer song on open, optionally resumes on close
 * • Close only via the X button — backdrop clicks and Escape are ignored
 *
 * The creator uses its OWN <audio> element, not the main player's, so the
 * visualizer audio context is untouched. The main player is paused on open
 * and resume-state is restored on close if the user wishes.
 */
export class ModalLyricCreator {

	// ─── Public API ────────────────────────────────────────────────────────────

	static songId = null;              // Target song DB id
	static isOpen = false;

	// ─── DOM roots ─────────────────────────────────────────────────────────────

	static #overlay = null;
	static #closeBtn = null;
	static #waveCanvas = null;
	static #waveCtx = null;
	static #timelineEl = null;         // Scrollable container for waveform + tracks
	static #tracksEl = null;
	static #playhead = null;
	static #timeDisplay = null;
	static #scrubberEl = null;
	static #trackListEl = null;
	static #loadStatusEl = null;
	static #contextMenuEl = null;
	static #editDialogEl = null;

	// ─── Audio state ───────────────────────────────────────────────────────────

	static #audio = null;              // <audio> element for the uploaded song
	static #audioUrl = null;           // Object URL (revoked on close)
	static #audioBuffer = null;        // Decoded AudioBuffer
	static #audioCtx = null;           // One-shot AudioContext for decoding
	static #peaks = null;              // Float32Array of peaks for waveform rendering
	static #duration = 0;              // Seconds

	// ─── Timeline state ────────────────────────────────────────────────────────

	static #pixelsPerSecond = 100;     // Horizontal zoom factor
	static #tracks = [];               // [{id, name, blocks:[{id, start, end, text}]}]
	static #nextBlockId = 1;
	static #nextTrackId = 1;
	static #autoscroll = true;
	static #rafHandle = 0;
	static #wasMainPlaying = false;    // Was the visualizer player playing on open?

	// ─── Drag state ────────────────────────────────────────────────────────────

	static #dragBlock = null;          // {block, trackId, offsetStartSec}
	static #scrollDrag = null;         // {startX, startScroll}

	/**
	 * Opens the Lyric Creator for a specific song id. Reads any existing
	 * lyrics from the server and pre-populates the timeline.
	 * @param {string} songId - The song DB id to save to.
	 */
	static async open(songId) {
		if (ModalLyricCreator.isOpen) return;
		ModalLyricCreator.songId = songId;
		ModalLyricCreator.isOpen = true;

		ModalLyricCreator.#ensureDom();
		ModalLyricCreator.#resetState();
		ModalLyricCreator.#overlay.style.display = "flex";

		// Pause the visualizer song so two audios don't overlap
		try {
			if (window.player && window.player.isPlaying) {
				ModalLyricCreator.#wasMainPlaying = true;
				window.player.pause();
			}
		} catch (_) {}

		// Prefill tracks from existing lyrics
		try {
			let result = await Api.send("assets/php/getLyrics.php", { song_id: songId });
			if (Array.isArray(result)) {
				ModalLyricCreator.#tracks = [ModalLyricCreator.#buildTrackFromEntries("Track 1", result)];
			} else if (typeof result === "string" && result.length > 0) {
				let parsed = Lyrics.fromAny(result);
				ModalLyricCreator.#tracks = [ModalLyricCreator.#buildTrackFromEntries("Track 1", parsed)];
			} else if (result && typeof result === "object") {
				let entries = Object.entries(result)
					.map(([k, v]) => ({ timestamp: parseFloat(k) * 1000, text: String(v) }))
					.filter(e => !isNaN(e.timestamp));
				ModalLyricCreator.#tracks = [ModalLyricCreator.#buildTrackFromEntries("Track 1", entries)];
			} else {
				ModalLyricCreator.#tracks = [ModalLyricCreator.#createEmptyTrack("Track 1")];
			}
		} catch (_) {
			ModalLyricCreator.#tracks = [ModalLyricCreator.#createEmptyTrack("Track 1")];
		}

		ModalLyricCreator.#renderTrackList();
		ModalLyricCreator.#renderTracks();
		ModalLyricCreator.#renderWaveform();
		ModalLyricCreator.#updatePlayhead(0);
		ModalLyricCreator.#startRaf();

		// Fetch the song from the database so user doesn't have to upload it
		ModalLyricCreator.#loadSongFromDatabase();
	}

	/**
	 * Closes the modal, cleans up audio resources, restores visualizer
	 * playback state if applicable.
	 */
	static close() {
		if (!ModalLyricCreator.isOpen) return;
		ModalLyricCreator.isOpen = false;
		cancelAnimationFrame(ModalLyricCreator.#rafHandle);
		ModalLyricCreator.#rafHandle = 0;
		if (ModalLyricCreator.#audio) {
			try { ModalLyricCreator.#audio.pause(); } catch (_) {}
			ModalLyricCreator.#audio.src = "";
		}
		if (ModalLyricCreator.#audioUrl) {
			try { URL.revokeObjectURL(ModalLyricCreator.#audioUrl); } catch (_) {}
			ModalLyricCreator.#audioUrl = null;
		}
		if (ModalLyricCreator.#audioCtx) {
			try { ModalLyricCreator.#audioCtx.close(); } catch (_) {}
			ModalLyricCreator.#audioCtx = null;
		}
		ModalLyricCreator.#audioBuffer = null;
		ModalLyricCreator.#peaks = null;
		ModalLyricCreator.#duration = 0;
		if (ModalLyricCreator.#overlay) ModalLyricCreator.#overlay.style.display = "none";
		ModalLyricCreator.#hideContextMenu();
		ModalLyricCreator.#hideEditDialog();

		// Resume the visualizer if it was playing before we opened
		if (ModalLyricCreator.#wasMainPlaying) {
			try { if (window.player) window.player.play(); } catch (_) {}
			ModalLyricCreator.#wasMainPlaying = false;
		}
	}

	// ─── DOM construction ──────────────────────────────────────────────────────

	/**
	 * Ensures all DOM nodes exist. Idempotent — building once on first open.
	 */
	static #ensureDom() {
		if (ModalLyricCreator.#overlay) return;

		let overlay = document.createElement("div");
		overlay.className = "lc-overlay";
		overlay.style.cssText = [
			"position:fixed", "inset:0", "z-index:9998",
			"background:rgba(0,0,0,0.85)", "display:none",
			"align-items:center", "justify-content:center",
			"backdrop-filter:blur(4px)"
		].join(";");
		// Backdrop clicks are intentionally ignored — close only via X
		overlay.addEventListener("click", function (ev) { ev.stopPropagation(); });

		let panel = document.createElement("div");
		panel.className = "lc-panel";
		panel.style.cssText = [
			"position:relative", "width:96vw", "height:94vh",
			"background:#141821", "border-radius:14px",
			"box-shadow:0 12px 48px rgba(0,0,0,0.6)",
			"display:flex", "flex-direction:column",
			"overflow:hidden", "color:#eaeaf0",
			"font-family:system-ui,sans-serif"
		].join(";");
		overlay.appendChild(panel);

		// Close button (only way to close)
		let closeBtn = document.createElement("button");
		closeBtn.className = "lc-close";
		closeBtn.innerText = "X";
		closeBtn.style.cssText = [
			"position:absolute", "top:8px", "right:8px",
			"width:32px", "height:32px", "border-radius:50%",
			"background:rgba(255,255,255,0.08)",
			"color:#fff", "border:1px solid rgba(255,255,255,0.15)",
			"font-size:14px", "cursor:pointer", "z-index:10"
		].join(";");
		closeBtn.addEventListener("click", function () { ModalLyricCreator.close(); });
		panel.appendChild(closeBtn);
		ModalLyricCreator.#closeBtn = closeBtn;

		// Header
		let header = document.createElement("div");
		header.style.cssText = "padding:12px 44px 6px 16px;flex-shrink:0;";
		header.innerHTML = "<div style='font-size:18px;font-weight:600;'>Lyric Creator</div>" +
			"<div style='font-size:12px;color:rgba(255,255,255,0.5);'>Drop a song file, scrub the timeline, right-click to add blocks.</div>";
		panel.appendChild(header);

		// Toolbar — the song is auto-loaded from the DB so no file upload here.
		let toolbar = document.createElement("div");
		toolbar.style.cssText = "display:flex;gap:8px;align-items:center;padding:6px 16px;flex-shrink:0;flex-wrap:wrap;";
		toolbar.innerHTML = ""
			+ "<div id='lc-song-info' style='flex:1;min-width:200px;font-size:13px;color:rgba(255,255,255,0.7);padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:6px;'>Loading song…</div>"
			+ "<button id='lc-play' style='padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;cursor:pointer;' disabled>Play</button>"
			+ "<button id='lc-autogen' style='padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;cursor:pointer;' disabled>Auto-Generate Lyrics</button>"
			+ "<label style='font-size:13px;display:flex;align-items:center;gap:4px;cursor:pointer;'><input type='checkbox' id='lc-autoscroll' checked /> Autoscroll</label>"
			+ "<label style='font-size:13px;display:flex;align-items:center;gap:4px;cursor:pointer;'>Zoom <input type='range' id='lc-zoom' min='30' max='400' value='100' style='width:120px;' /></label>"
			+ "<span id='lc-time-display' style='font-family:monospace;font-size:13px;min-width:120px;text-align:right;'>00:00.00 / 00:00.00</span>"
			+ "<button id='lc-finish' style='padding:6px 14px;border-radius:6px;border:1px solid rgba(100,255,150,0.4);background:rgba(100,255,150,0.12);color:#d0ffd6;cursor:pointer;' disabled>Finish & Save</button>";
		panel.appendChild(toolbar);

		// Load status line
		let status = document.createElement("div");
		status.id = "lc-status";
		status.style.cssText = "padding:0 16px 4px 16px;font-size:12px;color:rgba(255,255,255,0.5);height:18px;";
		panel.appendChild(status);
		ModalLyricCreator.#loadStatusEl = status;

		// Main body: left track list, right scrollable timeline
		let body = document.createElement("div");
		body.style.cssText = "flex:1;display:flex;min-height:0;overflow:hidden;";
		panel.appendChild(body);

		let trackList = document.createElement("div");
		trackList.id = "lc-track-list";
		trackList.style.cssText = "width:140px;flex-shrink:0;background:rgba(0,0,0,0.2);border-right:1px solid rgba(255,255,255,0.08);overflow:auto;";
		body.appendChild(trackList);
		ModalLyricCreator.#trackListEl = trackList;

		let timeline = document.createElement("div");
		timeline.id = "lc-timeline";
		timeline.style.cssText = "flex:1;position:relative;overflow-x:auto;overflow-y:hidden;";
		body.appendChild(timeline);
		ModalLyricCreator.#timelineEl = timeline;

		// Inner content that grows horizontally with duration.
		// Width is updated by #syncTimelineWidth() whenever duration or zoom changes.
		let inner = document.createElement("div");
		inner.id = "lc-inner";
		inner.style.cssText = "position:relative;min-width:100%;height:100%;display:flex;flex-direction:column;";
		timeline.appendChild(inner);

		// Scrubber (time ruler)
		let scrubber = document.createElement("div");
		scrubber.id = "lc-scrubber";
		scrubber.style.cssText = "height:20px;background:rgba(0,0,0,0.3);position:relative;border-bottom:1px solid rgba(255,255,255,0.1);cursor:pointer;flex-shrink:0;";
		inner.appendChild(scrubber);
		ModalLyricCreator.#scrubberEl = scrubber;

		// Waveform canvas
		let waveCanvas = document.createElement("canvas");
		waveCanvas.id = "lc-waveform";
		waveCanvas.style.cssText = "display:block;width:100%;height:120px;background:#0a0d14;";
		inner.appendChild(waveCanvas);
		ModalLyricCreator.#waveCanvas = waveCanvas;
		ModalLyricCreator.#waveCtx = waveCanvas.getContext("2d");

		// Tracks wrapper
		let tracksEl = document.createElement("div");
		tracksEl.id = "lc-tracks";
		tracksEl.style.cssText = "position:relative;min-height:120px;background:#161922;";
		inner.appendChild(tracksEl);
		ModalLyricCreator.#tracksEl = tracksEl;

		// Playhead — drawn on top of inner, spans full height
		let playhead = document.createElement("div");
		playhead.id = "lc-playhead";
		playhead.style.cssText = "position:absolute;top:0;left:0;width:2px;height:100%;background:#ff5252;box-shadow:0 0 6px rgba(255,80,80,0.8);pointer-events:none;z-index:5;";
		inner.appendChild(playhead);
		ModalLyricCreator.#playhead = playhead;

		// Context menu (reused)
		let menu = document.createElement("div");
		menu.className = "lc-context-menu";
		menu.style.cssText = "position:fixed;display:none;background:#1f2632;border:1px solid rgba(255,255,255,0.15);border-radius:6px;min-width:160px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.6);font-size:13px;";
		overlay.appendChild(menu);
		ModalLyricCreator.#contextMenuEl = menu;

		// Edit dialog (reused)
		let editDlg = document.createElement("div");
		editDlg.className = "lc-edit-dialog";
		editDlg.style.cssText = "position:fixed;display:none;top:50%;left:50%;transform:translate(-50%,-50%);background:#1f2632;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:16px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.7);min-width:380px;";
		overlay.appendChild(editDlg);
		ModalLyricCreator.#editDialogEl = editDlg;

		document.body.appendChild(overlay);
		ModalLyricCreator.#overlay = overlay;

		ModalLyricCreator.#wireDomHandlers();
	}

	/**
	 * Wires all DOM event handlers once on first build.
	 */
	static #wireDomHandlers() {
		let playBtn = document.getElementById("lc-play");
		let autoBtn = document.getElementById("lc-autogen");
		let autoscrollCb = document.getElementById("lc-autoscroll");
		let zoomSlider = document.getElementById("lc-zoom");
		let finishBtn = document.getElementById("lc-finish");

		if (playBtn) {
			playBtn.addEventListener("click", function () {
				if (!ModalLyricCreator.#audio) return;
				if (ModalLyricCreator.#audio.paused) {
					ModalLyricCreator.#audio.play();
					playBtn.innerText = "Pause";
				} else {
					ModalLyricCreator.#audio.pause();
					playBtn.innerText = "Play";
				}
			});
		}

		if (autoBtn) {
			autoBtn.addEventListener("click", function () { ModalLyricCreator.#autoGenerate(); });
		}

		if (autoscrollCb) {
			autoscrollCb.addEventListener("change", function () {
				ModalLyricCreator.#autoscroll = autoscrollCb.checked;
			});
		}

		if (zoomSlider) {
			zoomSlider.addEventListener("input", function () {
				ModalLyricCreator.#pixelsPerSecond = parseFloat(zoomSlider.value);
				ModalLyricCreator.#renderWaveform();
				ModalLyricCreator.#renderTracks();
				ModalLyricCreator.#renderScrubber();
				ModalLyricCreator.#updatePlayhead(ModalLyricCreator.#audio ? ModalLyricCreator.#audio.currentTime : 0);
			});
		}

		if (finishBtn) {
			finishBtn.addEventListener("click", function () { ModalLyricCreator.#finish(); });
		}

		// Timeline scrubber click → seek
		if (ModalLyricCreator.#scrubberEl) {
			ModalLyricCreator.#scrubberEl.addEventListener("click", function (ev) {
				if (!ModalLyricCreator.#audio) return;
				let rect = ModalLyricCreator.#scrubberEl.getBoundingClientRect();
				let sec = (ev.clientX - rect.left) / ModalLyricCreator.#pixelsPerSecond;
				ModalLyricCreator.#audio.currentTime = Math.max(0, Math.min(sec, ModalLyricCreator.#duration));
			});
		}

		// Waveform click → seek
		if (ModalLyricCreator.#waveCanvas) {
			ModalLyricCreator.#waveCanvas.addEventListener("click", function (ev) {
				if (!ModalLyricCreator.#audio) return;
				let rect = ModalLyricCreator.#waveCanvas.getBoundingClientRect();
				let sec = (ev.clientX - rect.left) / ModalLyricCreator.#pixelsPerSecond;
				ModalLyricCreator.#audio.currentTime = Math.max(0, Math.min(sec, ModalLyricCreator.#duration));
			});
		}

		// Context menu on timeline (background)
		if (ModalLyricCreator.#tracksEl) {
			ModalLyricCreator.#tracksEl.addEventListener("contextmenu", function (ev) {
				ev.preventDefault();
				let target = ev.target.closest(".lc-block");
				if (target) {
					ModalLyricCreator.#showBlockContextMenu(ev.clientX, ev.clientY, target);
				} else {
					let trackEl = ev.target.closest(".lc-track");
					if (trackEl) {
						let trackId = trackEl.getAttribute("data-track-id");
						ModalLyricCreator.#showEmptyContextMenu(ev.clientX, ev.clientY, trackId);
					}
				}
			});
		}

		// Horizontal drag-scroll when dragging on scrubber or waveform empty space
		let startDragScroll = function (ev) {
			// Only scrubber + waveform; tracks area is reserved for block drag
			if (!ModalLyricCreator.#timelineEl) return;
			if (ev.button !== 0) return;
			if (ev.target.closest(".lc-block")) return;
			if (ev.target.closest("#lc-tracks")) return;
			ModalLyricCreator.#scrollDrag = {
				startX: ev.clientX,
				startScroll: ModalLyricCreator.#timelineEl.scrollLeft
			};
			ev.preventDefault();
		};
		if (ModalLyricCreator.#scrubberEl) ModalLyricCreator.#scrubberEl.addEventListener("mousedown", startDragScroll);
		if (ModalLyricCreator.#waveCanvas) ModalLyricCreator.#waveCanvas.addEventListener("mousedown", startDragScroll);

		// Mouse move handles block drag and scroll-drag
		document.addEventListener("mousemove", function (ev) {
			if (ModalLyricCreator.#scrollDrag) {
				let dx = ev.clientX - ModalLyricCreator.#scrollDrag.startX;
				ModalLyricCreator.#timelineEl.scrollLeft = ModalLyricCreator.#scrollDrag.startScroll - dx;
			}
			if (ModalLyricCreator.#dragBlock) {
				let rect = ModalLyricCreator.#tracksEl.getBoundingClientRect();
				let mouseSec = (ev.clientX - rect.left + ModalLyricCreator.#timelineEl.scrollLeft) / ModalLyricCreator.#pixelsPerSecond;
				let newStart = mouseSec - ModalLyricCreator.#dragBlock.offsetStartSec;
				let block = ModalLyricCreator.#dragBlock.block;
				let span = block.end - block.start;
				block.start = Math.max(0, Math.min(newStart, ModalLyricCreator.#duration - span));
				block.end = block.start + span;
				ModalLyricCreator.#renderTracks();
			}
		});

		document.addEventListener("mouseup", function () {
			ModalLyricCreator.#scrollDrag = null;
			ModalLyricCreator.#dragBlock = null;
		});

		// Hide context menu on any click outside
		document.addEventListener("click", function (ev) {
			let menu = ModalLyricCreator.#contextMenuEl;
			if (menu && menu.style.display !== "none" && !menu.contains(ev.target)) {
				ModalLyricCreator.#hideContextMenu();
			}
		});
	}

	// ─── Audio loading ─────────────────────────────────────────────────────────

	/**
	 * Loads the song associated with the target songId from the database.
	 * Fetches the audio stream URL via getSongById.php, then downloads the
	 * audio bytes to decode via Web Audio API for waveform peak extraction.
	 */
	static async #loadSongFromDatabase() {
		if (!ModalLyricCreator.songId) return;
		if (ModalLyricCreator.#loadStatusEl) ModalLyricCreator.#loadStatusEl.innerText = "Fetching song metadata…";

		let songInfoEl = document.getElementById("lc-song-info");
		if (songInfoEl) songInfoEl.innerText = "Loading…";

		let streamUrl = null;
		let title = null;
		try {
			let meta = await Api.send("assets/php/getSongById.php", { song_id: ModalLyricCreator.songId });
			if (!meta || !meta.success || !meta.song) {
				if (songInfoEl) songInfoEl.innerText = "Could not load song from database.";
				Toast.error("Song not found.");
				return;
			}
			streamUrl = meta.song.stream_url || meta.song.path;
			title = (meta.song.artist ? meta.song.artist + " — " : "") + (meta.song.title || ModalLyricCreator.songId);
		} catch (e) {
			if (songInfoEl) songInfoEl.innerText = "Metadata fetch failed.";
			Toast.error("Failed to load song metadata.");
			return;
		}

		if (!streamUrl) {
			if (songInfoEl) songInfoEl.innerText = "No audio file available for this song.";
			return;
		}
		if (songInfoEl) songInfoEl.innerText = title + " — loading audio…";

		// Wire a fresh <audio> element with progress listeners
		if (!ModalLyricCreator.#audio) {
			let audio = document.createElement("audio");
			audio.preload = "auto";
			audio.crossOrigin = "use-credentials";
			audio.addEventListener("play", function () {
				let btn = document.getElementById("lc-play");
				if (btn) btn.innerText = "Pause";
			});
			audio.addEventListener("pause", function () {
				let btn = document.getElementById("lc-play");
				if (btn) btn.innerText = "Play";
			});
			audio.addEventListener("ended", function () {
				let btn = document.getElementById("lc-play");
				if (btn) btn.innerText = "Play";
			});
			ModalLyricCreator.#audio = audio;
		}
		ModalLyricCreator.#audio.src = streamUrl;

		// Download the audio to an ArrayBuffer for Web Audio decoding. We use
		// `fetch` with credentials so authenticated sessions still stream.
		try {
			let resp = await fetch(streamUrl, { credentials: "same-origin" });
			if (!resp.ok) throw new Error("HTTP " + resp.status);
			let arr = await resp.arrayBuffer();
			let ctx = new (window.AudioContext || window.webkitAudioContext)();
			ModalLyricCreator.#audioCtx = ctx;
			let buf = await ctx.decodeAudioData(arr.slice(0));
			ModalLyricCreator.#audioBuffer = buf;
			ModalLyricCreator.#duration = buf.duration;
			ModalLyricCreator.#peaks = ModalLyricCreator.#extractPeaks(buf, 4000);
			ModalLyricCreator.#renderWaveform();
			ModalLyricCreator.#renderScrubber();
			ModalLyricCreator.#renderTracks();
			if (songInfoEl) songInfoEl.innerText = title + " (" + ModalLyricCreator.#formatTime(buf.duration) + ")";
			if (ModalLyricCreator.#loadStatusEl) ModalLyricCreator.#loadStatusEl.innerText = "Song loaded.";

			let playBtn = document.getElementById("lc-play");
			if (playBtn) playBtn.disabled = false;
			let autoBtn = document.getElementById("lc-autogen");
			if (autoBtn) autoBtn.disabled = false;
			let finishBtn = document.getElementById("lc-finish");
			if (finishBtn) finishBtn.disabled = false;
		} catch (err) {
			if (songInfoEl) songInfoEl.innerText = "Audio decoding failed: " + err.message;
			Toast.error("Could not decode audio.");
		}
	}

	/**
	 * Extracts min/max peaks at a fixed horizontal resolution from the
	 * decoded AudioBuffer, averaging across all channels.
	 * @param {AudioBuffer} buf
	 * @param {number} samples - number of peak pairs to produce
	 * @returns {Float32Array} [min0, max0, min1, max1, ...] length = samples*2
	 */
	static #extractPeaks(buf, samples) {
		let channels = buf.numberOfChannels;
		let length = buf.length;
		let blockSize = Math.floor(length / samples);
		if (blockSize < 1) blockSize = 1;
		let peaks = new Float32Array(samples * 2);
		let chans = [];
		for (let c = 0; c < channels; c++) chans.push(buf.getChannelData(c));
		for (let i = 0; i < samples; i++) {
			let start = i * blockSize;
			let min = 1, max = -1;
			for (let j = 0; j < blockSize && start + j < length; j++) {
				let sum = 0;
				for (let c = 0; c < channels; c++) sum += chans[c][start + j];
				let v = sum / channels;
				if (v < min) min = v;
				if (v > max) max = v;
			}
			peaks[i * 2] = min;
			peaks[i * 2 + 1] = max;
		}
		return peaks;
	}

	// ─── Rendering ─────────────────────────────────────────────────────────────

	/**
	 * Renders the waveform canvas, sized to duration × pixelsPerSecond.
	 */
	static #renderWaveform() {
		let cv = ModalLyricCreator.#waveCanvas;
		let ctx = ModalLyricCreator.#waveCtx;
		if (!cv || !ctx) return;
		let pxPerSec = ModalLyricCreator.#pixelsPerSecond;
		let width = Math.max(100, Math.round(ModalLyricCreator.#duration * pxPerSec));
		let height = 120;
		cv.width = width;
		cv.height = height;
		cv.style.width = width + "px";
		cv.style.height = height + "px";

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#0a0d14";
		ctx.fillRect(0, 0, width, height);

		if (!ModalLyricCreator.#peaks) {
			ctx.fillStyle = "rgba(255,255,255,0.3)";
			ctx.font = "13px system-ui";
			ctx.textAlign = "center";
			ctx.fillText("No audio loaded — drop a file above", width / 2, height / 2);
			return;
		}

		let peaks = ModalLyricCreator.#peaks;
		let peaksLen = peaks.length / 2;
		let mid = height / 2;
		let gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, "#5aa2ff");
		gradient.addColorStop(1, "#3468b8");
		ctx.fillStyle = gradient;

		for (let x = 0; x < width; x++) {
			let peakIndex = Math.floor((x / width) * peaksLen);
			let min = peaks[peakIndex * 2];
			let max = peaks[peakIndex * 2 + 1];
			let y1 = mid - max * mid;
			let y2 = mid - min * mid;
			ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
		}

		// Center line
		ctx.strokeStyle = "rgba(255,255,255,0.08)";
		ctx.beginPath();
		ctx.moveTo(0, mid);
		ctx.lineTo(width, mid);
		ctx.stroke();
	}

	/**
	 * Renders the time ruler above the waveform with 1-second ticks.
	 */
	static #renderScrubber() {
		let scrubber = ModalLyricCreator.#scrubberEl;
		if (!scrubber) return;
		let pxPerSec = ModalLyricCreator.#pixelsPerSecond;
		let width = Math.max(100, Math.round(ModalLyricCreator.#duration * pxPerSec));
		scrubber.style.width = width + "px";

		// Rebuild tick marks via innerHTML (fast; tiny)
		let html = "";
		let tickStepSec = pxPerSec >= 100 ? 1 : (pxPerSec >= 50 ? 2 : 5);
		for (let s = 0; s <= ModalLyricCreator.#duration; s += tickStepSec) {
			let x = s * pxPerSec;
			html += "<div style='position:absolute;left:" + x + "px;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.15);'></div>";
			html += "<div style='position:absolute;left:" + (x + 2) + "px;top:2px;font-size:10px;color:rgba(255,255,255,0.45);font-family:monospace;'>" + ModalLyricCreator.#formatTime(s) + "</div>";
		}
		scrubber.innerHTML = html;
	}

	/**
	 * Returns the timeline pixel width for the current duration and zoom.
	 */
	static #computeTimelineWidth() {
		let pxPerSec = ModalLyricCreator.#pixelsPerSecond;
		return Math.max(100, Math.round((ModalLyricCreator.#duration || 1) * pxPerSec));
	}

	/**
	 * Sizes every timeline descendant to the computed timeline width so that
	 * horizontal scroll + absolutely-positioned blocks line up consistently.
	 */
	static #syncTimelineWidth() {
		let w = ModalLyricCreator.#computeTimelineWidth();
		let inner = document.getElementById("lc-inner");
		if (inner) inner.style.width = w + "px";
		if (ModalLyricCreator.#scrubberEl) ModalLyricCreator.#scrubberEl.style.width = w + "px";
		if (ModalLyricCreator.#tracksEl) ModalLyricCreator.#tracksEl.style.width = w + "px";
		if (ModalLyricCreator.#waveCanvas) {
			ModalLyricCreator.#waveCanvas.style.width = w + "px";
		}
	}

	/**
	 * Renders all tracks + their blocks.
	 */
	static #renderTracks() {
		let container = ModalLyricCreator.#tracksEl;
		if (!container) return;
		let pxPerSec = ModalLyricCreator.#pixelsPerSecond;
		ModalLyricCreator.#syncTimelineWidth();
		let width = ModalLyricCreator.#computeTimelineWidth();
		container.style.width = width + "px";
		// The tracks container needs a minimum height equal to tracks × 60px
		// so the blocks are not clipped by a 0-height container.
		container.style.minHeight = Math.max(120, ModalLyricCreator.#tracks.length * 60) + "px";

		let html = "";
		for (let t = 0; t < ModalLyricCreator.#tracks.length; t++) {
			let track = ModalLyricCreator.#tracks[t];
			html += "<div class='lc-track' data-track-id='" + track.id + "' style='position:relative;height:60px;border-bottom:1px solid rgba(255,255,255,0.06);'>";
			for (let b = 0; b < track.blocks.length; b++) {
				let bl = track.blocks[b];
				let x = bl.start * pxPerSec;
				let w = Math.max(2, (bl.end - bl.start) * pxPerSec);
				let text = ModalLyricCreator.#escape(bl.text || "");
				html += "<div class='lc-block' data-block-id='" + bl.id + "' data-track-id='" + track.id + "' "
					+ "style='position:absolute;left:" + x + "px;top:6px;width:" + w + "px;height:48px;"
					+ "background:rgba(90,160,255,0.25);border:1px solid rgba(130,180,255,0.6);border-radius:4px;"
					+ "padding:4px 6px;font-size:12px;color:#e4ecff;overflow:hidden;cursor:move;user-select:none;'>"
					+ text + "</div>";
			}
			html += "</div>";
		}
		container.innerHTML = html;

		// Wire drag on blocks
		let blocks = container.querySelectorAll(".lc-block");
		for (let i = 0; i < blocks.length; i++) {
			blocks[i].addEventListener("mousedown", function (ev) {
				if (ev.button !== 0) return;
				let blockId = parseInt(this.getAttribute("data-block-id"), 10);
				let trackId = parseInt(this.getAttribute("data-track-id"), 10);
				let found = ModalLyricCreator.#findBlock(trackId, blockId);
				if (!found) return;
				let rect = ModalLyricCreator.#tracksEl.getBoundingClientRect();
				let mouseSec = (ev.clientX - rect.left + ModalLyricCreator.#timelineEl.scrollLeft) / ModalLyricCreator.#pixelsPerSecond;
				ModalLyricCreator.#dragBlock = {
					block: found.block,
					trackId: trackId,
					offsetStartSec: mouseSec - found.block.start
				};
				ev.preventDefault();
				ev.stopPropagation();
			});
		}
	}

	/**
	 * Renders the left-side track list (labels + add-track button).
	 */
	static #renderTrackList() {
		let el = ModalLyricCreator.#trackListEl;
		if (!el) return;
		let html = "<div style='padding:10px 8px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;'>Tracks</div>";
		// Scrubber row (same height as scrubber)
		html += "<div style='height:20px;border-bottom:1px solid rgba(255,255,255,0.1);'></div>";
		// Waveform row (same height as waveform)
		html += "<div style='height:120px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;color:rgba(255,255,255,0.4);'>Waveform</div>";
		// Track rows
		for (let t = 0; t < ModalLyricCreator.#tracks.length; t++) {
			let track = ModalLyricCreator.#tracks[t];
			html += "<div style='height:60px;display:flex;align-items:center;padding:0 8px;border-bottom:1px solid rgba(255,255,255,0.06);gap:4px;'>";
			html += "<input type='text' data-track-id='" + track.id + "' class='lc-track-name' value='" + ModalLyricCreator.#escape(track.name) + "' style='flex:1;background:transparent;border:none;color:#fff;font-size:12px;outline:none;' />";
			html += "<button class='lc-del-track' data-track-id='" + track.id + "' style='background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;'>X</button>";
			html += "</div>";
		}
		html += "<button id='lc-add-track' style='margin:8px;padding:6px;background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:12px;width:calc(100% - 16px);'>+ Add Track</button>";
		el.innerHTML = html;

		let addBtn = document.getElementById("lc-add-track");
		if (addBtn) {
			addBtn.addEventListener("click", function () {
				ModalLyricCreator.#tracks.push(ModalLyricCreator.#createEmptyTrack("Track " + (ModalLyricCreator.#tracks.length + 1)));
				ModalLyricCreator.#renderTrackList();
				ModalLyricCreator.#renderTracks();
			});
		}
		let delBtns = el.querySelectorAll(".lc-del-track");
		for (let i = 0; i < delBtns.length; i++) {
			delBtns[i].addEventListener("click", function () {
				let tid = parseInt(this.getAttribute("data-track-id"), 10);
				if (ModalLyricCreator.#tracks.length <= 1) {
					Toast.error("At least one track is required.");
					return;
				}
				ModalLyricCreator.#tracks = ModalLyricCreator.#tracks.filter(t => t.id !== tid);
				ModalLyricCreator.#renderTrackList();
				ModalLyricCreator.#renderTracks();
			});
		}
		let nameInputs = el.querySelectorAll(".lc-track-name");
		for (let i = 0; i < nameInputs.length; i++) {
			nameInputs[i].addEventListener("input", function () {
				let tid = parseInt(this.getAttribute("data-track-id"), 10);
				let track = ModalLyricCreator.#tracks.find(t => t.id === tid);
				if (track) track.name = this.value;
			});
		}
	}

	// ─── Playhead + RAF ────────────────────────────────────────────────────────

	/**
	 * Starts the 60fps RAF loop that updates the playhead and autoscrolls.
	 */
	static #startRaf() {
		let tick = function () {
			if (!ModalLyricCreator.isOpen) return;
			let audio = ModalLyricCreator.#audio;
			let t = audio ? audio.currentTime : 0;
			ModalLyricCreator.#updatePlayhead(t);
			ModalLyricCreator.#updateTimeDisplay(t);
			ModalLyricCreator.#rafHandle = requestAnimationFrame(tick);
		};
		ModalLyricCreator.#rafHandle = requestAnimationFrame(tick);
	}

	/**
	 * Sets the playhead x-position and optionally auto-scrolls to keep it visible.
	 * @param {number} seconds - current audio time
	 */
	static #updatePlayhead(seconds) {
		let ph = ModalLyricCreator.#playhead;
		if (!ph) return;
		let x = seconds * ModalLyricCreator.#pixelsPerSecond;
		ph.style.left = x + "px";

		if (ModalLyricCreator.#autoscroll && ModalLyricCreator.#timelineEl && ModalLyricCreator.#audio && !ModalLyricCreator.#audio.paused) {
			let el = ModalLyricCreator.#timelineEl;
			let center = x - el.clientWidth / 2;
			el.scrollLeft = Math.max(0, center);
		}
	}

	/**
	 * Updates the "00:00.00 / 00:00.00" text display.
	 * @param {number} cur
	 */
	static #updateTimeDisplay(cur) {
		let el = document.getElementById("lc-time-display");
		if (!el) return;
		el.innerText = ModalLyricCreator.#formatTime(cur) + " / " + ModalLyricCreator.#formatTime(ModalLyricCreator.#duration);
	}

	// ─── Context menus & edit dialog ───────────────────────────────────────────

	/**
	 * Shows the right-click menu for empty timeline area: "Create block at playhead".
	 */
	static #showEmptyContextMenu(x, y, trackId) {
		let menu = ModalLyricCreator.#contextMenuEl;
		if (!menu) return;
		menu.innerHTML = ""
			+ "<div class='lc-mi' data-action='create'>+ Create lyric block at playhead</div>"
			+ "<div class='lc-mi' data-action='paste-lyrics'>Paste lyrics from clipboard…</div>";
		ModalLyricCreator.#styleContextMenuItems(menu);
		menu.style.left = x + "px";
		menu.style.top = y + "px";
		menu.style.display = "block";
		let items = menu.querySelectorAll(".lc-mi");
		items.forEach(function (item) {
			item.addEventListener("click", function () {
				let action = this.getAttribute("data-action");
				ModalLyricCreator.#hideContextMenu();
				if (action === "create") {
					ModalLyricCreator.#createBlockAtPlayhead(parseInt(trackId, 10));
				} else if (action === "paste-lyrics") {
					ModalLyricCreator.#pasteLyricsIntoTrack(parseInt(trackId, 10));
				}
			});
		});
	}

	/**
	 * Shows the right-click menu for a lyric block: edit / split / delete.
	 */
	static #showBlockContextMenu(x, y, blockEl) {
		let menu = ModalLyricCreator.#contextMenuEl;
		if (!menu) return;
		let blockId = parseInt(blockEl.getAttribute("data-block-id"), 10);
		let trackId = parseInt(blockEl.getAttribute("data-track-id"), 10);
		menu.innerHTML = ""
			+ "<div class='lc-mi' data-action='edit'>✎ Edit text</div>"
			+ "<div class='lc-mi' data-action='split'>⟋ Split at playhead</div>"
			+ "<div class='lc-mi' data-action='delete'>🗑 Delete block</div>";
		ModalLyricCreator.#styleContextMenuItems(menu);
		menu.style.left = x + "px";
		menu.style.top = y + "px";
		menu.style.display = "block";
		let items = menu.querySelectorAll(".lc-mi");
		items.forEach(function (item) {
			item.addEventListener("click", function () {
				let action = this.getAttribute("data-action");
				ModalLyricCreator.#hideContextMenu();
				if (action === "edit") ModalLyricCreator.#openEditDialog(trackId, blockId);
				if (action === "split") ModalLyricCreator.#splitBlockAtPlayhead(trackId, blockId);
				if (action === "delete") ModalLyricCreator.#deleteBlock(trackId, blockId);
			});
		});
	}

	static #styleContextMenuItems(menu) {
		let items = menu.querySelectorAll(".lc-mi");
		items.forEach(function (it) {
			it.style.cssText = "padding:8px 14px;cursor:pointer;color:#eaeaf0;border-bottom:1px solid rgba(255,255,255,0.05);";
			it.addEventListener("mouseenter", function () { this.style.background = "rgba(255,255,255,0.08)"; });
			it.addEventListener("mouseleave", function () { this.style.background = ""; });
		});
	}

	static #hideContextMenu() {
		if (ModalLyricCreator.#contextMenuEl) ModalLyricCreator.#contextMenuEl.style.display = "none";
	}

	/**
	 * Opens the text editor dialog for a block.
	 */
	static #openEditDialog(trackId, blockId) {
		let found = ModalLyricCreator.#findBlock(trackId, blockId);
		if (!found) return;
		let dlg = ModalLyricCreator.#editDialogEl;
		if (!dlg) return;
		dlg.innerHTML = ""
			+ "<div style='font-size:14px;font-weight:600;margin-bottom:8px;'>Edit Lyric Block</div>"
			+ "<div style='font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px;'>"
			+ "Start: " + ModalLyricCreator.#formatTime(found.block.start)
			+ " — End: " + ModalLyricCreator.#formatTime(found.block.end) + "</div>"
			+ "<textarea id='lc-edit-text' style='width:100%;min-height:100px;background:#0f131c;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:8px;font-family:system-ui,sans-serif;font-size:13px;resize:vertical;'>" + ModalLyricCreator.#escape(found.block.text || "") + "</textarea>"
			+ "<div style='display:flex;gap:8px;justify-content:flex-end;margin-top:10px;'>"
			+ "<button id='lc-edit-cancel' style='padding:6px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;cursor:pointer;'>Cancel</button>"
			+ "<button id='lc-edit-save' style='padding:6px 14px;border-radius:4px;border:1px solid rgba(100,255,150,0.4);background:rgba(100,255,150,0.12);color:#d0ffd6;cursor:pointer;'>Save</button>"
			+ "</div>";
		dlg.style.display = "block";
		let ta = document.getElementById("lc-edit-text");
		if (ta) ta.focus();
		let cancel = document.getElementById("lc-edit-cancel");
		if (cancel) cancel.addEventListener("click", function () { ModalLyricCreator.#hideEditDialog(); });
		let save = document.getElementById("lc-edit-save");
		if (save) save.addEventListener("click", function () {
			let txt = document.getElementById("lc-edit-text");
			if (txt) found.block.text = txt.value;
			ModalLyricCreator.#hideEditDialog();
			ModalLyricCreator.#renderTracks();
		});
	}

	static #hideEditDialog() {
		if (ModalLyricCreator.#editDialogEl) ModalLyricCreator.#editDialogEl.style.display = "none";
	}

	// ─── Block operations ──────────────────────────────────────────────────────

	/**
	 * Creates a new block starting at the playhead, spanning 2 seconds by default.
	 */
	static #createBlockAtPlayhead(trackId) {
		let track = ModalLyricCreator.#tracks.find(t => t.id === trackId);
		if (!track) return;
		let t = ModalLyricCreator.#audio ? ModalLyricCreator.#audio.currentTime : 0;
		let end = Math.min(ModalLyricCreator.#duration || (t + 2), t + 2);
		let block = {
			id: ModalLyricCreator.#nextBlockId++,
			start: t,
			end: end,
			text: ""
		};
		track.blocks.push(block);
		track.blocks.sort((a, b) => a.start - b.start);
		ModalLyricCreator.#renderTracks();
		ModalLyricCreator.#openEditDialog(track.id, block.id);
	}

	/**
	 * Splits a block at the current playhead position (must be within block).
	 */
	static #splitBlockAtPlayhead(trackId, blockId) {
		let found = ModalLyricCreator.#findBlock(trackId, blockId);
		if (!found) return;
		let t = ModalLyricCreator.#audio ? ModalLyricCreator.#audio.currentTime : found.block.start + (found.block.end - found.block.start) / 2;
		if (t <= found.block.start + 0.05 || t >= found.block.end - 0.05) {
			Toast.error("Playhead must be inside the block to split.");
			return;
		}
		let newBlock = {
			id: ModalLyricCreator.#nextBlockId++,
			start: t,
			end: found.block.end,
			text: found.block.text
		};
		found.block.end = t;
		found.track.blocks.push(newBlock);
		found.track.blocks.sort((a, b) => a.start - b.start);
		ModalLyricCreator.#renderTracks();
	}

	/**
	 * Deletes a block.
	 */
	static #deleteBlock(trackId, blockId) {
		let track = ModalLyricCreator.#tracks.find(t => t.id === trackId);
		if (!track) return;
		track.blocks = track.blocks.filter(b => b.id !== blockId);
		ModalLyricCreator.#renderTracks();
	}

	/**
	 * Lookup helper → {track, block} or null.
	 */
	static #findBlock(trackId, blockId) {
		let track = ModalLyricCreator.#tracks.find(t => t.id === trackId);
		if (!track) return null;
		let block = track.blocks.find(b => b.id === blockId);
		if (!block) return null;
		return { track, block };
	}

	/**
	 * Paste clipboard text, splitting lines and evenly spacing them from the
	 * playhead forward (2 sec each). Each non-empty line becomes one block.
	 */
	static async #pasteLyricsIntoTrack(trackId) {
		let track = ModalLyricCreator.#tracks.find(t => t.id === trackId);
		if (!track) return;
		let text = "";
		try {
			text = await navigator.clipboard.readText();
		} catch (_) {
			Toast.error("Clipboard unavailable.");
			return;
		}
		if (!text) return;
		let lines = text.split(/\r?\n/).map(l => l.trim());
		let t = ModalLyricCreator.#audio ? ModalLyricCreator.#audio.currentTime : 0;
		let step = 2;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].length === 0) { t += step / 2; continue; }
			let start = t;
			let end = Math.min((ModalLyricCreator.#duration || (t + step)), t + step);
			track.blocks.push({
				id: ModalLyricCreator.#nextBlockId++,
				start, end,
				text: lines[i]
			});
			t += step;
		}
		track.blocks.sort((a, b) => a.start - b.start);
		ModalLyricCreator.#renderTracks();
	}

	// ─── Auto-generate ─────────────────────────────────────────────────────────

	/**
	 * Auto-generates lyric timestamps based on peak energy. Finds silence gaps
	 * in the waveform and places one block per detected "phrase" at that
	 * interval. Blocks have empty text — user fills them in by right-click /
	 * paste-from-clipboard. Placed in the first track.
	 */
	static #autoGenerate() {
		if (!ModalLyricCreator.#peaks || ModalLyricCreator.#tracks.length === 0) return;
		let peaks = ModalLyricCreator.#peaks;
		let peaksLen = peaks.length / 2;
		// Compute RMS-like amplitude per peak
		let amp = new Float32Array(peaksLen);
		let maxAmp = 0;
		for (let i = 0; i < peaksLen; i++) {
			let min = peaks[i * 2];
			let max = peaks[i * 2 + 1];
			let a = Math.max(Math.abs(min), Math.abs(max));
			amp[i] = a;
			if (a > maxAmp) maxAmp = a;
		}
		if (maxAmp <= 0.001) { Toast.error("Signal too weak to auto-generate."); return; }

		let threshold = 0.15 * maxAmp;
		let durSec = ModalLyricCreator.#duration;
		let secPerPeak = durSec / peaksLen;

		// Find contiguous "loud" regions > threshold separated by silence
		let blocks = [];
		let inRegion = false;
		let regionStart = 0;
		for (let i = 0; i < peaksLen; i++) {
			let isLoud = amp[i] > threshold;
			if (isLoud && !inRegion) {
				regionStart = i;
				inRegion = true;
			} else if (!isLoud && inRegion) {
				let startSec = regionStart * secPerPeak;
				let endSec = i * secPerPeak;
				if (endSec - startSec >= 0.6) { // ignore noise bursts
					blocks.push({ start: startSec, end: endSec });
				}
				inRegion = false;
			}
		}
		if (inRegion) {
			let startSec = regionStart * secPerPeak;
			blocks.push({ start: startSec, end: durSec });
		}

		let track = ModalLyricCreator.#tracks[0];
		track.blocks = [];
		for (let i = 0; i < blocks.length; i++) {
			track.blocks.push({
				id: ModalLyricCreator.#nextBlockId++,
				start: blocks[i].start,
				end: blocks[i].end,
				text: ""
			});
		}
		track.blocks.sort((a, b) => a.start - b.start);
		ModalLyricCreator.#renderTracks();
		Toast.success("Generated " + blocks.length + " blocks. Fill in the text by right-clicking.");
	}

	// ─── Finish & save ─────────────────────────────────────────────────────────

	/**
	 * Compiles the first track into LRC-style JSON entries and saves.
	 * Additional tracks (beyond track 1) are discarded for now — the main
	 * player supports a single LRC track. Multiple tracks are preserved
	 * in-memory for composition purposes only.
	 */
	static async #finish() {
		if (!ModalLyricCreator.songId) return;
		if (ModalLyricCreator.#tracks.length === 0) return;
		let track = ModalLyricCreator.#tracks[0];
		if (track.blocks.length === 0) {
			Toast.error("No lyric blocks to save.");
			return;
		}

		// Compile: each block's start → {timestamp (ms), text}.
		// Insert a gap marker at each block's end if the next block doesn't
		// start immediately, so playback shows a blank between them.
		let entries = [];
		let sorted = track.blocks.slice().sort((a, b) => a.start - b.start);
		for (let i = 0; i < sorted.length; i++) {
			let b = sorted[i];
			entries.push({ timestamp: Math.round(b.start * 1000), text: b.text || "" });
			let next = sorted[i + 1];
			if (next && next.start > b.end + 0.05) {
				entries.push({ timestamp: Math.round(b.end * 1000), text: "" });
			} else if (!next) {
				entries.push({ timestamp: Math.round(b.end * 1000), text: "" });
			}
		}

		if (ModalLyricCreator.#loadStatusEl) ModalLyricCreator.#loadStatusEl.innerText = "Saving…";
		try {
			let result = await Api.send("assets/php/saveLyrics.php", {
				song_id: ModalLyricCreator.songId,
				lyrics_json: entries
			});
			if (result && result.success) {
				Toast.success("Lyrics saved.");
				if (ModalLyricCreator.#loadStatusEl) ModalLyricCreator.#loadStatusEl.innerText = "Saved.";
			} else {
				Toast.error(result && result.message ? result.message : "Save failed.");
			}
		} catch (e) {
			Toast.error("Save error.");
		}
	}

	// ─── Helpers ───────────────────────────────────────────────────────────────

	/**
	 * Creates an empty track.
	 */
	static #createEmptyTrack(name) {
		return { id: ModalLyricCreator.#nextTrackId++, name: name, blocks: [] };
	}

	/**
	 * Builds a track from canonical-format entries [{timestamp:ms, text}].
	 * Each entry's end is the next entry's timestamp (or +2s for the last).
	 */
	static #buildTrackFromEntries(name, entries) {
		let track = ModalLyricCreator.#createEmptyTrack(name);
		let sorted = entries.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
		for (let i = 0; i < sorted.length; i++) {
			let e = sorted[i];
			let start = (e.timestamp || 0) / 1000;
			let next = sorted[i + 1];
			let end = next ? (next.timestamp || 0) / 1000 : start + 2;
			// Skip gap markers (empty text entries)
			if (!e.text) continue;
			track.blocks.push({
				id: ModalLyricCreator.#nextBlockId++,
				start: start,
				end: end,
				text: e.text
			});
		}
		return track;
	}

	/**
	 * Resets all state on a fresh open.
	 */
	static #resetState() {
		ModalLyricCreator.#tracks = [];
		ModalLyricCreator.#duration = 0;
		ModalLyricCreator.#peaks = null;
		ModalLyricCreator.#audioBuffer = null;
		ModalLyricCreator.#dragBlock = null;
		ModalLyricCreator.#scrollDrag = null;
	}

	/**
	 * Formats seconds as "mm:ss.cc".
	 */
	static #formatTime(sec) {
		if (!isFinite(sec) || sec < 0) sec = 0;
		let totalCs = Math.round(sec * 100);
		let centis = totalCs % 100;
		let totalSec = Math.floor(totalCs / 100);
		let secs = totalSec % 60;
		let mins = Math.floor(totalSec / 60);
		return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0") + "." + String(centis).padStart(2, "0");
	}

	/**
	 * Escapes text for safe HTML insertion.
	 */
	static #escape(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
}
