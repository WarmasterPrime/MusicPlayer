import { Modal } from "./Modal.mjs";
import { Server } from "./lib/Server.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { Toast } from "./Toast.mjs";
import { Playlist } from "./Playlist.mjs";

/**
 * Manages the Discover tab within the modal.
 * Displays publicly available playlists that users can browse and play.
 */
export class ModalPlaylistDiscovery {

	/**
	 * Cached array of discovered public playlists.
	 * @type {Array}
	 */
	static playlists = [];

	/**
	 * Whether discovery data has been loaded from the server.
	 * @type {boolean}
	 */
	static loaded = false;

	/**
	 * Fetches public playlists from the server.
	 * @param {Function} callback - Called when loading is complete.
	 */
	static load(callback) {
		let a = {
			"src": "assets/php/discoverPlaylists.php",
			"args": {}
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string")
					data = JSON.parse(data);
			} catch (e) {}
			if (Array.isArray(data)) {
				ModalPlaylistDiscovery.playlists = data;
			} else if (data && Array.isArray(data.playlists)) {
				ModalPlaylistDiscovery.playlists = data.playlists;
			}
			ModalPlaylistDiscovery.loaded = true;
			if (typeof callback === "function")
				callback();
		});
	}

	/**
	 * Renders the discover playlists HTML with public playlist listings.
	 * @returns {string}
	 */
	static render() {
		let html = "";
		html += "<div class='modal-playlist-section'>";
		html += "<div class='modal-form-title'>Discover Playlists</div>";
		html += "<div class='modal-playlist-list' id='modal-discover-list'>";
		html += ModalPlaylistDiscovery.renderPlaylistItems();
		html += "</div>";
		html += "</div>";
		return html;
	}

	/**
	 * Renders the individual public playlist item elements.
	 * @returns {string}
	 */
	static renderPlaylistItems() {
		let html = "";
		for (let i = 0; i < ModalPlaylistDiscovery.playlists.length; i++) {
			let pl = ModalPlaylistDiscovery.playlists[i];
			let title = ModalPlaylistDiscovery.escapeHtml(pl.title || "Untitled");
			let owner = ModalPlaylistDiscovery.escapeHtml(pl.owner_username || "Unknown");
			let songCount = parseInt(pl.song_count || "0", 10);
			let plId = ModalPlaylistDiscovery.escapeHtml(String(pl.id || ""));
			html += "<div class='modal-playlist-item' data-playlist-id='" + plId + "'>";
			html += "<div class='modal-playlist-info'>";
			html += "<span class='playlist-title'>" + title + "</span>";
			html += "<span class='playlist-owner'>by " + owner + "</span>";
			html += "<span class='playlist-count'>" + songCount + " song" + (songCount !== 1 ? "s" : "") + "</span>";
			html += "</div>";
			html += "<div class='modal-playlist-actions'>";
			html += "<button class='modal-playlist-play-btn' data-playlist-id='" + plId + "'>Play</button>";
			html += "</div>";
			html += "</div>";
		}
		if (ModalPlaylistDiscovery.playlists.length === 0)
			html += "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>No public playlists found.</div>";
		return html;
	}

	/**
	 * Attaches event listeners for play actions using event delegation.
	 */
	static attachListeners() {
		let listElm = document.getElementById("modal-discover-list");
		if (listElm) {
			listElm.addEventListener("click", function (event) {
				let playBtn = event.target.closest(".modal-playlist-play-btn");
				if (playBtn) {
					let plId = playBtn.getAttribute("data-playlist-id");
					if (plId)
						ModalPlaylistDiscovery.playPlaylist(plId);
				}
			});
		}
	}

	/**
	 * Loads the songs for a public playlist and starts playback from the beginning.
	 * @param {string|number} id - The playlist ID to play.
	 */
	static playPlaylist(id) {
		Playlist.load(id, function () {
			if (Playlist.queue.length > 0) {
				Playlist.playAll();
				Modal.close();
				Toast.success("Playing playlist.");
			} else {
				Toast.error("Playlist is empty.");
			}
		});
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
}
