import { Server } from "./lib/Server.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { UrlParams } from "./UrlParams.mjs";

/**
 * Manages playlist state and playback queue.
 * Handles sequential playback of songs within a loaded playlist.
 */
export class Playlist {

	/**
	 * The currently active playlist object, or null if none is loaded.
	 * @type {object|null}
	 */
	static currentPlaylist = null;

	/**
	 * Array of song objects in play order.
	 * @type {Array}
	 */
	static queue = [];

	/**
	 * Current position in the queue. -1 means no song is active.
	 * @type {number}
	 */
	static currentIndex = -1;

	/**
	 * Whether to loop back to the start when the queue ends.
	 * @type {boolean}
	 */
	static loopPlaylist = true;

	/**
	 * Fetches playlist songs from the server and stores them in the queue.
	 * @param {string|number} playlistId - The ID of the playlist to load.
	 * @param {Function} callback - Called when loading is complete.
	 */
	static load(playlistId, callback) {
		let a = {
			"src": "assets/php/getPlaylistSongs.php",
			"args": { "playlist_id": playlistId }
		};
		Server.send(a, true, function (response) {
			let data = AudioLibrary.getValueFromServerResponse(response);
			try {
				if (typeof data === "string")
					data = JSON.parse(data);
			} catch (e) {}
			if (data && data.success === true && Array.isArray(data.songs)) {
				Playlist.currentPlaylist = data.playlist || { "id": playlistId };
				Playlist.queue = data.songs;
				Playlist.currentIndex = -1;
			} else {
				Playlist.currentPlaylist = null;
				Playlist.queue = [];
				Playlist.currentIndex = -1;
			}
			if (typeof callback === "function")
				callback();
		});
	}

	/**
	 * Starts playing the queue from the first song.
	 * Sets the playlist URL parameter for sharing.
	 */
	static playAll() {
		if (Playlist.queue.length === 0)
			return;
		if (Playlist.currentPlaylist && Playlist.currentPlaylist.id)
			UrlParams.SetParam("playlist", Playlist.currentPlaylist.id);
		Playlist.playSongAtIndex(0);
	}

	/**
	 * Advances to the next song in the queue.
	 * Loops back to the start if looping is enabled and the end is reached.
	 */
	static playNext() {
		if (Playlist.queue.length === 0)
			return;
		let nextIndex = Playlist.currentIndex + 1;
		if (nextIndex >= Playlist.queue.length) {
			if (Playlist.loopPlaylist)
				nextIndex = 0;
			else
				return;
		}
		Playlist.playSongAtIndex(nextIndex);
	}

	/**
	 * Goes to the previous song in the queue.
	 * Wraps to the last song if at the beginning and looping is enabled.
	 */
	static playPrevious() {
		if (Playlist.queue.length === 0)
			return;
		let prevIndex = Playlist.currentIndex - 1;
		if (prevIndex < 0) {
			if (Playlist.loopPlaylist)
				prevIndex = Playlist.queue.length - 1;
			else
				return;
		}
		Playlist.playSongAtIndex(prevIndex);
	}

	/**
	 * Plays the song at a specific position in the queue.
	 * Sets AudioLibrary.currentSongId and currentSongName, then starts playback.
	 * @param {number} index - The queue position to play.
	 */
	static playSongAtIndex(index) {
		if (index < 0 || index >= Playlist.queue.length)
			return;
		let song = Playlist.queue[index];
		Playlist.currentIndex = index;
		AudioLibrary.currentSongId = song.song_id || "";
		let artist = song.artist || "";
		let title = song.title || "";
		AudioLibrary.currentSongName = artist.length > 0 ? artist + " - " + title : title;
		AudioLibrary.currentSourceUrl = song.source_url || "";
		// Disable loop so the ended event fires for playlist advancement
		let player = document.getElementById("player");
		if (player) player.loop = false;
		let streamUrl = song.stream_url || "";
		if (streamUrl.length > 0) {
			AudioLibrary.play(streamUrl);
			if (typeof song.song_id === "string" && song.song_id.length > 0)
				UrlParams.SetParam("song", song.song_id);
		}
	}

	/**
	 * Called when the current audio track ends.
	 * Advances to the next song if a playlist is loaded and shuffle is not active.
	 */
	static onSongEnded() {
		let shuffleOpt = document.getElementById("shuffle-opt");
		let shuffleActive = shuffleOpt && shuffleOpt.checked;
		if (!shuffleActive && Playlist.currentPlaylist !== null && Playlist.queue.length > 0)
			Playlist.playNext();
	}

	/**
	 * Resets the queue and all playlist state.
	 * Removes the playlist URL parameter.
	 */
	static clear() {
		Playlist.currentPlaylist = null;
		Playlist.queue = [];
		Playlist.currentIndex = -1;
		UrlParams.removeParam("playlist");
		// Re-enable loop when no playlist is active
		let player = document.getElementById("player");
		if (player) player.loop = true;
	}
}
