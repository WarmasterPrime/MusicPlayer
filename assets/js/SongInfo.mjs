/**
 * Provides song metadata parsing utilities and stores song information.
 */
export class SongInfo {

	/**
	 * Gets the name of the song.
	 * @returns {string}
	 */
	get name() {
		return this.songName;
	}

	/**
	 * Gets the artist of the song.
	 * @returns {string}
	 */
	get artist() {
		return this.songArtist;
	}

	/**
	 * Creates a new SongInfo instance.
	 * @param {string} songName - The name of the song.
	 * @param {string} songArtist - The artist of the song.
	 * @param {string|File|HTMLAudioElement} songFileOrElement - The song source.
	 */
	constructor(songName, songArtist, songFileOrElement) {
		this.songName = songName;
		this.songArtist = songArtist;
		this.songFile = null;
		this.element = null;

		if (songFileOrElement !== undefined) {
			if (typeof songFileOrElement === "string") {
				SongInfo.getDataFromUrl(songFileOrElement, this.#updateSongFileData.bind(this));
				this.element = document.createElement("audio");
				this.element.src = songFileOrElement;
				let meInstance = this;
				this.element.onload = function () {
					meInstance.#updateSongFileDataAlternative();
				};
			} else if (songFileOrElement instanceof File) {
				this.songFile = songFileOrElement;
			} else if (songFileOrElement instanceof HTMLAudioElement) {
				this.element = songFileOrElement;
				SongInfo.getDataFromElement(songFileOrElement);
			}
			if (this.element instanceof HTMLAudioElement) {
				if (this.element.readyState > 3)
					this.#updateSongFileDataAlternative();
				else
					this.element.load();
			}
		}
	}

	/**
	 * Updates the song file duration from the audio element.
	 */
	#updateSongFileDataAlternative() {
		if (this.songFile)
			this.songFile.duration = this.element.duration;
	}

	/**
	 * Updates the songFile property with fetched data.
	 * @param {object} songInfoData - The song info data object.
	 */
	#updateSongFileData(songInfoData) {
		this.songFile = songInfoData;
	}

	/**
	 * Gets audio data from an HTMLAudioElement.
	 * @param {HTMLAudioElement} audioElement - The audio element.
	 * @param {Function} callBackFunction - The callback function.
	 */
	static getDataFromElement(audioElement, callBackFunction = undefined) {
		if (audioElement instanceof HTMLAudioElement)
			SongInfo.getDataFromUrl(SongInfo.getAudioSource(audioElement), callBackFunction);
	}

	/**
	 * Gets the source URL from an audio element.
	 * @param {HTMLAudioElement} audioElement - The audio element.
	 * @returns {string|undefined}
	 */
	static getAudioSource(audioElement) {
		return audioElement instanceof HTMLAudioElement ? audioElement.currentSrc : undefined;
	}

	/**
	 * Fetches audio file data from a URL.
	 * @param {string} url - The URL to fetch from.
	 * @param {Function} callBackFunction - The callback to invoke with the data.
	 */
	static getDataFromUrl(url, callBackFunction = undefined) {
		if (typeof url === "string") {
			fetch(url).then(response => {
				const fileSizeFromHeaders = response.headers.get("Content-Length");
				const blob = response.blob();
				return Promise.all([blob, fileSizeFromHeaders]);
			}).then(([blob, fileSizeFromHeaders]) => {
				const fileSize = fileSizeFromHeaders ? parseInt(fileSizeFromHeaders) : blob.size;
				let res = { size: fileSize, blob: blob };
				return Promise.all([res]);
			}).then(q => {
				if (callBackFunction !== undefined && callBackFunction instanceof Function)
					callBackFunction(q[0]);
			}).catch(error => {
				console.error("Failed to fetch audio data from URL \"" + url + "\".", error);
			});
		}
	}

	/**
	 * Extracts the filename from a URL.
	 * @param {string} url - The URL of the file.
	 * @returns {string}
	 */
	static getFileName(url) {
		try {
			let obj = new URL(url, url.startsWith("http") ? undefined : window.location.protocol + "//" + window.location.hostname);
			const pattern = /\/(?<fileName>[^/]+)(\.[^S\z]+)($|\z)/gm;
			let res = pattern.exec(decodeURI(obj.pathname));
			if (res !== undefined && res !== null && Object.keys(res).includes("groups"))
				return res.groups !== undefined ? res.groups.fileName : url;
		} catch {}
		return url;
	}

	/**
	 * Splits the filename into parts by hyphen separator.
	 * @param {string} url - The source URL.
	 * @returns {string[]}
	 */
	static getSongNameParts(url) {
		return SongInfo.getFileName(url).split("-");
	}

	/**
	 * Extracts the song name from a URL (part after the hyphen).
	 * @param {string} url - The source URL.
	 * @returns {string}
	 */
	static getSongName(url) {
		let ins = SongInfo.getSongNameParts(url);
		if (ins.length > 1) {
			let tmp = ins[1].trimStart().trimEnd();
			let pattern = /[^A-Za-z\d.\s]+/gm;
			return (tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd();
		}
		return Array.isArray(ins) ? ins.join("") : ins;
	}

	/**
	 * Extracts the artist name from a URL (part before the hyphen).
	 * @param {string} url - The source URL.
	 * @returns {string}
	 */
	static getArtist(url) {
		let ins = SongInfo.getSongNameParts(url);
		if (ins.length > 1) {
			let tmp = ins[0].trimStart().trimEnd();
			let pattern = /[^A-Za-z\d.\s]+/gm;
			return (tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd();
		}
		return Array.isArray(ins) ? ins.join("") : ins;
	}
}
