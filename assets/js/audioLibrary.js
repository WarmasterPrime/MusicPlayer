
var GV_src = "";

class audioLib {

	static dir = "";
	static path = window.location.protocol + "//" + window.location.hostname + "/files/Music/";
	static song = "";
	static sntmp = false;

	static temp;

	static ini() {
		if (document.getElementById("player")) {
			var elm = document.getElementById("player");
			elm.onended = function () {audioLib.selectSong(false);};
			//var temp = new visualizer(elm);
		} else {
			setTimeout(function () {audioLib.ini();}, 100);
		}
	}

	static selectSong(q = false) {
		//console.warn(q);
		//console.log("PASSED");
		q = audioLib.getValueFromServerResponse(q);
		let p = false;
		if (document.getElementById("shuffle-opt")) {
			if (document.getElementById("shuffle-opt").checked) {
				p = true;
			} else {
				p = false;
			}
		}
		let t = (typeof q);
		if (t === "array" || t === "object") {
			if (q.keyCode) {
				q = true;
			}
		}

		if (p === true || q === true) {
			//let q=document.getElementById("player").src;
			//console.log("PASSED");

			let a = {
				"src": "assets/php/getRandomSong.php",
				"args": {
					"cmd": audioLib.song
				}
			};
			document.getElementById("player").pause();
			//console.log((document.getElementById("player").paused===true && p===true));
			//console.log(p);
			if ((document.getElementById("player").paused === true && p === true) || q === true) {
				Server.send(a, true, audioLib.play);
			}
		} else {
			console.warn(p);
		}

	}

	static get src() {
		return GV_src;
	};
	static set src(q = false) {
		q = audioLib.getValueFromServerResponse(q);
		GV_src = q;
		//console.log(q);
	}

	static getItems() {
		var t = "ini";
		if (audioLib.src.endsWith(".mp3") || audioLib.src.endsWith(".m4a") || audioLib.src.endsWith(".mp4") || audioLib.src.endsWith(".mov")) {
			t = "get";
		} else {
			t = "ini";
		}
		var a = {
			"src": window.location.protocol + "//" + window.location.hostname + "/files/WebAssets/PHP/audio/index.php",
			"args": {
				"cmd": t,
				"path": audioLib.src
			}
		};
		//console.log(a);
		//console.log(audioLib.src);
		Server.Send(a, true, audioLib.displayItems);
	}

	static select(q = false) {
		q = audioLib.getValueFromServerResponse(q);
		if (q !== false) {
			audioLib.src = q;
			audioLib.getItems();
		}
	}

	static notNull(value) {
		return value !== undefined && value !== null && value !== false;
	}

	static isServerResponse(value) {
		return audioLib.notNull(ServerResponse) && audioLib.notNull(value) && value instanceof ServerResponse;
	}

	static isServerError(value) {
		return audioLib.notNull(value) && typeof (value) === "string" && value.includes("<") && value.includes("x-debug");
	}

	static displayItems(q = false) {
		//console.log(q.value);
		var list, i, lim, data, path, temp, altpath;
		//console.warn(audioLib.src);
		q = audioLib.getValueFromServerResponse(q);
		if (audioLib.src.indexOf("/") != -1) {
			altpath = audioLib.src.split("/");
			altpath = audioLib.src.split("/")[altpath.length - 1];
			altpath = audioLib.src.split(altpath)[0];
		} else {
			altpath = "";
			//audioLib.src="";
		}

		if (audioLib.notNull(q)) {
			if (audioLib.isServerError(q)) {
				console.error(q);
				if (document.getElementById("menu")) {
					if (altpath.length > 0 && altpath[altpath.length - 1] === "/")
						altpath = altpath.substring(0, altpath.length - 1);
					document.getElementById("menu").innerHTML = q + "<button class='back' onclick=\"audioLib.select('" + altpath + "')\">Back</button>";
				}
			} else {
				list = Player.parseJson(q);
				list = list;
				lim = list.length;
				i = 0;
				data = "";
				temp = "";
				if (altpath.length > 0) {
					if (altpath[altpath.length - 1] === "/") {
						altpath = altpath.substring(0, altpath.length - 1);
						//console.warn(altpath);
					}
				}
				let exts = [
					"mp3",
					"m4a",
					"mp4",
					"mov",
					"flac",
					"wav",
					"wma",
					"aac"
				];

				while (i < lim) {
					temp = list[i];
					if (audioLib.src !== "") {
						path = audioLib.src + "/" + temp[0];
					} else {
						path = temp[0];
					}
					if (path.indexOf("'") != -1 || path.indexOf("\"") != -1) {
						path = path.replace(/(\")/, "\\\"");
						path = path.replace(/(\')/, "\\\'");
					}
					let found = false;
					for (let ii = 0; ii < exts.length; ii++) {
						if (path.endsWith("." + exts[ii])) {
							data = data + "<div class='item' type='file'><button onclick=\"audioLib.play('" + path + "')\">" + temp[0] + "</button></div>";
							found = true;
							break;
						}
					}
					if (!found)
						data = data + "<div class='item' type='dir'><button onclick=\"audioLib.select('" + path + "')\">" + temp[0] + "</button></div>";
					i++;
				}
				data = "<button class='back' onclick=\"audioLib.select('" + altpath + "')\">Back</button>" + data;
				if (document.getElementById("menu")) {
					document.getElementById("menu").innerHTML = data;
				}
			}
		}
	}

	static getValueFromServerResponse(value) {
		return audioLib.notNull(ServerResponse) && value instanceof ServerResponse ? value.value : value;
	}

	static getName(q = false) {
		q = audioLib.getValueFromServerResponse(q);
		if (audioLib.notNull(q))
			q = q.match(/[\/]([^\/]+)\.(mp3|m4a|mp4|mov)/)[1];
		return q;
	}

	static playOvr(q = false) {
		document.getElementById("song-name").removeEventListener("click", function () {audioLib.playOvr(q);});
		audioLib.play(q);
	}

	static play(q = false) {
		if (document.getElementById("player")) {
			let elm = document.getElementById("player");
			if (elm.paused) {
				audioLib.overridePlay(q);
			} else {
				elm.pause();
				setTimeout(function () {audioLib.play(q);}, 50);
			}
		}
	}

	static overridePlayListener() {
		let q = audioLib.temp;
		audioLib.playOvr(q);
		document.getElementById("song-name").removeEventListener("click", audioLib.overridePlayListener);
	}
	static overridePlay(q = false) {
		var elm;
		if (document.getElementById("player")) {
			elm = document.getElementById("player");
			elm.src = audioLib.path + q;
			if (document.getElementById("song-name")) {
				document.getElementById("song-name").innerHTML = audioLib.getName(q);
				audioLib.song = q;
			}
			let pass = true;
			if (window) {
				if (window.navigator) {
					if (window.navigator.userActivation) {
						if (!window.navigator.userActivation.hasBeenActive) {
							pass = false;
							if (document.getElementById("song-name")) {
								document.getElementById("song-name").innerHTML = "Click here to start song";
								audioLib.temp = q;
								audioLib.sntmp = document.getElementById("song-name").addEventListener("click", audioLib.overridePlayListener);
							}
						}
					}
				}
			}
			if (pass) {
				//elm.play();
				if (player !== undefined) {
					player.play(q);
					//setTimeout(function(){player.updateHead();},10);
				}
			}
		}
	}


}