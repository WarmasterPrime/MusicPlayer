import { SongInfo } from "./SongInfo.mjs";
import { Lyrics } from "./Lyrics.mjs";
import { UrlParams } from "./UrlParams.mjs";
import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { Session } from "./Session.mjs";

/**
 * Controls audio playback, song metadata, lyrics, and keyboard input.
 */
export class Player {

	/**
	 * Gets the volume as a percentage (0-100).
	 * @returns {number}
	 */
	get volume() {
		return this.element.volume * 100;
	}

	/**
	 * Sets the volume level as a percentage (0-100).
	 * @param {number} value - The volume percentage.
	 */
	set volume(value) {
		if (typeof value === "number" && value >= 0 && value <= 100)
			this.element.volume = value / 100;
	}

	/**
	 * Gets the current time position in milliseconds.
	 * @returns {number}
	 */
	get currentTime() {
		return this.element.currentTime * 1000;
	}

	/**
	 * Gets the song duration in milliseconds.
	 * @returns {number}
	 */
	get duration() {
		return this.element.duration * 1000;
	}

	/**
	 * Sets the current time position in milliseconds.
	 * @param {number} value - The time in milliseconds.
	 */
	set currentTime(value) {
		value /= 1000;
		if (value < 0) value = 0;
		if (value > this.element.duration) value = this.element.duration;
		if (typeof value === "number")
			this.element.currentTime = value;
	}

	/**
	 * Gets the currently active audio source URL.
	 * @returns {string}
	 */
	get source() {
		return this.element.currentSrc;
	}

	/**
	 * Sets the audio source and parses song metadata from the URL.
	 * @param {string} value - The audio source URL.
	 */
	set source(value) {
		if (typeof value === "string") {
			this.element.src = value;
			try {
				if (typeof AudioLibrary !== "undefined") {
					AudioLibrary.song = value;
				}
			} catch {}
			// Use stored metadata from AudioLibrary if available (stream URLs can't be parsed)
			if (typeof AudioLibrary !== "undefined" && AudioLibrary.currentSongName && AudioLibrary.currentSongName.length > 0) {
				let parts = AudioLibrary.currentSongName.split(" - ");
				if (parts.length >= 2) {
					this.songArtist = parts[0].trim();
					this.songName = parts.slice(1).join(" - ").trim();
				} else {
					this.songName = AudioLibrary.currentSongName;
					this.songArtist = "";
				}
			} else {
				this.songName = Player.getSongName(value);
				this.songArtist = Player.getSongArtist(value);
			}
			this.getSongLyrics(this.songName, this.songArtist);
		}
	}

	/**
	 * Returns whether the audio is currently playing.
	 * @returns {boolean}
	 */
	get isPlaying() {
		return this._isPlaying;
	}

	/**
	 * Returns whether the audio can play through without buffering.
	 * @returns {boolean}
	 */
	get canPlayThrough() {
		return this._canPlayThrough;
	}

	/**
	 * Gets the song name.
	 * @returns {string}
	 */
	get songName() {
		return this._songName;
	}

	/**
	 * Sets the song name and updates the display.
	 * @param {string} value - The song name.
	 */
	set songName(value) {
		this._songName = value;
		this.display = this.formatDisplay();
	}

	/**
	 * Gets the song artist.
	 * @returns {string}
	 */
	get songArtist() {
		return this._songArtist;
	}

	/**
	 * Sets the song artist and updates the display.
	 * @param {string} value - The artist name.
	 */
	set songArtist(value) {
		this._songArtist = value;
		this.display = this.formatDisplay();
	}

	/**
	 * Formats the song display text based on user preference.
	 * @returns {string}
	 */
	formatDisplay() {
		let artist = this._songArtist || "";
		let title = this._songName || "";
		if (Session.songDisplayFormat === "title-artist") {
			return title + " - " + artist;
		}
		return artist + " - " + title;
	}

	/**
	 * Gets the display text shown on the song name element.
	 * @returns {string}
	 */
	get display() {
		return this.songNameElement.innerText;
	}

	/**
	 * Sets the display text on the song name element.
	 * @param {string} value - The display text.
	 */
	set display(value) {
		this.songNameElement.innerText = value;
	}

