import { Modal } from "./Modal.mjs";
import { Server } from "./lib/Server.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { UrlParams } from "./UrlParams.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";

/**
 * Manages the song list display within the modal.
 * Songs are loaded via server-side search with pagination.
 */
export class ModalSongList {

	static songs = [];
	static totalCount = 0;
	static currentQuery = "";
	static loading = false;
	static searchTimer = null;

	/**
	 * Returns the HTML skeleton for the song list tab.
	 * @returns {string}
	 */
	static render() {
		let html = "";
		html += "<input type='text' id='modal-song-filter' class='modal-song-filter' placeholder='Search songs...' />";
		html += "<div class='modal-song-count' id='modal-song-count'>Loading...</div>";
		html += "<div class='modal-song-list' id='modal-song-list'></div>";
		return html;
	}

	/**
	 * Called after the tab is mounted in the DOM. Loads initial songs and attaches listeners.
	 */
	static onMount() {
		ModalSongList.currentQuery = "";
		ModalSongList.fetchSongs("", 8);
		ModalSongList.attachFilterListener();
		ModalSongList.attachSongClickHandlers();
	}

	/**
	 * Fetches songs from the server with optional search query and limit.
	 * @param {string} query - Search string.
	 * @param {number} limit - Max results to return.
	 */
	static fetchSongs(query, limit) {
		if (ModalSongList.loading) return;
		ModalSongList.loading = true;

		let a = {
			"src": "assets/php/getAllSongs.php",
			"args": { "query": query, "limit": limit }
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string") data = JSON.parse(data);
			} catch (e) {}

			if (data && Array.isArray(data.songs)) {
				ModalSongList.songs = data.songs;
				ModalSongList.totalCount = data.total || 0;
			} else {
				ModalSongList.songs = [];
				ModalSongList.totalCount = 0;
			}
			ModalSongList.loading = false;
			ModalSongList.updateList();
		});
	}

	/**
	 * Updates the song list and count in the DOM.
	 */
	static updateList() {
		let listElm = document.getElementById("modal-song-list");
		if (listElm)
			listElm.innerHTML = ModalSongList.renderSongItems(ModalSongList.songs);

		let countElm = document.getElementById("modal-song-count");
		if (countElm) {
			let showing = ModalSongList.songs.length;
			let total = ModalSongList.totalCount;
			if (ModalSongList.currentQuery.length > 0)
				countElm.textContent = showing + " result" + (showing !== 1 ? "s" : "") + " of " + total + " songs";
			else
				countElm.textContent = showing + " of " + total + " songs";
		}
	}

	/**
	 * Attaches event listeners to the filter input with debounced server-side search.
	 */
	static attachFilterListener() {
		let filterInput = document.getElementById("modal-song-filter");
		if (filterInput) {
			filterInput.addEventListener("input", function () {
				let query = this.value.trim();
				ModalSongList.currentQuery = query;

				if (ModalSongList.searchTimer)
					clearTimeout(ModalSongList.searchTimer);

				ModalSongList.searchTimer = setTimeout(function () {
					let limit = (query.length > 0 && query !== "*") ? 100 : (query === "*" ? 9999 : 8);
					ModalSongList.fetchSongs(query, limit);
				}, 300);
			});
			filterInput.focus();
		}
	}

	/**
	 * Renders individual song item elements.
	 * @param {Array} songs - The array of song objects.
	 * @returns {string}
	 */
	static renderSongItems(songs) {
		let html = "";
		let showAdd = Session.isLoggedIn();
		for (let i = 0; i < songs.length; i++) {
			let song = songs[i];
			let artist = ModalSongList.escapeHtml(song.artist || "");
			let title = ModalSongList.escapeHtml(song.title || "Unknown");
			let songId = ModalSongList.escapeHtml(song.song_id || "");
			let streamUrl = ModalSongList.escapeAttr(song.stream_url || "");
			html += "<div class='modal-song-item' data-song-id='" + songId + "' data-stream-url='" + streamUrl + "' data-title='" + ModalSongList.escapeAttr(song.title || "") + "' data-artist='" + ModalSongList.escapeAttr(song.artist || "") + "'>";
			if (showAdd)
				html += "<button class='song-add-btn' data-song-id='" + songId + "' title='Add to playlist'>+</button>";
			html += "<span class='song-title'>" + title + "</span>";
			if (artist.length > 0)
				html += " <span class='song-artist'>- " + artist + "</span>";
			html += "</div>";
		}
		if (songs.length === 0 && !ModalSongList.loading)
			html += "<div style='text-align:center;padding:20px;color:var(--text-muted, rgba(255,255,255,0.4));'>No songs found.</div>";
		return html;
	}

	/**
	 * Attaches click handlers to song items using event delegation.
	 */
	static attachSongClickHandlers() {
		let listElm = document.getElementById("modal-song-list");
		if (listElm) {
			listElm.addEventListener("click", function (event) {
				// Handle "+" add-to-playlist button
				let addBtn = event.target.closest(".song-add-btn");
				if (addBtn) {
					event.stopPropagation();
					let songId = addBtn.getAttribute("data-song-id");
					ModalSongList.showPlaylistPicker(songId, addBtn);
					return;
				}
				let item = event.target.closest(".modal-song-item");
				if (item) {
					let songId = item.getAttribute("data-song-id");
					let streamUrl = item.getAttribute("data-stream-url");
					let title = item.getAttribute("data-title");
					let artist = item.getAttribute("data-artist");
					ModalSongList.onSongClick(songId, streamUrl, title, artist);
				}
			});
		}
	}

	/**
	 * Shows a dropdown of playlists to add the song to.
	 * @param {string} songId - The song ID to add.
	 * @param {HTMLElement} btn - The button element for positioning.
	 */
	static showPlaylistPicker(songId, btn) {
		// Remove any existing picker
		let existing = document.getElementById("playlist-picker-dropdown");
		if (existing) existing.remove();

		let dropdown = document.createElement("div");
		dropdown.id = "playlist-picker-dropdown";
		dropdown.className = "playlist-picker-dropdown";
		dropdown.innerHTML = "<div style='padding:8px;color:var(--text-muted,#999);font-size:12px;'>Loading playlists...</div>";
		document.body.appendChild(dropdown);

		// Position relative to button using viewport coords
		let rect = btn.getBoundingClientRect();
		dropdown.style.top = (rect.bottom + 4) + "px";
		dropdown.style.left = Math.max(0, rect.right - dropdown.offsetWidth) + "px";

		// Fetch user's playlists
		let a = {
			"src": "assets/php/getPlaylists.php",
			"args": {}
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try { if (typeof data === "string") data = JSON.parse(data); } catch (e) {}
			let playlists = [];
			if (data && Array.isArray(data.playlists)) playlists = data.playlists;
			else if (Array.isArray(data)) playlists = data;

			let dd = document.getElementById("playlist-picker-dropdown");
			if (!dd) return;

			if (playlists.length === 0) {
				dd.innerHTML = "<div style='padding:8px;color:var(--text-muted,#999);font-size:12px;'>No playlists. Create one first.</div>";
				setTimeout(function () { if (dd) dd.remove(); }, 2000);
				return;
			}

			let html = "";
			for (let i = 0; i < playlists.length; i++) {
				let pl = playlists[i];
				let plId = ModalSongList.escapeAttr(pl.id || pl.playlist_id || "");
				let plName = ModalSongList.escapeHtml(pl.title || pl.name || "Untitled");
				html += "<div class='playlist-picker-item' data-playlist-id='" + plId + "' data-song-id='" + ModalSongList.escapeAttr(songId) + "'>" + plName + "</div>";
			}
			dd.innerHTML = html;

			dd.addEventListener("click", function (e) {
				let item = e.target.closest(".playlist-picker-item");
				if (item) {
					let plId = item.getAttribute("data-playlist-id");
					let sId = item.getAttribute("data-song-id");
					ModalSongList.addSongToPlaylist(plId, sId);
					dd.remove();
				}
			});
		});

		// Close on click outside
		setTimeout(function () {
			document.addEventListener("click", function closePicker(e) {
				let dd = document.getElementById("playlist-picker-dropdown");
				if (dd && !dd.contains(e.target) && !e.target.classList.contains("song-add-btn")) {
					dd.remove();
					document.removeEventListener("click", closePicker);
				}
			});
		}, 100);
	}

	/**
	 * Adds a song to a playlist via the server.
	 * @param {string} playlistId
	 * @param {string} songId
	 */
	static addSongToPlaylist(playlistId, songId) {
		let a = {
			"src": "assets/php/playlist.php",
			"args": { "cmd": "addSong", "playlist_id": playlistId, "song_id": songId }
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try { if (typeof data === "string") data = JSON.parse(data); } catch (e) {}
			if (data && data.success) {
				Toast.success("Added to playlist.");
			} else {
				Toast.error(data && data.message ? data.message : "Failed to add.");
			}
		});
	}

	/**
	 * Handles a song being clicked in the modal.
	 * @param {string} songId - The song's database ID.
	 * @param {string} streamUrl - The song's stream URL.
	 * @param {string} title - The song's display title.
	 */
	static onSongClick(songId, streamUrl, title, artist) {
		Modal.close();
		AudioLibrary.currentSongId = songId;
		let art = artist || "";
		let ttl = title || "";
		AudioLibrary.currentSongName = art.length > 0 ? art + " - " + ttl : ttl;
		if (typeof streamUrl === "string" && streamUrl.length > 0)
			AudioLibrary.play(streamUrl);
		if (typeof songId === "string" && songId.length > 0)
			UrlParams.SetParam("song", songId);
	}

	/**
	 * Escapes HTML entities in a string.
	 * @param {string} str - The string to escape.
	 * @returns {string}
	 */
	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	/**
	 * Escapes a string for use in HTML attributes.
	 * @param {string} str - The string to escape.
	 * @returns {string}
	 */
	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
	}
}
