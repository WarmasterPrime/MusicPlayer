import VJson from "./System/Data/VJson.mjs";

/**
 * Manages song lyrics with timestamp-based lookup.
 */
export class Lyrics {
	
	/**
	 * Creates a new Lyrics instance from a lyrics JSON object.
	 * @param {object} lyricObject - The raw lyrics object with timestamp keys.
	 */
	constructor(lyricObject) {
		this.raw = lyricObject;
		this.format = Lyrics.getType(lyricObject);
		this.value = Lyrics.normalize(this.raw);
	}
	
	/**
	 * Gets the lyric text at the given time position.
	 * @param {number|string} time - The current time in milliseconds.
	 * @returns {string}
	 */
	getAtTime(time) {
		if(this.format==="lrc")
			return Lyrics.syncLyric(this.value, time);
		let key;
		let list = Object.keys(this.value);
		time = parseFloat(time);
		for (let i = 0; i < list.length; i++) {
			key = list[i];
			if (time >= key && time < list[(i + 1 < list.length - 1) ? i + 1 : list.length - 1])
				return this.value[key];
			else if (i + 1 > list.length - 1 && time >= key)
				return this.value[list[list.length - 1]];
		}
		return "";
	}
	
	/**
	 * Gets the lyric object at the given time position.
	 * @param {*} lyrics An array of the lyrics.
	 * @param {number} time The current time in seconds.
	 * @returns {object|null}
	 */
	static syncLyric(lyrics, time) {
		const scores = [];
		lyrics.forEach(lyric => {
			const score = time-lyric.timestamp;
			if(score>=0)
				scores.push(score);
		});
		if(scores.length===0)
			return null;
		return lyrics[scores.indexOf(Math.min(...scores))].text;
	}
	/**
	 * 
	 * @param {string} lrcString The raw LRC string containing timestamped lyrics, where each line is in the format "[mm:ss.xx]lyric text".
	 * @returns 
	 */
	static fromLrc(lrcString) {
		const pattern = /^\[(?<timestamp>\d{2}:\d{2}(.\d{2})?)\](?<text>.*)/;
		const lines = lrcString.split("\n");
		const output = [];
		lines.forEach(line => {
			const match = line.match(pattern);
			if(match===null)
				return;
			const {time, text} = match.groups;
			output.push({
				timestamp: Lyrics.parseTime(time),
				text: text.trim()
			});
		});
		return output;
	}
	/**
	 * Parses a time string in the format "mm:ss.xx" into seconds as a float.
	 * @param {string} time The time string in the format "mm:ss.xx" where mm is minutes, ss is seconds, and xx is optional hundredths of a second.
	 * @returns {number} The time in seconds as a float.
	 */
	static parseTime(time) {
		const minSec = time.split(":");
		const min = parseInt(minSec[0]) * 60;
		const sec = parseFloat(minSec[1]);
		return min+sec;
	}
	/**
	 * Determines the format type of the given lyrics object.
	 * @param {*} obj The JSON object obtained from the database that may or may not represent a raw JSON-lyrics object or an LRC lyrics object.
	 * @returns {boolean}
	 */
	static getType(obj) {
		return typeof obj === "object" && VJson.isSerializable(obj) && Lyrics.hasProperty(obj, "format") ? obj.format : "json";
	}
	/**
	 * Determines if the given object has the specified property, accounting for various ways properties can be defined in JavaScript objects.
	 * @param {*} obj The object to analyze.
	 * @param {*} prop THe property name to look for.
	 * @returns {boolean}
	 */
	static hasProperty(obj, prop) {
		return obj && typeof obj === "object" && (Object.prototype.hasOwnProperty.call(obj, prop) || Object.keys(obj).includes(prop));
	}
	
	/**
	 * Normalizes the lyrics object so all keys are parsed as floats.
	 * @param {object} obj - The raw lyrics object.
	 * @returns {object}
	 */
	static normalize(obj) {
		let key, value;
		let res = {};
		if (obj && typeof obj === "object") {
			for ([key, value] of Object.entries(obj))
				res[parseFloat(key)] = value;
		}
		return res;
	}
}
