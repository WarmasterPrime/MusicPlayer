import { Modal } from "./Modal.mjs";
import { Server } from "./lib/Server.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { Playlist } from "./Playlist.mjs";
import { Api } from "./Api.mjs";
import { FeatureGate } from "./FeatureGate.mjs";
import { UrlParams } from "./UrlParams.mjs";

/**
 * Manages the Playlist Library tab within the modal.
 * Displays the logged-in user's playlists with options to create, play, edit, and delete.
 */
export class ModalPlaylist {

	static playlists = [];
	static loaded = false;
	static editingPlaylistId = null;
	static editSongs = [];
	static editPermissions = [];

	/**
	 * Fetches the user's playlists from the server.
	 * @param {Function} callback - Called when loading is complete.
	 */
	static load(callback) {
		let a = {
			"src": "assets/php/getPlaylists.php",
			"args": {}
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string")
					data = JSON.parse(data);
			} catch (e) {}
			if (Array.isArray(data)) {
				ModalPlaylist.playlists = data;
			} else if (data && Array.isArray(data.playlists)) {
				ModalPlaylist.playlists = data.playlists;
			}
			ModalPlaylist.loaded = true;
			if (typeof callback === "function")
				callback();
		});
	}

	/**
	 * Main render dispatcher.
	 * @returns {string}
	 */
	static render() {
		if (ModalPlaylist.editingPlaylistId !== null)
			return ModalPlaylist.renderEditView();
		return ModalPlaylist.renderListView();
	}

	/**
	 * Renders the playlist list view with create form.
	 * @returns {string}
	 */
	static renderListView() {
		let html = "";
		html += "<div class='modal-playlist-section'>";
		html += "<div class='modal-form-title'>My Playlists</div>";
		html += "<div class='modal-playlist-list' id='modal-playlist-list'>";
		html += ModalPlaylist.renderPlaylistItems();
		html += "</div>";
		html += "</div>";
		html += "<hr style='border-color:rgba(255,255,255,0.1);margin:16px 0;' />";
		html += ModalPlaylist.renderCreateForm();
		return html;
	}

	/**
	 * Renders the individual playlist item elements.
	 * @returns {string}
	 */
	static renderPlaylistItems() {
		let html = "";
		for (let i = 0; i < ModalPlaylist.playlists.length; i++) {
			let pl = ModalPlaylist.playlists[i];
			let title = ModalPlaylist.escapeHtml(pl.title || "Untitled");
			let songCount = parseInt(pl.song_count || "0", 10);
			let plId = ModalPlaylist.escapeHtml(String(pl.id || ""));
			html += "<div class='modal-playlist-item' data-playlist-id='" + plId + "'>";
			html += "<div class='modal-playlist-info'>";
			html += "<span class='playlist-title'>" + title + "</span>";
			html += "<span class='playlist-count'>" + songCount + " song" + (songCount !== 1 ? "s" : "") + "</span>";
			html += "</div>";
			html += "<div class='modal-playlist-actions'>";
			html += "<button class='modal-playlist-play-btn' data-playlist-id='" + plId + "'>Play</button>";
			html += "<button class='modal-playlist-share-btn' data-playlist-id='" + plId + "' title='Copy link'>Share</button>";
			html += "<button class='modal-playlist-edit-btn' data-playlist-id='" + plId + "'>Edit</button>";
			html += "<button class='modal-playlist-delete-btn' data-playlist-id='" + plId + "'>Delete</button>";
			html += "</div>";
			html += "</div>";
		}
		if (ModalPlaylist.playlists.length === 0)
			html += "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>No playlists yet.</div>";
		return html;
	}

	/**
	 * Renders the create playlist form HTML with permission checkbox matrix.
	 * @returns {string}
	 */
	static renderCreateForm() {
		let html = "";
		html += "<div class='modal-playlist-create' id='modal-playlist-create'>";
		html += "<div class='modal-form-title'>Create Playlist</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Title</label>";
		html += "<input type='text' id='playlist-create-title' placeholder='Playlist title' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Description</label>";
		html += "<input type='text' id='playlist-create-description' placeholder='Description (optional)' />";
		html += "</div>";
		html += "<details class='modal-form-details'>";
		html += "<summary>Permissions</summary>";
		html += ModalPlaylist.renderPermissionTable("create");
		html += "</details>";
		html += "<button class='modal-form-btn' id='playlist-create-btn'>Create</button>";
		html += "<div class='modal-form-message' id='playlist-create-message'></div>";
		html += "</div>";
		return html;
	}

	/**
	 * Renders a permission checkbox table.
	 * @param {string} prefix - Prefix for checkbox names ("create" or "edit").
	 * @param {Array} [permissions] - Existing permission data for pre-filling.
	 * @returns {string}
	 */
	static renderPermissionTable(prefix, permissions) {
		let defaults = {
			"view": [1, 1, 1],
			"like": [0, 1, 1],
			"add_to_playlist": [0, 0, 1],
			"edit_lyrics": [0, 0, 0],
			"edit_song_info": [0, 0, 0]
		};
		let labels = {
			"view": "View",
			"like": "Like",
			"add_to_playlist": "Add to playlist",
			"edit_lyrics": "Edit lyrics",
			"edit_song_info": "Edit song info"
		};

		if (permissions && Array.isArray(permissions)) {
			for (let i = 0; i < permissions.length; i++) {
				let p = permissions[i];
				if (defaults[p.name])
					defaults[p.name] = [p.private ? 1 : 0, p.unlisted ? 1 : 0, p.public ? 1 : 0];
			}
		}

		let html = "<table class='modal-permission-table'>";
		html += "<thead><tr><th>Permission</th><th>Private</th><th>Unlisted</th><th>Public</th></tr></thead>";
		html += "<tbody>";
		let keys = ["view", "like", "add_to_playlist", "edit_lyrics", "edit_song_info"];
		for (let i = 0; i < keys.length; i++) {
			let k = keys[i];
			let vals = defaults[k];
			html += "<tr>";
			html += "<td>" + labels[k] + "</td>";
			html += "<td><input type='checkbox' name='" + prefix + "_perm_" + k + "_private'" + (vals[0] ? " checked" : "") + " /></td>";
			html += "<td><input type='checkbox' name='" + prefix + "_perm_" + k + "_unlisted'" + (vals[1] ? " checked" : "") + " /></td>";
			html += "<td><input type='checkbox' name='" + prefix + "_perm_" + k + "_public'" + (vals[2] ? " checked" : "") + " /></td>";
			html += "</tr>";
		}
		html += "</tbody></table>";
		return html;
	}

	/**
	 * Renders the edit view for a playlist.
	 * @returns {string}
	 */
	static renderEditView() {
		let pl = ModalPlaylist.playlists.find(function (p) { return p.id === ModalPlaylist.editingPlaylistId; });
		let title = pl ? pl.title || "" : "";
		let description = pl ? pl.description || "" : "";

		let html = "";
		html += "<button class='modal-form-btn' id='playlist-edit-back' style='width:auto;margin-bottom:12px;'>Back</button>";
		html += "<div class='modal-form-title'>Edit Playlist</div>";

		html += "<div class='modal-form-group'><label>Title</label>";
		html += "<input type='text' id='playlist-edit-title' value='" + ModalPlaylist.escapeAttr(title) + "' /></div>";

		html += "<div class='modal-form-group'><label>Description</label>";
		html += "<input type='text' id='playlist-edit-description' value='" + ModalPlaylist.escapeAttr(description) + "' /></div>";

		html += "<div class='modal-form-title' style='font-size:16px;margin-top:16px;'>Permissions</div>";
		html += "<div id='playlist-edit-permissions'>";
		html += ModalPlaylist.renderPermissionTable("edit", ModalPlaylist.editPermissions);
		html += "</div>";

		html += "<button class='modal-form-btn' id='playlist-edit-save-info'>Save Info & Permissions</button>";
		html += "<div class='modal-form-message' id='playlist-edit-message'></div>";

		html += "<hr style='border-color:rgba(255,255,255,0.1);margin:16px 0;' />";
		html += "<div class='modal-form-title' style='font-size:16px;'>Songs in Playlist</div>";
		html += "<div id='playlist-edit-songs'>";
		html += ModalPlaylist.renderEditSongItems();
		html += "</div>";

		return html;
	}

	/**
	 * Renders song items for the edit view with remove and reorder controls.
	 * @returns {string}
	 */
	static renderEditSongItems() {
		let songs = ModalPlaylist.editSongs;
		if (songs.length === 0)
			return "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>No songs in this playlist.</div>";

		let html = "";
		for (let i = 0; i < songs.length; i++) {
			let s = songs[i];
			let title = ModalPlaylist.escapeHtml(s.title || "Unknown");
			let artist = ModalPlaylist.escapeHtml(s.artist || "");
			let songId = ModalPlaylist.escapeHtml(s.song_id || "");
			html += "<div class='playlist-edit-song-item' data-song-id='" + songId + "' data-position='" + (i + 1) + "'>";
			html += "<div class='playlist-edit-song-order'>";
			html += "<button class='playlist-order-btn playlist-move-up' data-song-id='" + songId + "' title='Move up'>&uarr;</button>";
			html += "<button class='playlist-order-btn playlist-move-down' data-song-id='" + songId + "' title='Move down'>&darr;</button>";
			html += "</div>";
			html += "<div class='playlist-edit-song-info'>";
			html += "<span class='song-title'>" + title + "</span>";
			if (artist.length > 0) html += " <span class='song-artist'>- " + artist + "</span>";
			html += "</div>";
			html += "<button class='playlist-remove-btn' data-song-id='" + songId + "'>Remove</button>";
			html += "</div>";
		}
		return html;
	}

	/**
	 * Attaches event listeners for the current view.
	 */
	static attachListeners() {
		if (ModalPlaylist.editingPlaylistId !== null) {
			ModalPlaylist.attachEditListeners();
			return;
		}
		ModalPlaylist.attachListListeners();
		let createBtn = document.getElementById("playlist-create-btn");
		if (createBtn && !createBtn._bound) {
			createBtn._bound = true;
			createBtn.addEventListener("click", function () { ModalPlaylist.create(); });
		}
		let titleInput = document.getElementById("playlist-create-title");
		if (titleInput && !titleInput._bound) {
			titleInput._bound = true;
			titleInput.addEventListener("keypress", function (event) {
				if (event.key === "Enter") ModalPlaylist.create();
			});
		}
	}

	/**
	 * Attaches list container click delegation (play, edit, delete).
	 */
	static attachListListeners() {
		let listElm = document.getElementById("modal-playlist-list");
		if (listElm) {
			listElm.addEventListener("click", function (event) {
				let playBtn = event.target.closest(".modal-playlist-play-btn");
				if (playBtn) {
					let plId = playBtn.getAttribute("data-playlist-id");
					if (plId) ModalPlaylist.playPlaylist(plId);
					return;
				}
				let shareBtn = event.target.closest(".modal-playlist-share-btn");
				if (shareBtn) {
					let plId = shareBtn.getAttribute("data-playlist-id");
					if (plId) ModalPlaylist.copyShareUrl(plId);
					return;
				}
				let editBtn = event.target.closest(".modal-playlist-edit-btn");
				if (editBtn) {
					let plId = editBtn.getAttribute("data-playlist-id");
					if (plId) ModalPlaylist.openEdit(plId);
					return;
				}
				let deleteBtn = event.target.closest(".modal-playlist-delete-btn");
				if (deleteBtn) {
					let plId = deleteBtn.getAttribute("data-playlist-id");
					if (plId) ModalPlaylist.deletePlaylist(plId);
					return;
				}
			});
		}
	}

	/**
	 * Copies a shareable URL for the playlist to the clipboard.
	 * Includes all current URL params except replaces playlist and removes song.
	 * @param {string} playlistId
	 */
	static copyShareUrl(playlistId) {
		let url = new URL(window.location);
		url.searchParams.set("playlist", playlistId);
		url.searchParams.delete("song");
		navigator.clipboard.writeText(url.toString()).then(function () {
			Toast.success("Playlist link copied!");
		}).catch(function () {
			Toast.error("Failed to copy link.");
		});
	}

	/**
	 * Opens the edit view for a playlist. Fetches permissions and songs.
	 * @param {string} playlistId
	 */
	static async openEdit(playlistId) {
		ModalPlaylist.editingPlaylistId = playlistId;
		ModalPlaylist.editSongs = [];
		ModalPlaylist.editPermissions = [];

		// Fetch permissions and songs in parallel
		try {
			let [permResult, songsResult] = await Promise.all([
				Api.send("assets/php/playlist.php", { "cmd": "getPermissions", "playlist_id": playlistId }),
				Api.send("assets/php/getPlaylistSongs.php", { "playlist_id": playlistId })
			]);

			if (permResult.success && Array.isArray(permResult.permissions))
				ModalPlaylist.editPermissions = permResult.permissions;

			if (songsResult.success && Array.isArray(songsResult.songs))
				ModalPlaylist.editSongs = songsResult.songs;

		} catch (e) {}

		Modal.setContent(ModalPlaylist.renderEditView());
		ModalPlaylist.attachEditListeners();
	}

	/**
	 * Attaches listeners for the edit view.
	 */
	static attachEditListeners() {
		let backBtn = document.getElementById("playlist-edit-back");
		if (backBtn) {
			backBtn.addEventListener("click", function () {
				ModalPlaylist.editingPlaylistId = null;
				ModalPlaylist.editSongs = [];
				ModalPlaylist.editPermissions = [];
				Modal.setContent(ModalPlaylist.renderListView());
				setTimeout(function () { ModalPlaylist.attachListeners(); }, 0);
			});
		}

		let saveBtn = document.getElementById("playlist-edit-save-info");
		if (saveBtn) {
			saveBtn.addEventListener("click", function () { ModalPlaylist.saveEdit(); });
		}

		let songsElm = document.getElementById("playlist-edit-songs");
		if (songsElm) {
			songsElm.addEventListener("click", function (event) {
				let removeBtn = event.target.closest(".playlist-remove-btn");
				if (removeBtn) {
					let songId = removeBtn.getAttribute("data-song-id");
					if (songId) ModalPlaylist.removeSongFromEdit(songId);
					return;
				}
				let upBtn = event.target.closest(".playlist-move-up");
				if (upBtn) {
					let songId = upBtn.getAttribute("data-song-id");
					if (songId) ModalPlaylist.moveSong(songId, -1);
					return;
				}
				let downBtn = event.target.closest(".playlist-move-down");
				if (downBtn) {
					let songId = downBtn.getAttribute("data-song-id");
					if (songId) ModalPlaylist.moveSong(songId, 1);
					return;
				}
			});
		}
	}

	/**
	 * Saves edited playlist info and permissions.
	 */
	static async saveEdit() {
		let playlistId = ModalPlaylist.editingPlaylistId;
		if (!playlistId) return;

		let title = (document.getElementById("playlist-edit-title")?.value || "").trim();
		let description = (document.getElementById("playlist-edit-description")?.value || "").trim();
		let message = document.getElementById("playlist-edit-message");

		if (title.length === 0) {
			ModalPlaylist.setMessage(message, "Title is required.", "error");
			return;
		}

		// Collect permissions from checkboxes
		let keys = ["view", "like", "add_to_playlist", "edit_lyrics", "edit_song_info"];
		let levels = ["private", "unlisted", "public"];
		let permissions = [];
		for (let i = 0; i < keys.length; i++) {
			let perm = { "name": keys[i] };
			for (let j = 0; j < levels.length; j++) {
				let cb = document.querySelector("input[name='edit_perm_" + keys[i] + "_" + levels[j] + "']");
				perm[levels[j]] = cb && cb.checked ? 1 : 0;
			}
			permissions.push(perm);
		}

		try {
			// Save info and permissions in parallel
			let [infoResult, permResult] = await Promise.all([
				Api.send("assets/php/playlist.php", {
					"cmd": "update",
					"playlist_id": playlistId,
					"title": title,
					"description": description
				}),
				Api.send("assets/php/playlist.php", {
					"cmd": "updatePermissions",
					"playlist_id": playlistId,
					"permissions": permissions
				})
			]);

			if (infoResult.success && permResult.success) {
				Toast.success("Playlist updated.");
				ModalPlaylist.setMessage(message, "Saved.", "success");
				// Update cached playlist data
				let pl = ModalPlaylist.playlists.find(function (p) { return p.id === playlistId; });
				if (pl) {
					pl.title = title;
					pl.description = description;
				}
			} else {
				let msg = (!infoResult.success ? infoResult.message : permResult.message) || "Update failed.";
				ModalPlaylist.setMessage(message, msg, "error");
			}
		} catch (e) {
			Toast.error("Save error.");
		}
	}

	/**
	 * Removes a song from the playlist being edited.
	 * @param {string} songId
	 */
	static async removeSongFromEdit(songId) {
		let playlistId = ModalPlaylist.editingPlaylistId;
		if (!playlistId) return;

		try {
			let result = await Api.send("assets/php/playlist.php", {
				"cmd": "removeSong",
				"playlist_id": playlistId,
				"song_id": songId
			});

			if (result.success) {
				ModalPlaylist.editSongs = ModalPlaylist.editSongs.filter(function (s) { return s.song_id !== songId; });
				let songsElm = document.getElementById("playlist-edit-songs");
				if (songsElm)
					songsElm.innerHTML = ModalPlaylist.renderEditSongItems();
				Toast.success("Song removed.");
				// Update song count in cached list
				let pl = ModalPlaylist.playlists.find(function (p) { return p.id === playlistId; });
				if (pl) pl.song_count = Math.max(0, (parseInt(pl.song_count || "0", 10) - 1));
			} else {
				Toast.error(result.message || "Remove failed.");
			}
		} catch (e) {
			Toast.error("Remove error.");
		}
	}

	/**
	 * Moves a song up or down in the playlist order, persists to DB.
	 * @param {string} songId
	 * @param {number} direction - -1 for up, +1 for down
	 */
	static async moveSong(songId, direction) {
		let songs = ModalPlaylist.editSongs;
		let idx = songs.findIndex(function (s) { return s.song_id === songId; });
		if (idx < 0) return;

		let newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= songs.length) return;

		// Swap in local array
		let temp = songs[idx];
		songs[idx] = songs[newIdx];
		songs[newIdx] = temp;

		// Re-render immediately
		let songsElm = document.getElementById("playlist-edit-songs");
		if (songsElm)
			songsElm.innerHTML = ModalPlaylist.renderEditSongItems();

		// Build reorder items with new positions
		let items = [];
		for (let i = 0; i < songs.length; i++) {
			items.push({ "song_id": songs[i].song_id, "position": i + 1 });
		}

		try {
			await Api.send("assets/php/playlist.php", {
				"cmd": "reorder",
				"playlist_id": ModalPlaylist.editingPlaylistId,
				"items": items
			});
		} catch (e) {}
	}

	/**
	 * Reads the create form fields and sends a create request to the server.
	 */
	static create() {
		if (!FeatureGate.check("playlists")) {
			FeatureGate.showUpgradePrompt("playlists");
			return;
		}
		let titleElm = document.getElementById("playlist-create-title");
		let descElm = document.getElementById("playlist-create-description");
		let messageElm = document.getElementById("playlist-create-message");
		if (!titleElm) return;

		let title = titleElm.value.trim();
		let description = descElm ? descElm.value.trim() : "";

		if (title.length === 0) {
			ModalPlaylist.setMessage(messageElm, "Please enter a playlist title.", "error");
			return;
		}

		let permissions = {};
		let keys = ["view", "like", "add_to_playlist", "edit_lyrics", "edit_song_info"];
		let levels = ["private", "unlisted", "public"];
		for (let i = 0; i < keys.length; i++) {
			for (let j = 0; j < levels.length; j++) {
				let cb = document.querySelector("input[name='create_perm_" + keys[i] + "_" + levels[j] + "']");
				permissions[keys[i] + "_" + levels[j]] = cb && cb.checked ? 1 : 0;
			}
		}

		ModalPlaylist.setMessage(messageElm, "Creating...", "");

		let a = {
			"src": "assets/php/playlist.php",
			"args": {
				"cmd": "create",
				"title": title,
				"description": description,
				"permissions": permissions
			}
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string")
					data = JSON.parse(data);
			} catch (e) {}
			if (data && data.success === true) {
				Toast.success("Playlist created!");
				ModalPlaylist.setMessage(messageElm, "", "");
				if (titleElm) titleElm.value = "";
				if (descElm) descElm.value = "";
				ModalPlaylist.loaded = false;
				ModalPlaylist.load(function () {
					let listElm = document.getElementById("modal-playlist-list");
					if (listElm)
						listElm.innerHTML = ModalPlaylist.renderPlaylistItems();
				});
			} else {
				let msg = data && data.message ? data.message : "Failed to create playlist.";
				ModalPlaylist.setMessage(messageElm, msg, "error");
			}
		});
	}

	/**
	 * Sends a delete request for the specified playlist and refreshes the list.
	 * @param {string|number} id
	 */
	static deletePlaylist(id) {
		let a = {
			"src": "assets/php/playlist.php",
			"args": { "cmd": "delete", "playlist_id": id }
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string")
					data = JSON.parse(data);
			} catch (e) {}
			if (data && data.success === true) {
				Toast.success("Playlist deleted.");
				ModalPlaylist.loaded = false;
				ModalPlaylist.load(function () {
					let listElm = document.getElementById("modal-playlist-list");
					if (listElm)
						listElm.innerHTML = ModalPlaylist.renderPlaylistItems();
				});
			} else {
				let msg = data && data.message ? data.message : "Failed to delete playlist.";
				Toast.error(msg);
			}
		});
	}

	/**
	 * Loads and plays a playlist.
	 * @param {string|number} id
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

	static setMessage(elm, text, type) {
		if (elm) {
			elm.innerText = text;
			elm.className = "modal-form-message" + (type ? " " + type : "");
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
