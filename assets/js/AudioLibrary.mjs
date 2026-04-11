import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";
import { Player } from "./Player.mjs";
import { Playlist } from "./Playlist.mjs";

/**
 * Manages the audio library: song selection, playback, and file browsing.
 */
export class AudioLibrary {

	static dir = "";
	static song = "";
	static sntmp = false;
	static currentSongId = "";
	static currentSongName = "";
	static currentSourceUrl = "";
	static temp;

	/**
	 * A reference to the Player instance. Set by main.mjs.
	 * @type {Player|null}
	 */
	static player = null;

	/**
	 * Initializes the audio library and sets up the ended event.
	 */
	static ini() {
		if (document.getElementById("player")) {
			let elm = document.getElementById("player");
			elm.onended = function () {
				if (AudioLibrary._errorFlag) return;
				// If a playlist is active and shuffle is off, advance the playlist
				if (Playlist.currentPlaylist !== null && Playlist.queue.length > 0) {
					let shuffleOpt = document.getElementById("shuffle-opt");
					if (!shuffleOpt || !shuffleOpt.checked) {
						Playlist.playNext();
						return;
					}
				}
				AudioLibrary.selectSong(false);
			};
			elm.onerror = function () {
				AudioLibrary._errorFlag = true;
				console.warn("Audio stream error for:", elm.src);
			};
		}
	}

	/**
	 * Flag to prevent retry loops when an audio stream fails.
	 * @type {boolean}
	 */
	static _errorFlag = false;

	/**
	 * Selects a random song from the server if shuffle is enabled.
	 * @param {*} q - Optional trigger value.
	 */
	static selectSong(q = false) {
		q = AudioLibrary.getValueFromServerResponse(q);
		let p = false;
		if (document.getElementById("shuffle-opt")) {
			p = document.getElementById("shuffle-opt").checked;
		}
		let t = typeof q;
		if (t === "object" && q !== null && q.keyCode)
			q = true;

		if (p === true || q === true) {
			let a = {
				"src": "assets/php/getRandomSong.php",
				"args": { "cmd": AudioLibrary.currentSongId || "" }
			};
			document.getElementById("player").pause();
			if ((document.getElementById("player").paused === true && p === true) || q === true) {
				Server.send(a, true, function (response) {
					let data = AudioLibrary.getValueFromServerResponse(response);
					try {
						if (typeof data === "string") data = JSON.parse(data);
					} catch (e) {}
					if (data && data.success === true && data.stream_url) {
						AudioLibrary.currentSongId = data.song_id || "";
						let artist = data.artist || "";
						let title = data.title || "";
						AudioLibrary.currentSongName = artist.length > 0 ? artist + " - " + title : title;
						AudioLibrary.currentSourceUrl = data.source_url || "";
						AudioLibrary.play(data.stream_url);
					}
				});
			}
		}
	}

	/**
	 * Checks if a value is not null/undefined/false.
	 * @param {*} value - The value to check.
	 * @returns {boolean}
	 */
	static notNull(value) {
		return value !== undefined && value !== null && value !== false;
	}

	/**
	 * Checks if a value is a ServerResponse instance.
	 * @param {*} value - The value to check.
	 * @returns {boolean}
	 */
	static isServerResponse(value) {
		return AudioLibrary.notNull(value) && value instanceof ServerResponse;
	}

	/**
	 * Unwraps a ServerResponse value if applicable.
	 * @param {*} value - The value to unwrap.
	 * @returns {*}
	 */
	static getValueFromServerResponse(value) {
		return (value instanceof ServerResponse) ? value.value : value;
	}

	/**
	 * Extracts a filename from a path.
	 * @param {string} q - The file path.
	 * @returns {string}
	 */
	static getName(q = false) {
		q = AudioLibrary.getValueFromServerResponse(q);
		if (AudioLibrary.notNull(q)) {
			try {
				let match = q.match(/[\/]([^\/]+)\.(mp3|m4a|mp4|mov)/);
				if (match) q = match[1];
				else q = "";
			} catch (e) {
				q = "";
			}
		}
		return q;
	}

	/**
	 * Plays a song, pausing any currently playing track first.
	 * @param {string} q - The song path or identifier.
	 */
	static play(q = false) {
		if (document.getElementById("player")) {
			let elm = document.getElementById("player");
			if (elm.paused) {
				AudioLibrary.overridePlay(q);
			} else {
				elm.pause();
				setTimeout(function () { AudioLibrary.play(q); }, 50);
			}
		}
	}

	/**
	 * Handles override play from a click listener.
	 */
	static overridePlayListener() {
		let q = AudioLibrary.temp;
		AudioLibrary.play(q);
		document.getElementById("song-name").removeEventListener("click", AudioLibrary.overridePlayListener);
	}

	/**
	 * Sets the audio source and initiates playback.
	 * @param {string} q - The song path or identifier.
	 */
	static overridePlay(q = false) {
		if (document.getElementById("player")) {
			AudioLibrary._errorFlag = false;
			AudioLibrary.song = q;
			let pass = true;
			let isOBS = window.navigator.userAgent.indexOf("OBS/") !== -1;
			if (!isOBS && window && window.navigator && window.navigator.userActivation) {
				if (!window.navigator.userActivation.hasBeenActive) {
					pass = false;
					if (document.getElementById("song-name")) {
						document.getElementById("song-name").innerHTML = "Click here to start song";
						AudioLibrary.temp = q;
						document.getElementById("song-name").addEventListener("click", AudioLibrary.overridePlayListener);
					}
				}
			}
			if (pass && AudioLibrary.player !== null) {
				AudioLibrary.player.play(q);
			} else if (pass) {
				// Fallback if Player not initialized yet
				let elm = document.getElementById("player");
				elm.src = q;
				elm.play();
			}
		}
	}
}