	/**
	 * Returns whether the user has interacted with the page,
	 * or if running inside OBS (which has no user interaction).
	 * @returns {boolean}
	 */
	get userActivation() {
		if (window.navigator.userAgent.indexOf("OBS/") !== -1) return true;
		return !!(window.navigator.userActivation && (window.navigator.userActivation.isActive || window.navigator.userActivation.hasBeenActive));
	}

	/**
	 * A callback for when rendering should start. Set externally by main.mjs.
	 * @type {Function|null}
	 */
	onRenderStart = null;

	/**
	 * Creates a new Player instance.
	 * @param {HTMLAudioElement} playerElement - The audio element.
	 * @param {HTMLDivElement} captionElement - The caption/subtitle element.
	 * @param {HTMLDivElement} progressBarElement - The progress bar element.
	 * @param {HTMLDivElement} songNameElm - The song name display element.
	 */
	constructor(playerElement, captionElement, progressBarElement, songNameElm) {
		this.element = playerElement;
		this.captionElement = captionElement;
		this.progressBarElement = progressBarElement;
		this.songNameElement = songNameElm;
		this.lyrics = {};
		this.lyricsEnabled = true;
		this.currentSong = null;
		this._songName = null;
		this._songArtist = null;
		this._isPlaying = false;
		this._canPlayThrough = false;
		this.processingPlayRequest = false;

		let meInstance = this;
		this.element.oncanplaythrough = function () {
			meInstance._canPlayThrough = true;
		};
		this.element.onloadstart = function () {
			meInstance._canPlayThrough = false;
		};

		let bodyElement = document.querySelector("body");
		bodyElement.addEventListener("mousedown", function (event) {
			setTimeout(function () { Player.mouseActionProcess(event, meInstance); }, 250);
		});
		// Only handle keyboard controls when canvas is focused
		let canvasHandler = function (event) {
			if (event.code === "ArrowRight")
				meInstance.currentTime = meInstance.currentTime + 3000;
			else if (event.code === "ArrowLeft")
				meInstance.currentTime = meInstance.currentTime - 3000;
			else if (event.code === "Space") {
				event.preventDefault();
				if (!meInstance.isPlaying) {
					meInstance.play(meInstance.source);
					if (typeof meInstance.onRenderStart === "function")
						meInstance.onRenderStart();
				} else {
					meInstance.pause();
				}
			}
			else if (event.code === "ArrowUp")
				meInstance.volume += 1;
			else if (event.code === "ArrowDown")
				meInstance.volume -= 1;
		};
		// Attach to canvas element so spacebar only works when canvas is focused
		let attachCanvas = function () {
			let canvas = document.getElementById("visualizer") || document.querySelector("canvas");
			if (canvas) {
				canvas.setAttribute("tabindex", "0");
				canvas.addEventListener("keydown", canvasHandler);
			} else {
				setTimeout(attachCanvas, 200);
			}
		};
		attachCanvas();
	}

	/**
	 * Handles mouse button navigation (back/forward buttons).
	 * @param {MouseEvent} event - The mouse event.
	 * @param {Player} instance - The player instance.
	 */
	static mouseActionProcess(event, instance) {
		if (event.buttons === 8 || event.buttons === 16) {
			let urlParams = UrlParams.GetParams();
			let songUrl = urlParams["song"];
			if (songUrl !== undefined)
				instance.play(songUrl);
		}
	}

	/**
	 * Plays the song from the given source.
	 * @param {string} source - The audio source URL or path.
	 * @param {boolean} overrideUserActivation - Whether to bypass user activation check.
	 */
	play(source = undefined, overrideUserActivation = false) {
		source = Player.getValueFromServerResponse(source);
		if (this._songName !== null && this._songArtist !== null)
			this.display = this.formatDisplay();
		this.processingPlayRequest = true;

		if (source !== undefined && source !== this.source)
			this.source = source;

		if (this.userActivation === true || overrideUserActivation === true) {
			if (this.canPlayThrough) {
				this.element.play();
				this._isPlaying = true;
				this.processingPlayRequest = false;
			} else {
				let ins = this;
				setTimeout(function () { ins.play(source); }, 500);
			}
		} else {
			this.display = "CLICK HERE TO PLAY \"" + this.songName + "\"";
			let meIns = this;
			let elm = document.querySelector("body");
			let func = function () {
				elm.removeEventListener("click", func);
				setTimeout(function () { meIns.play(source); }, 10);
			};
			elm.addEventListener("click", func);
		}
	}

