import { Modal } from "./Modal.mjs";
import { Server } from "./lib/Server.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { Api } from "./Api.mjs";
import { ModalLyricsEditor } from "./ModalLyricsEditor.mjs";
import { ModalLyricCreator } from "./ModalLyricCreator.mjs";

/**
 * Manages the song management tab for editing song metadata.
 * Uses server-side search with debounced input.
 */
export class ModalSongManagement {

	static songs = [];
	static totalCount = 0;
	static currentQuery = "";
	static loading = false;
	static searchTimer = null;
	static editingSongId = null;
	static loaded = false;

	/**
	 * Fetches songs from the server with optional search query.
	 * @param {string} query - Search string.
	 * @param {number} limit - Max results.
	 * @param {Function} [callback] - Optional callback when done.
	 */
	static fetchSongs(query, limit, callback) {
		if (ModalSongManagement.loading) return;
		ModalSongManagement.loading = true;

		let a = {
			"src": "assets/php/getAllSongs.php",
			"args": { "query": query || "*", "limit": limit }
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string") data = JSON.parse(data);
			} catch (e) {}
			if (data && Array.isArray(data.songs)) {
				ModalSongManagement.songs = data.songs;
				ModalSongManagement.totalCount = data.total || 0;
			} else {
				ModalSongManagement.songs = [];
				ModalSongManagement.totalCount = 0;
			}
			ModalSongManagement.loading = false;
			ModalSongManagement.loaded = true;
			ModalSongManagement.updateList();
			if (typeof callback === "function") callback();
		});
	}

	/**
	 * Initial load for tab mount.
	 * @param {Function} callback
	 */
	static load(callback) {
		ModalSongManagement.fetchSongs("", 20, callback);
	}

	/**
	 * Renders the song management list.
	 * @returns {string}
	 */
	static render() {
		if (ModalSongManagement.editingSongId !== null) {
			return ModalSongManagement.renderEditForm();
		}

		let html = "";
		html += "<div class='modal-form-title'>Manage Songs</div>";
		html += "<input type='text' id='manage-filter' class='modal-song-filter' placeholder='Search songs...' />";
		html += "<div class='modal-song-count' id='manage-song-count'></div>";
		html += "<div class='modal-song-list' id='manage-song-list'>";
		html += ModalSongManagement.renderSongItems(ModalSongManagement.songs);
		html += "</div>";
		return html;
	}

	/**
	 * Updates the song list and count in the DOM.
	 */
	static updateList() {
		let listElm = document.getElementById("manage-song-list");
		if (listElm)
			listElm.innerHTML = ModalSongManagement.renderSongItems(ModalSongManagement.songs);

		let countElm = document.getElementById("manage-song-count");
		if (countElm) {
			let showing = ModalSongManagement.songs.length;
			let total = ModalSongManagement.totalCount;
			if (ModalSongManagement.currentQuery.length > 0)
				countElm.textContent = showing + " result" + (showing !== 1 ? "s" : "") + " of " + total + " songs";
			else
				countElm.textContent = showing + " of " + total + " songs";
		}
	}

	/**
	 * Renders individual song items with edit buttons.
	 * @param {Array} songs - Song array.
	 * @returns {string}
	 */
	static renderSongItems(songs) {
		let html = "";
		for (let i = 0; i < songs.length; i++) {
			let s = songs[i];
			let title = ModalSongManagement.escapeHtml(s.title || "Unknown");
			let artist = ModalSongManagement.escapeHtml(s.artist || "");
			let songId = ModalSongManagement.escapeHtml(s.song_id || "");
			html += "<div class='modal-song-item manage-song-item' data-song-id='" + songId + "'>";
			html += "<span class='song-title'>" + title + "</span>";
			if (artist.length > 0) html += " <span class='song-artist'>- " + artist + "</span>";
			html += "<button class='manage-edit-btn' data-song-id='" + songId + "'>Edit</button>";
			html += "</div>";
		}
		if (songs.length === 0 && !ModalSongManagement.loading) {
			html += "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>No songs found.</div>";
		}
		return html;
	}

	/**
	 * Renders the edit form for a specific song.
	 * @returns {string}
	 */
	static renderEditForm() {
		let song = ModalSongManagement.songs.find(function (s) {
			return s.song_id === ModalSongManagement.editingSongId;
		});
		if (!song) return "<div>Song not found.</div>";

		let esc = ModalSongManagement.escapeAttr;
		let html = "";

		// Back button
		html += "<button class='modal-form-btn' id='manage-back' style='width:auto;margin-bottom:12px;'>Back</button>";
		html += "<div class='modal-form-title'>Edit Song</div>";

		// --- Basic Info Section ---
		html += "<div class='edit-section'>";
		html += "<div class='edit-section-label'>Basic Info</div>";
		html += "<div class='modal-form-group'><label>Title</label><input type='text' id='edit-title' value='" + esc(song.title || "") + "' /></div>";
		html += "<div class='edit-row'>";
		html += "<div class='modal-form-group edit-col'><label>Artist</label><input type='text' id='edit-artist' value='" + esc(song.artist || "") + "' /></div>";
		html += "<div class='modal-form-group edit-col'><label>Album</label><input type='text' id='edit-album' value='" + esc(song.album || "") + "' /></div>";
		html += "</div>";
		html += "<div class='edit-row'>";
		html += "<div class='modal-form-group edit-col'><label>Genre</label><input type='text' id='edit-genre' value='" + esc(song.genre || "") + "' /></div>";
		html += "<div class='modal-form-group edit-col'><label>Album Artist</label><input type='text' id='edit-album-artist' value='" + esc(song.album_artist || "") + "' /></div>";
		html += "</div>";
		html += "</div>";

		// --- Details Section ---
		html += "<div class='edit-section'>";
		html += "<div class='edit-section-label'>Details</div>";
		html += "<div class='edit-row'>";
		html += "<div class='modal-form-group edit-col'><label>Publisher</label><input type='text' id='edit-publisher' value='" + esc(song.publisher || "") + "' /></div>";
		html += "<div class='modal-form-group edit-col'><label>Composer</label><input type='text' id='edit-composer' value='" + esc(song.composer || "") + "' /></div>";
		html += "</div>";
		html += "<div class='edit-row'>";
		html += "<div class='modal-form-group edit-col'><label>Publish Date</label><input type='date' id='edit-publish-date' value='" + esc(ModalSongManagement.formatDateForInput(song.publish_date)) + "' /></div>";
		html += "<div class='modal-form-group edit-col'><label>Source URL</label><input type='url' id='edit-source-url' value='" + esc(song.source_url || "") + "' placeholder='https://...' /></div>";
		html += "</div>";
		html += "<div class='modal-form-group'><label>Keywords</label><input type='text' id='edit-keywords' value='" + esc(song.keywords || "") + "' placeholder='comma-separated keywords' /></div>";
		html += "</div>";

		// --- Lyrics Section ---
		html += "<div class='edit-section'>";
		html += "<div class='edit-section-label'>Lyrics</div>";
		html += "<div class='edit-lyrics-row'>";
		html += "<span class='edit-lyrics-hint'>Open the editor for a row-based table, or Lyric Creator for the timeline-based editor.</span>";
		html += "<div style='display:flex;gap:8px;'>";
		html += "<button class='modal-form-btn edit-lyrics-btn' id='edit-lyrics-btn'>Edit Lyrics</button>";
		html += "<button class='modal-form-btn edit-lyrics-btn' id='lyric-creator-btn'>Lyric Creator</button>";
		html += "</div>";
		html += "</div>";
		html += "<div class='edit-lyrics-row' style='margin-top:8px;'>";
		html += "<span class='edit-lyrics-hint' style='font-size:12px;'>Or upload a lyrics file (.lrc .json .srt .vtt .sbv .sub .scc .txt):</span>";
		html += "<div style='display:flex;gap:8px;align-items:center;margin-top:4px;'>";
		html += "<input type='file' id='lyrics-file-input' accept='.lrc,.json,.srt,.vtt,.sbv,.sub,.scc,.txt' style='flex:1;font-size:12px;color:rgba(255,255,255,0.7);' />";
		html += "<button class='modal-form-btn' id='lyrics-file-upload-btn' style='width:auto;font-size:12px;padding:4px 12px;'>Upload</button>";
		html += "</div>";
		html += "<div id='lyrics-upload-status' style='font-size:11px;margin-top:4px;color:rgba(255,255,255,0.5);'></div>";
		html += "</div>";
		html += "</div>";

		// --- Save ---
		html += "<button class='modal-form-btn' id='edit-save'>Save Changes</button>";
		html += "<div class='modal-form-message' id='edit-message'></div>";
		return html;
	}

	/**
	 * Formats a date string from the server (e.g. "2024-03-15 00:00:00") into "YYYY-MM-DD" for date inputs.
	 * @param {string} dateStr
	 * @returns {string}
	 */
	static formatDateForInput(dateStr) {
		if (!dateStr || typeof dateStr !== "string" || dateStr.length === 0) return "";
		// Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
		let match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
		return match ? match[1] : "";
	}

	/**
	 * Attaches event listeners for the management tab.
	 */
	static attachListeners() {
		if (ModalSongManagement.editingSongId !== null) {
			ModalSongManagement.attachEditListeners();
			return;
		}

		let listElm = document.getElementById("manage-song-list");
		if (listElm) {
			listElm.addEventListener("click", function (event) {
				let btn = event.target.closest(".manage-edit-btn");
				if (btn) {
					ModalSongManagement.editingSongId = btn.getAttribute("data-song-id");
					Modal.setContent(ModalSongManagement.render());
					ModalSongManagement.attachEditListeners();
				}
			});
		}

		let filterInput = document.getElementById("manage-filter");
		if (filterInput) {
			filterInput.addEventListener("input", function () {
				let query = this.value.trim();
				ModalSongManagement.currentQuery = query;

				if (ModalSongManagement.searchTimer)
					clearTimeout(ModalSongManagement.searchTimer);

				ModalSongManagement.searchTimer = setTimeout(function () {
					let limit = (query.length > 0 && query !== "*") ? 100 : (query === "*" ? 9999 : 20);
					ModalSongManagement.fetchSongs(query.length > 0 ? query : "", limit);
				}, 300);
			});
			filterInput.focus();
		}
	}

	/**
	 * Attaches listeners for the edit form.
	 */
	static attachEditListeners() {
		let backBtn = document.getElementById("manage-back");
		if (backBtn) {
			backBtn.addEventListener("click", function () {
				ModalSongManagement.editingSongId = null;
				Modal.setContent(ModalSongManagement.render());
				setTimeout(function () { ModalSongManagement.attachListeners(); }, 0);
			});
		}

		let saveBtn = document.getElementById("edit-save");
		if (saveBtn) {
			saveBtn.addEventListener("click", function () { ModalSongManagement.save(); });
		}

		let lyricsBtn = document.getElementById("edit-lyrics-btn");
		if (lyricsBtn) {
			lyricsBtn.addEventListener("click", function () {
				let songId = ModalSongManagement.editingSongId;
				if (songId) {
					ModalLyricsEditor.open(songId);
				}
			});
		}

		let creatorBtn = document.getElementById("lyric-creator-btn");
		if (creatorBtn) {
			creatorBtn.addEventListener("click", function () {
				let songId = ModalSongManagement.editingSongId;
				if (songId) {
					ModalLyricCreator.open(songId);
				}
			});
		}

		// Lyrics file upload
		let uploadBtn = document.getElementById("lyrics-file-upload-btn");
		if (uploadBtn) {
			uploadBtn.addEventListener("click", async function () {
				let fileInput = document.getElementById("lyrics-file-input");
				let statusEl  = document.getElementById("lyrics-upload-status");
				if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
					if (statusEl) statusEl.textContent = "Please select a file first.";
					return;
				}
				let file = fileInput.files[0];
				let name = file.name.toLowerCase();
				let songId = ModalSongManagement.editingSongId;
				if (!songId) return;

				if (statusEl) statusEl.textContent = "Reading file…";

				try {
					let text = await file.text();
					let payload = { song_id: songId };
					let ext = name.split(".").pop();

					if (ext === "json") {
						// JSON lyrics — parse and validate format
						let parsed = JSON.parse(text);
						if (Array.isArray(parsed)) {
							payload.lyrics_json = parsed;
						} else {
							// Legacy flat object {"0":"text",...} — convert to array
							payload.lyrics_json = Object.entries(parsed).map(([k, v]) => ({
								timestamp: parseFloat(k), text: String(v)
							})).filter(e => !isNaN(e.timestamp));
						}
					} else if (ext === "lrc" || ext === "txt") {
						// .lrc or plain text — send raw for server storage
						payload.lyrics_raw = text;
					} else {
						// .srt, .vtt, .sbv, .sub, .scc — convert to canonical array format
						// so playback consistently handles timing and gap markers.
						let { Lyrics } = await import("./Lyrics.mjs");
						let entries = Lyrics.fromAny(text, ext);
						if (entries.length === 0) {
							if (statusEl) {
								statusEl.textContent = "Could not parse " + ext.toUpperCase() + " file.";
								statusEl.style.color = "rgba(255,100,100,0.8)";
							}
							return;
						}
						payload.lyrics_json = entries;
					}

					let result = await Api.send("assets/php/saveLyrics.php", payload);
					if (statusEl) {
						statusEl.textContent = result.success
							? "Lyrics uploaded successfully."
							: ("Upload failed: " + (result.message || "Unknown error."));
						statusEl.style.color = result.success ? "rgba(100,255,150,0.8)" : "rgba(255,100,100,0.8)";
					}
					if (result.success) fileInput.value = "";
				} catch (e) {
					if (statusEl) {
						statusEl.textContent = "Error reading or uploading file: " + e.message;
						statusEl.style.color = "rgba(255,100,100,0.8)";
					}
				}
			});
		}
	}

	/**
	 * Saves the edited song metadata.
	 */
	static async save() {
		let songId = ModalSongManagement.editingSongId;
		if (!songId) return;

		let data = {
			"song_id": songId,
			"title": (document.getElementById("edit-title")?.value || "").trim(),
			"artist": (document.getElementById("edit-artist")?.value || "").trim(),
			"album": (document.getElementById("edit-album")?.value || "").trim(),
			"genre": (document.getElementById("edit-genre")?.value || "").trim(),
			"album_artist": (document.getElementById("edit-album-artist")?.value || "").trim(),
			"publisher": (document.getElementById("edit-publisher")?.value || "").trim(),
			"composer": (document.getElementById("edit-composer")?.value || "").trim(),
			"publish_date": (document.getElementById("edit-publish-date")?.value || "").trim(),
			"source_url": (document.getElementById("edit-source-url")?.value || "").trim(),
			"keywords": (document.getElementById("edit-keywords")?.value || "").trim()
		};

		try {
			let result = await Api.send("assets/php/updateSong.php", data);
			if (result.success) {
				Toast.success("Song updated.");
				// Update local cache
				let song = ModalSongManagement.songs.find(function (s) { return s.song_id === songId; });
				if (song) {
					song.title = data.title;
					song.artist = data.artist;
					song.album = data.album;
					song.genre = data.genre;
					song.album_artist = data.album_artist;
					song.publisher = data.publisher;
					song.composer = data.composer;
					song.publish_date = data.publish_date;
					song.source_url = data.source_url;
					song.keywords = data.keywords;
				}
			} else {
				Toast.error(result.message || "Update failed.");
			}
		} catch (e) {
			Toast.error("Save error.");
		}
	}

	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
