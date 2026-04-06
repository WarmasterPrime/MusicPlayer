
class ModalSongList {

	static songs = [];
	static filteredSongs = [];
	static loaded = false;
	static loading = false;

	/**
	 * Loads all songs from the server.
	 * @param {function} callback Called when loading is complete.
	 */
	static load(callback) {
		if(ModalSongList.loading)
			return;
		ModalSongList.loading = true;
		let a = {
			"src": "assets/php/getAllSongs.php",
			"args": {}
		};
		Server.send(a, true, function(response) {
			let data = audioLib.getValueFromServerResponse(response);
			try {
				if(typeof data === "string")
					data = JSON.parse(data);
			} catch(e) {}
			if(Array.isArray(data)) {
				ModalSongList.songs = data;
				ModalSongList.filteredSongs = data;
			}
			ModalSongList.loaded = true;
			ModalSongList.loading = false;
			if(typeof callback === "function")
				callback();
		});
	}

	/**
	 * Opens the song list inside the modal. Loads songs first if not cached.
	 */
	static openInModal() {
		if(!ModalSongList.loaded) {
			Modal.open("<div style='text-align:center;padding:40px;'>Loading songs...</div>");
			ModalSongList.load(function() {
				Modal.setContent(ModalSongList.render());
				ModalSongList.attachFilterListener();
			});
		} else {
			ModalSongList.filteredSongs = ModalSongList.songs;
			Modal.open(ModalSongList.render());
			ModalSongList.attachFilterListener();
		}
	}

	/**
	 * Attaches the keyup/keypress event listeners to the filter input.
	 */
	static attachFilterListener() {
		let filterInput = document.getElementById("modal-song-filter");
		if(filterInput) {
			filterInput.addEventListener("keyup", function(event) {
				ModalSongList.filter(this.value);
			});
			filterInput.addEventListener("keypress", function(event) {
				if(event.key === "Enter")
					ModalSongList.filter(this.value);
			});
			filterInput.focus();
		}
	}

	/**
	 * Renders the song list HTML with a filter input.
	 * @returns {string} HTML string.
	 */
	static render() {
		let html = "";
		html += "<input type='text' id='modal-song-filter' class='modal-song-filter' placeholder='Search songs...' />";
		html += "<div class='modal-song-count' id='modal-song-count'>" + ModalSongList.filteredSongs.length + " songs</div>";
		html += "<div class='modal-song-list' id='modal-song-list'>";
		html += ModalSongList.renderSongItems(ModalSongList.filteredSongs);
		html += "</div>";
		return html;
	}

	/**
	 * Renders individual song item divs.
	 * @param {Array} songs The array of song objects.
	 * @returns {string} HTML string of song items.
	 */
	static renderSongItems(songs) {
		let html = "";
		for(let i = 0; i < songs.length; i++) {
			let song = songs[i];
			let artist = ModalSongList.escapeHtml(song.artist || "Unknown");
			let title = ModalSongList.escapeHtml(song.title || "Unknown");
			let songId = ModalSongList.escapeHtml(song.song_id || "");
			let path = ModalSongList.escapeAttr(song.path || "");
			html += "<div class='modal-song-item' onclick=\"ModalSongList.onSongClick('" + songId + "', '" + path + "')\">";
			html += "<span class='song-title'>" + title + "</span>";
			if(artist.length > 0 && artist !== "Unknown")
				html += " <span class='song-artist'>- " + artist + "</span>";
			html += "</div>";
		}
		if(songs.length === 0)
			html += "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>No songs found.</div>";
		return html;
	}

	/**
	 * Filters the song list based on a search query.
	 * @param {string} query The search string.
	 */
	static filter(query) {
		if(typeof query !== "string" || query.trim().length === 0) {
			ModalSongList.filteredSongs = ModalSongList.songs;
		} else {
			let q = query.toLowerCase().trim();
			ModalSongList.filteredSongs = ModalSongList.songs.filter(function(song) {
				let title = (song.title || "").toLowerCase();
				let artist = (song.artist || "").toLowerCase();
				let path = (song.path || "").toLowerCase();
				return title.includes(q) || artist.includes(q) || path.includes(q);
			});
		}
		let listElm = document.getElementById("modal-song-list");
		if(listElm)
			listElm.innerHTML = ModalSongList.renderSongItems(ModalSongList.filteredSongs);
		let countElm = document.getElementById("modal-song-count");
		if(countElm)
			countElm.innerText = ModalSongList.filteredSongs.length + " songs";
	}

	/**
	 * Handles a song being clicked in the modal.
	 * @param {string} songId The song's database ID.
	 * @param {string} path The song's relative file path.
	 */
	static onSongClick(songId, path) {
		Modal.close();
		audioLib.currentSongId = songId;
		if(typeof path === "string" && path.length > 0)
			audioLib.play(path);
		if(typeof songId === "string" && songId.length > 0)
			UrlParams.SetParam("song", songId);
	}

	/**
	 * Escapes HTML entities in a string.
	 * @param {string} str The string to escape.
	 * @returns {string}
	 */
	static escapeHtml(str) {
		if(typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	/**
	 * Escapes a string for use in HTML attributes (single-quoted).
	 * @param {string} str The string to escape.
	 * @returns {string}
	 */
	static escapeAttr(str) {
		if(typeof str !== "string") return "";
		return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
	}

}