	/**
	 * Pauses the song.
	 */
	pause() {
		if (this._isPlaying)
			this.element.pause();
		this._isPlaying = false;
	}

	/**
	 * Seeks the audio by a specified value in milliseconds.
	 * @param {number} value - The seek offset in milliseconds.
	 */
	seek(value) {
		this.currentTime += value;
	}

	/**
	 * Fetches song lyrics from the server.
	 * @param {string} songName - The name of the song.
	 * @param {string} artist - The artist of the song.
	 */
	getSongLyrics(songName, artist) {
		let a = {
			"src": "assets/php/getSongLyrics.php",
			"args": {
				"songName": songName,
				"artist": artist
			}
		};
		let meInstance = this;
		Server.send(a, true, { "class": meInstance, "method": "loadLyrics" });
	}

	/**
	 * Displays the current lyrics based on playback position.
	 */
	playLyrics() {
		if (this.lyricsEnabled) {
			let time = Math.floor(this.currentTime);
			this.displayLyrics(time);
		}
	}

	/**
	 * Loads lyrics data into memory.
	 * @param {object} songLyricsObject - The raw lyrics data.
	 */
	loadLyrics(songLyricsObject) {
		let obj = Player.parseJson(songLyricsObject);
		this.lyrics = new Lyrics(obj);
	}

	/**
	 * Parses a value to JSON, handling ServerResponse wrappers.
	 * @param {*} value - The value to parse.
	 * @returns {object}
	 */
	static parseJson(value) {
		try {
			return JSON.parse(value);
		} catch {
			if (value instanceof ServerResponse)
				return value.value;
			return value;
		}
	}

	/**
	 * Gets the lyric text for the given time position.
	 * @param {number} currentTime - The current playback time in milliseconds.
	 * @returns {string}
	 */
	getCurrentLyrics(currentTime) {
		return this.lyrics !== undefined && Object.keys(this.lyrics).length > 0
			? this.lyrics.getAtTime(currentTime.toString())
			: "";
	}

	/**
	 * Displays lyrics at the given time position.
	 * @param {number} currentTime - The current playback time in milliseconds.
	 */
	displayLyrics(currentTime) {
		let text = this.getCurrentLyrics(currentTime);
		if (text !== undefined && text !== "]")
			this.setCaption(text);
	}

	/**
	 * Loads a local audio file for client-side playback (not saved to database).
	 * @param {HTMLInputElement} fileUploadElement - The file input element.
	 */
	uploadSong(fileUploadElement) {
		let files = fileUploadElement.files;
		if (files.length > 0 && files[0]) {
			let file = files[0];
			const url = window.URL || window.webkitURL;
			let fileUrl = url.createObjectURL(file);
			this.element.src = fileUrl;
			this.songName = Player.getSongName(file.name);
			this.songArtist = Player.getSongArtist(file.name);
			if (this.songName === this.songArtist)
				this.display = this.songName;
			this.play();
		}
	}

	/**
	 * Sets the caption/subtitle text.
	 * @param {string} textValue - The text to display.
	 */
	setCaption(textValue = "") {
		this.captionElement.innerText = textValue;
	}

	/**
	 * Extracts the song name from a source URL.
	 * @param {string} source - The source URL.
	 * @returns {string}
	 */
	static getSongName(source) {
		return SongInfo.getSongName(source);
	}

	/**
	 * Extracts the artist name from a source URL.
	 * @param {string} source - The source URL.
	 * @returns {string}
	 */
	static getSongArtist(source) {
		return SongInfo.getArtist(source);
	}

	/**
	 * Unwraps a ServerResponse value if applicable.
	 * @param {*} value - The value to unwrap.
	 * @returns {*}
	 */
	static getValueFromServerResponse(value) {
		return (ServerResponse !== undefined && value instanceof ServerResponse) ? value.value : value;
	}
}
