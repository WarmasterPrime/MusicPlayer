import { Color } from "./Color.mjs";
import { SongInfo } from "./SongInfo.mjs";
import { Lyrics } from "./Lyrics.mjs";
import { UrlParams } from "./UrlParams.mjs";
import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";
import { Player } from "./Player.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { Visual, newBGState, setNewBGState } from "./Visualizer.mjs";
import { ProgressBar } from "./ProgressBar.mjs";
import { Modal } from "./Modal.mjs";
import { ModalSongList } from "./ModalSongList.mjs";
import { ModalAuth } from "./ModalAuth.mjs";
import { Sys } from "./Sys.mjs";
import { Session } from "./Session.mjs";
import { Api } from "./Api.mjs";
import { Toast } from "./Toast.mjs";
import { Playlist } from "./Playlist.mjs";
import { ModalPlaylist } from "./ModalPlaylist.mjs";
import { ModalPlaylistDiscovery } from "./ModalPlaylistDiscovery.mjs";
import { ModalUpload } from "./ModalUpload.mjs";
import { ModalSongManagement } from "./ModalSongManagement.mjs";
import { ModalLyricsEditor } from "./ModalLyricsEditor.mjs";
import { ModalProfile } from "./ModalProfile.mjs";
import { ModalStore } from "./ModalStore.mjs";
import { ModalFonts } from "./ModalFonts.mjs";
import { ModalAdmin } from "./ModalAdmin.mjs";
import { FeatureGate } from "./FeatureGate.mjs";
import { StoreCheckout } from "./services/StoreCheckout.mjs";
import { ModalOptions } from "./ModalOptions.mjs";
import { ModalLegal } from "./ModalLegal.mjs";
import { ModalLayoutDesigner } from "./ModalLayoutDesigner.mjs";
import { AdService } from "./AdService.mjs";
import { installCanvas, setup as setupBG, moveBG } from "./ext/Main.mjs";

// Expose classes on window for backward compatibility
window.Visual = Visual;
window.Modal = Modal;
window.ModalSongList = ModalSongList;
window.ModalAuth = ModalAuth;
window.AudioLibrary = AudioLibrary;
window.Server = Server;
window.ServerResponse = ServerResponse;
window.UrlParams = UrlParams;
window.Player = Player;
window.Color = Color;
window.SongInfo = SongInfo;
window.Lyrics = Lyrics;
window.ProgressBar = ProgressBar;
window.Sys = Sys;
window.Session = Session;
window.Api = Api;
window.Toast = Toast;
window.Playlist = Playlist;
window.ModalPlaylist = ModalPlaylist;
window.ModalPlaylistDiscovery = ModalPlaylistDiscovery;
window.ModalUpload = ModalUpload;
window.ModalSongManagement = ModalSongManagement;
window.ModalLyricsEditor = ModalLyricsEditor;
window.ModalProfile = ModalProfile;
window.ModalStore = ModalStore;
window.ModalFonts = ModalFonts;
window.ModalAdmin = ModalAdmin;
window.FeatureGate = FeatureGate;
window.ModalOptions = ModalOptions;
window.ModalLegal = ModalLegal;
window.ModalLayoutDesigner = ModalLayoutDesigner;

/**
 * Saved color state for fade toggle.
 */
let colorStorage = {
	"r": 200,
	"g": 0,
	"b": 55
};

/**
 * Creates the Player instance.
 */
const player = new Player(
	document.getElementById("player"),
	document.getElementById("caption"),
	null,
	document.getElementById("song-name")
);
window.player = player;

// Wire up cross-references
AudioLibrary.player = player;
Visual.player = player;
Sys.moveBGCallback = moveBG;

player.onRenderStart = function () {
	Visual.render();
};

/**
 * Registers modal tabs.
 */
function registerTabs() {
	// Songs tab (server-side search, 8 initial results)
	Modal.registerTab("songs", "Songs", function () {
		return ModalSongList.render();
	}, function () {
		ModalSongList.onMount();
	}, false);

	// Playlists tab (requires auth)
	Modal.registerTab("playlists", "Playlists", function () {
		// Always re-fetch playlists to get current song counts
		ModalPlaylist.load(function () {
			Modal.setContent(ModalPlaylist.render());
			ModalPlaylist.attachListeners();
		});
		if (ModalPlaylist.loaded)
			return ModalPlaylist.render();
		return "<div style='text-align:center;padding:40px;color:rgba(255,255,255,0.5);'>Loading playlists...</div>";
	}, function () {
		if (ModalPlaylist.loaded)
			ModalPlaylist.attachListeners();
	}, true);

	// Discover tab
	Modal.registerTab("discover", "Discover", function () {
		if (!ModalPlaylistDiscovery.loaded) {
			ModalPlaylistDiscovery.load(function () {
				Modal.setContent(ModalPlaylistDiscovery.render());
				ModalPlaylistDiscovery.attachListeners();
			});
			return "<div style='text-align:center;padding:40px;color:rgba(255,255,255,0.5);'>Loading playlists...</div>";
		}
		return ModalPlaylistDiscovery.render();
	}, function () {
		if (ModalPlaylistDiscovery.loaded)
			ModalPlaylistDiscovery.attachListeners();
	}, false);

	// Upload tab (requires auth)
	Modal.registerTab("upload", "Upload", function () {
		return ModalUpload.render();
	}, function () {
		ModalUpload.attachListeners();
	}, true);

	// Manage tab (requires auth)
	Modal.registerTab("manage", "Manage", function () {
		if (!ModalSongManagement.loaded) {
			ModalSongManagement.load(function () {
				Modal.setContent(ModalSongManagement.render());
				ModalSongManagement.attachListeners();
			});
			return "<div style='text-align:center;padding:40px;color:rgba(255,255,255,0.5);'>Loading songs...</div>";
		}
		ModalSongManagement.editingSongId = null;
		return ModalSongManagement.render();
	}, function () {
		if (ModalSongManagement.loaded)
			ModalSongManagement.attachListeners();
	}, true);

	// Profile tab (requires auth)
	Modal.registerTab("profile", "Profile", function () {
		return ModalProfile.render();
	}, function () {
		ModalProfile.attachListeners();
	}, true);

	// Store tab (requires auth)
	Modal.registerTab("store", "Store", function () {
		return ModalStore.render();
	}, function () {
		ModalStore.onMount();
	}, true);

	// Fonts tab (requires auth + custom_fonts feature)
	Modal.registerTab("fonts", "Fonts", function () {
		return ModalFonts.render();
	}, function () {
		ModalFonts.attachListeners();
	}, true, function () {
		return FeatureGate.check("custom_fonts");
	});

	// Admin tab (requires auth + admin authority)
	Modal.registerTab("admin", "Admin", function () {
		return ModalAdmin.render();
	}, function () {
		ModalAdmin.onMount();
	}, true, function () {
		return Session.hasFlag("StoreAdmin") || Session.hasFlag("UserAdmin");
	});
}

/**
 * Handles Google OAuth callback URL parameters.
 */
function handleAuthCallback() {
	let params = new URLSearchParams(window.location.search);
	let authSource = params.get("auth");
	let authStatus = params.get("status");

	if (authSource === "google") {
		if (authStatus === "success") {
			Toast.success("Logged in with Google.");
			Session.check().then(function () {
				ModalAuth.updateAuthButtons();
				Modal.refreshTabs();
				if (Session.isLoggedIn()) {
					FeatureGate.load().then(function () {
						Session.subscriptionTier = FeatureGate.tier;
						Session.features = FeatureGate.features;
					});
				}
			});
		} else if (authStatus === "error") {
			Toast.error("Google login failed.");
		}
		// Clean up URL
		let url = new URL(window.location.href);
		url.searchParams.delete("auth");
		url.searchParams.delete("status");
		let cleanedUrl = url.pathname + (url.search || "") + (url.hash || "");
		window.history.replaceState({}, "", cleanedUrl);
	}

	// Handle Google account link callback
	let linked = params.get("linked");
	if (linked === "google") {
		Toast.success("Google account linked.");
		let url = new URL(window.location.href);
		url.searchParams.delete("linked");
		window.history.replaceState({}, "", url.pathname + (url.search || "") + (url.hash || ""));
	}
}

/**
 * Initializes the application.
 */
function ini() {
	let obj = UrlParams.GetParams();
	applyThemeFromStorage();
	registerTabs();
	setupListeners();
	initial();
	checkSong();
	setColorsFromUrl(obj);

	// Handle legal view URL params
	if (obj["view"] === "privacy") {
		ModalLegal.openPrivacy();
		UrlParams.removeParam("view");
	} else if (obj["view"] === "terms") {
		ModalLegal.openTerms();
		UrlParams.removeParam("view");
	}

	// Apply active layout on load
	ModalLayoutDesigner.applyActiveLayout();

	// Wire up options modal
	ModalOptions.setBGStateCallback(setNewBGState);

	// Settings gear button
	let settingsBtn = document.getElementById("settings-btn");
	if (settingsBtn) {
		settingsBtn.addEventListener("click", function () {
			ModalOptions.open();
		});
	}

	// Handle polygonSides URL param
	if (obj["polygonSides"] !== undefined) {
		let sides = parseInt(obj["polygonSides"], 10);
		if (sides >= 2 && sides <= 10000) Visual.polygonSides = sides;
	}

	document.getElementById("r").addEventListener("change", function () {
		saveColorToParam();
	});
	document.getElementById("g").addEventListener("change", function () {
		saveColorToParam();
	});
	document.getElementById("b").addEventListener("change", function () {
		saveColorToParam();
	});

	// Check session state on load
	Session.check().then(function () {
		ModalAuth.updateAuthButtons();
		Modal.refreshTabs();

		// Load feature gate status for logged-in users
		if (Session.isLoggedIn()) {
			FeatureGate.load().then(function () {
				Session.subscriptionTier = FeatureGate.tier;
				Session.features = FeatureGate.features;
				AdService.init();
			});
			// Load and apply custom font preferences
			ModalFonts.loadFontOptions();
			// Load custom background image (or go transparent for OBS)
			loadUserBackground();
		} else {
			// Not logged in — show ads, OBS gets transparent
			AdService.init();
			let isOBS = window.navigator.userAgent.indexOf("OBS/") !== -1;
			if (isOBS) {
				document.getElementById("bg-hide-opt").checked = true;
				toggleBg(document.getElementById("bg-hide-opt"));
			}
		}
	});

	// Handle checkout/auth callbacks from URL params
	StoreCheckout.handleCallback();
	handleAuthCallback();
}

/**
 * Sets up the page components and canvas.
 */
function initial() {
	if (document.getElementById("player")) {
		Modal.ini();
		AudioLibrary.ini();

		let isOBS = false;
		try {
			isOBS = window.navigator.userAgent.indexOf("OBS/") !== -1;
		} catch {}

		if (isOBS) {
			document.getElementById("bg-hide").hidden = false;
			// Don't auto-hide — loadUserBackground() will decide after login check
		}

		let elm = document.getElementById("player");
		let telm = document.createElement("canvas");
		telm.id = "visualizer";
		document.getElementById("media").appendChild(telm);
		elm.addEventListener("play", function () { return startAudio(); });
		document.getElementById("visualizer").addEventListener("dblclick", function () {
			AudioLibrary.selectSong(true);
		});

		// Pause/play listeners for visualizer state
		elm.addEventListener("pause", function () { Visual.paused = true; });
		elm.addEventListener("play", function () { Visual.paused = false; });
	}

	// Install hexagon background canvas
	installCanvas();
	let conf = { "color": { "r": 255, "g": 0, "b": 100, "a": 0.5 } };
	setupBG(conf);
}

/**
 * Saves current color values to URL parameters.
 */
function saveColorToParam() {
	UrlParams.SetParam("r", Visual.color.red.toString());
	UrlParams.SetParam("g", Visual.color.green.toString());
	UrlParams.SetParam("b", Visual.color.blue.toString());
	//Visual.updateColor();
}

/**
 * Reads color values from URL parameters and applies them.
 * @param {object} obj - The URL parameters object.
 */
function setColorsFromUrl(obj) {
	if (obj["r"]) {
		Visual.color.red = parseFloat(obj["r"]);
		document.getElementById("r").value = Visual.color.red;
	}
	if (obj["g"]) {
		Visual.color.green = parseFloat(obj["g"]);
		document.getElementById("g").value = Visual.color.green;
	}
	if (obj["b"]) {
		Visual.color.blue = parseFloat(obj["b"]);
		document.getElementById("b").value = Visual.color.blue;
	}
	Visual.updateColor();
}

/**
 * Reads URL parameters to auto-load a song, apply design/loop/shuffle settings.
 */
function checkSong() {
	let obj = UrlParams.GetParams();
	if (Object.keys(obj).length > 0) {
		// Playlist param takes priority — loads full queue and starts playback
		if (obj["playlist"] !== undefined) {
			let plId = obj["playlist"];
			Playlist.load(plId, function () {
				if (Playlist.queue.length > 0) {
					UrlParams.SetParam("playlist", plId);
					Playlist.playAll();
				}
			});
		} else {
			let q = obj["song"];
			if (q) {
				let isSongId = !q.includes("/") && !q.includes(".") && !q.includes(window.location.hostname);
				if (isSongId) {
					AudioLibrary.currentSongId = q;
					let a = {
						"src": "assets/php/getSongById.php",
						"args": { "song_id": q }
					};
					Server.send(a, true, function (response) {
						let data = AudioLibrary.getValueFromServerResponse(response);
						try {
							if (typeof data === "string") data = JSON.parse(data);
						} catch (e) {}
						if (data && data.success === true && data.song) {
							let songArtist = data.song.artist || "";
							let songTitle = data.song.title || "";
							AudioLibrary.currentSongName = songArtist.length > 0 ? songArtist + " - " + songTitle : songTitle;
							AudioLibrary.currentSourceUrl = data.song.source_url || "";
							let streamUrl = data.song.stream_url || "";
							if (streamUrl.length > 0)
								player.play(streamUrl);
						}
					});
				} else {
					if (q.includes(window.location.hostname))
						q = q.replace(/[A-Za-z._/\-:]+Music/i, "");
					q = decodeURI(q);
					if (q.startsWith("/")) q = q.substring(1);
					if (q.endsWith("/")) q = q.substring(0, q.length - 1);
					let tmp = q.substring(q.length - 5);
					if (tmp.includes(".mp3") || tmp.includes(".m4a") || tmp.includes("mp4"))
						player.play(q);
					else
						AudioLibrary.selectSong(true);
				}
			}
		}

		if (obj["hideSongName"] !== undefined)
			document.getElementById("song-name").hidden = obj["hideSongName"] !== "false";

		if (obj["delay"] !== undefined)
			setTimeout(function () { player.play(undefined, true); }, parseFloat(obj["delay"]));

		if (obj["shuffle"] !== undefined) {
			let shuffleOpt = document.getElementById("shuffle-opt");
			if (shuffleOpt) {
				shuffleOpt.checked = true;
				document.getElementById("player").loop = false;
				// Only auto-select if no specific song was already loaded from URL
				// to avoid the race condition where shuffle overwrites the song name
				if (document.getElementById("player").paused && !obj["song"] && !obj["playlist"])
					AudioLibrary.selectSong(true);
			}
		}

		if (obj["loop"] !== undefined)
			document.getElementById("player").loop = obj["loop"] !== "false";

		if (obj["design"] !== undefined) {
			Visual.currentDesign = obj["design"];
			let designSelect = document.getElementById("design");
			if (designSelect) designSelect.value = obj["design"];
		}

		if (obj["fillPolygon"] !== undefined) {
			let val = obj["fillPolygon"] !== "false";
			Visual.fillPolygon = val;
			let el = document.getElementById("fillPolygonOption");
			if (el) el.checked = val;
		}

		if (obj["progressBar"] !== undefined) {
			let val = obj["progressBar"] !== "false";
			Visual.progressBarVisible = val;
			let el = document.getElementById("bar-toggle");
			if (el) el.checked = val;
		}

		if (obj["ghost"] !== undefined) {
			let val = obj["ghost"] !== "false";
			Visual.ghost = val;
			let el = document.getElementById("ghost");
			if (el) el.checked = val;
		}

		if (obj["fade"] !== undefined) {
			let val = obj["fade"] !== "false";
			let el = document.getElementById("fade");
			if (el) {
				el.checked = val;
				if (val) {
					colorStorage = { "r": Visual.color.red, "g": Visual.color.green, "b": Visual.color.blue };
					Visual.color.fade = true;
				}
			}
		}

		if (obj["newBg"] !== undefined) {
			let val = obj["newBg"] !== "false";
			let el = document.getElementById("new-bg-opt");
			if (el) el.checked = val;
			let mainBefore = document.getElementById("main-before");
			if (mainBefore) mainBefore.style.display = val ? "block" : "none";
		}

		if (obj["sphere"] !== undefined) {
			let val = obj["sphere"] !== "false";
			let el = document.getElementById("sphere");
			if (el) el.checked = val;
			let objElm = document.getElementById("obj");
			if (objElm) {
				objElm.style.display = val ? "block" : "none";
				setNewBGState(val);
			}
		}

		if (obj["lyrics"] !== undefined) {
			let val = obj["lyrics"] !== "false";
			Visual.lyricsEnabled = val;
			let el = document.getElementById("lyrics");
			if (el) el.checked = val;
			let caption = document.getElementById("caption");
			if (caption) caption.style.opacity = val ? 1 : 0;
		}

		if (obj["cbg"] !== undefined) {
			let val = obj["cbg"] !== "false";
			Visual.cbg = val;
			let el = document.getElementById("cbg");
			if (el) el.checked = val;
		}

		if (obj["hexColor"] !== undefined) {
			let el = document.getElementById("hex-color");
			if (el) {
				el.value = obj["hexColor"];
				setHexColors();
			}
		}

		if (obj["audioAccuracy"] !== undefined) {
			let val = parseInt(obj["audioAccuracy"], 10);
			if (val > 0) {
				let el = document.getElementById("audioAccuracy");
				if (el) el.value = val;
				Visual.updateAudioAccuracy(val);
			}
		}

		if (obj["hideBg"] !== undefined) {
			let val = obj["hideBg"] !== "false";
			let el = document.getElementById("bg-hide-opt");
			if (el) {
				el.checked = val;
				toggleBg(el);
			}
		}

		if (obj["autoplay"] !== undefined) {
			let isOBS = window.navigator.userAgent.indexOf("OBS/") !== -1;
			if (isOBS || window.navigator.userActivation.hasBeenActive)
				player.play(undefined, isOBS);
		}
	}
}

/**
 * Sets up click handlers on option span items and audio play listeners.
 */
function setupListeners() {
	setupAudioPlay();
	setupOptionListeners();
}

/**
 * Sets up the audio play event to save the song ID/URL to params.
 */
function setupAudioPlay() {
	if (document.getElementById("player")) {
		document.getElementById("player").addEventListener("play", function () {
			setSongHash();
		});
	}
}

/**
 * Saves the current song identifier to URL parameters.
 */
function setSongHash() {
	if (document.getElementById("player")) {
		// Don't store song param when a playlist is active — the playlist handles track state
		if (Playlist.currentPlaylist !== null) {
			UrlParams.removeParam("song");
			return;
		}
		if (typeof AudioLibrary.currentSongId === "string" && AudioLibrary.currentSongId.length > 0) {
			UrlParams.SetParam("song", AudioLibrary.currentSongId);
		} else {
			let elm = document.getElementById("player");
			let q = elm.src;
			q = encodeURI(decodeURI(q));
			UrlParams.SetParam("song", q);
		}
	}
}

/**
 * Starts the audio visualizer rendering.
 */
function startAudio() {
	let list = document.getElementsByTagName("canvas");
	if (list.length > 0) list[0].focus();
	Visual.render();
}

/**
 * Attaches all event listeners for option controls.
 */
function setupOptionListeners() {
	// Design dropdown
	let designElm = document.getElementById("design");
	if (designElm) {
		designElm.addEventListener("change", function () {
			Visual.updateDesign(this);
			UrlParams.SetParam("design", this.value);
			// Sync ModalOptions dropdown if built
			let optDesign = document.getElementById("opt-design");
			if (optDesign) optDesign.value = this.value;
			// Show/hide polygon sides row
			let sidesRow = document.getElementById("opt-sides-row");
			if (sidesRow) sidesRow.style.display = this.value === "polygon" ? "" : "none";
		});
	}

	// Fill polygon toggle
	let fillElm = document.getElementById("fillPolygonOption");
	if (fillElm) {
		fillElm.addEventListener("change", function () {
			Visual.fillPolygon = this.checked;
			UrlParams.SetParam("fillPolygon", String(this.checked));
		});
	}

	// Song name toggle
	let snElm = document.getElementById("sn");
	if (snElm) {
		snElm.addEventListener("change", function () {
			document.getElementById("song-name").hidden = !this.checked;
			UrlParams.SetParam("hideSongName", String(!this.checked));
		});
	}

	// Progress bar toggle
	let barElm = document.getElementById("bar-toggle");
	if (barElm) {
		barElm.addEventListener("change", function () {
			Visual.progressBarVisible = this.checked;
			UrlParams.SetParam("progressBar", String(this.checked));
		});
	}

	// Shuffle toggle
	let shuffleElm = document.getElementById("shuffle-opt");
	if (shuffleElm) {
		shuffleElm.addEventListener("change", function () {
			let audioElm = document.getElementById("player");
			if (this.checked) {
				audioElm.loop = false;
				UrlParams.SetParam("shuffle", "true");
				if (audioElm.paused) AudioLibrary.selectSong(true);
			} else {
				audioElm.loop = true;
				UrlParams.removeParam("shuffle");
			}
		});
	}

	// Ghost toggle
	let ghostElm = document.getElementById("ghost");
	if (ghostElm) {
		ghostElm.addEventListener("change", function () {
			Visual.ghost = this.checked;
			UrlParams.SetParam("ghost", String(this.checked));
		});
	}

	// Fades toggle
	let fadeElm = document.getElementById("fade");
	if (fadeElm) {
		fadeElm.addEventListener("change", function () {
			if (this.checked) {
				colorStorage = {
					"r": Visual.color.red,
					"g": Visual.color.green,
					"b": Visual.color.blue
				};
				Visual.color.fade = true;
			} else {
				Visual.color.fade = false;
				setTimeout(function () {
					Visual.color.red = colorStorage["r"];
					Visual.color.green = colorStorage["g"];
					Visual.color.blue = colorStorage["b"];
				}, 100);
			}
			UrlParams.SetParam("fade", String(this.checked));
		});
	}

	// New BG toggle
	let newBgElm = document.getElementById("new-bg-opt");
	if (newBgElm) {
		newBgElm.addEventListener("change", function () {
			if (document.getElementById("main-before"))
				document.getElementById("main-before").style.display = this.checked ? "block" : "none";
			UrlParams.SetParam("newBg", String(this.checked));
		});
	}

	// Sphere toggle
	let sphereElm = document.getElementById("sphere");
	if (sphereElm) {
		sphereElm.addEventListener("change", function () {
			if (document.getElementById("obj")) {
				let e = document.getElementById("obj");
				if (this.checked) {
					e.style.display = "block";
					setNewBGState(true);
				} else {
					e.style.display = "none";
					setNewBGState(false);
				}
			}
			UrlParams.SetParam("sphere", String(this.checked));
		});
	}

	// Lyrics toggle
	let lyricsElm = document.getElementById("lyrics");
	if (lyricsElm) {
		lyricsElm.addEventListener("change", function () {
			Visual.lyricsEnabled = this.checked;
			document.getElementById("caption").style.opacity = this.checked ? 1 : 0;
			UrlParams.SetParam("lyrics", String(this.checked));
		});
	}

	// Hex colors toggle
	let cbgElm = document.getElementById("cbg");
	if (cbgElm) {
		cbgElm.addEventListener("change", function () {
			Visual.cbg = this.checked;
			UrlParams.SetParam("cbg", String(this.checked));
		});
	}

	// Hex color picker
	let hexColorElm = document.getElementById("hex-color");
	if (hexColorElm) {
		hexColorElm.addEventListener("change", function () {
			setHexColors();
			UrlParams.SetParam("hexColor", this.value);
		});
		setTimeout(function () { setHexColors(); }, 0);
	}

	// Accuracy input
	let accuracyElm = document.getElementById("audioAccuracy");
	if (accuracyElm) {
		accuracyElm.addEventListener("keypress", function (event) {
			if (event.key === "Enter") {
				Visual.updateAudioAccuracy(this.value);
				UrlParams.SetParam("audioAccuracy", this.value);
			}
		});
	}

	// File upload (client-only)
	let uploadElm = document.getElementById("file-upload");
	if (uploadElm) {
		uploadElm.addEventListener("input", function () {
			player.uploadSong(this);
		});
	}

	// BG hide toggle (OBS)
	let bgHideElm = document.getElementById("bg-hide-opt");
	if (bgHideElm) {
		bgHideElm.addEventListener("click", function () {
			toggleBg(this);
			UrlParams.SetParam("hideBg", String(this.checked));
		});
	}

	// Theme toggle
	let themeElm = document.getElementById("theme-toggle");
	if (themeElm) {
		themeElm.addEventListener("change", function () {
			let theme = this.checked ? "light" : "dark";
			document.documentElement.setAttribute("data-theme", theme);
			localStorage.setItem("mp-theme", theme);
		});
	}

	// Color sliders
	let rElm = document.getElementById("r");
	let gElm = document.getElementById("g");
	let bElm = document.getElementById("b");
	let tooltip = document.getElementById("tooltip");

	if (rElm) {
		rElm.addEventListener("input", function () {
			Visual.setR(parseFloat(this.value));
		});
		rElm.addEventListener("mousemove", function (event) {
			tooltip.innerText = this.value;
			tooltip.style.opacity = 1;
			tooltip.style.top = event.clientY + "px";
			tooltip.style.left = (event.clientX + 10) + "px";
		});
		rElm.addEventListener("mouseout", function () {
			tooltip.style.opacity = 0;
		});
	}
	if (gElm) {
		gElm.addEventListener("input", function () {
			Visual.setG(parseFloat(this.value));
		});
		gElm.addEventListener("mousemove", function (event) {
			tooltip.innerText = this.value;
			tooltip.style.opacity = 1;
			tooltip.style.top = event.clientY + "px";
			tooltip.style.left = (event.clientX + 10) + "px";
		});
		gElm.addEventListener("mouseout", function () {
			tooltip.style.opacity = 0;
		});
	}
	if (bElm) {
		bElm.addEventListener("input", function () {
			Visual.setB(parseFloat(this.value));
		});
		bElm.addEventListener("mousemove", function (event) {
			tooltip.innerText = this.value;
			tooltip.style.opacity = 1;
			tooltip.style.top = event.clientY + "px";
			tooltip.style.left = (event.clientX + 10) + "px";
		});
		bElm.addEventListener("mouseout", function () {
			tooltip.style.opacity = 0;
		});
	}

	// Song list side panel tab - show on hover near right edge
	let menuElm = document.getElementById("menu-tab");
	let menuTrigger = document.getElementById("menu-trigger");
	if (menuElm) {
		menuElm.addEventListener("click", function () {
			Modal.open("songs");
		});
	}
	if (menuTrigger && menuElm) {
		let hideTimer = null;
		let showMenu = function () {
			if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
			menuElm.classList.add("visible");
		};
		let hideMenu = function () {
			hideTimer = setTimeout(function () {
				menuElm.classList.remove("visible");
			}, 400);
		};
		menuTrigger.addEventListener("mouseenter", showMenu);
		menuTrigger.addEventListener("mouseleave", hideMenu);
		menuElm.addEventListener("mouseenter", showMenu);
		menuElm.addEventListener("mouseleave", hideMenu);
	}

	// Left panel (auth + settings) - show on hover near left edge
	let leftPanel = document.getElementById("left-panel");
	let leftTrigger = document.getElementById("left-panel-trigger");
	if (leftTrigger && leftPanel) {
		let leftHideTimer = null;
		let showLeft = function () {
			if (leftHideTimer) { clearTimeout(leftHideTimer); leftHideTimer = null; }
			leftPanel.classList.add("visible");
		};
		let hideLeft = function () {
			leftHideTimer = setTimeout(function () {
				leftPanel.classList.remove("visible");
			}, 400);
		};
		leftTrigger.addEventListener("mouseenter", showLeft);
		leftTrigger.addEventListener("mouseleave", hideLeft);
		leftPanel.addEventListener("mouseenter", showLeft);
		leftPanel.addEventListener("mouseleave", hideLeft);
	}

	// Auth buttons
	let authContainer = document.getElementById("auth-buttons");
	if (authContainer) {
		ModalAuth.updateAuthButtons();
	}
}

/**
 * Parses the hex color input and updates the background hex color override.
 */
function setHexColors() {
	let str = document.getElementById("hex-color").value;
	str = str.substring(1);
	let r = str.substr(0, 2);
	let g = str.substr(2, 2);
	let b = str.substr(4, 2);
	let a = "32";
	if (str.length > 6) a = str.substr(6, 2);
	Visual.cbg_ovr = {
		"r": hexToDec(r),
		"g": hexToDec(g),
		"b": hexToDec(b),
		"a": hexToDec(a)
	};
	Visual.updateColor();
}

/**
 * Converts a hex string to a decimal number.
 * @param {string} q - The hex string.
 * @returns {number}
 */
function hexToDec(q = false) {
	let res = 0;
	if (typeof q === "string")
		res = parseInt(q, 16);
	return res;
}

/**
 * Toggles the background visibility (for OBS mode).
 * @param {HTMLInputElement} elm - The checkbox element.
 */
function toggleBg(elm = false) {
	if (elm !== false) {
		let d = document.querySelector("html, body, .bg, .bg-000, .display, .display-000, .main-container");
		if (elm.checked) {
			d.style = "box-shadow:unset !important;background:transparent !important;background-color:transparent !important;";
			let mc = document.querySelector(".main-container");
			if (mc) mc.hidden = true;
		} else {
			d.style = "";
			let mc = document.querySelector(".main-container");
			if (mc) mc.hidden = false;
		}
	}
}

/**
 * Loads the user's custom background from the database.
 * If found, applies it to .main-container#bg.
 * If not found and in OBS, sets the page transparent.
 */
function loadUserBackground() {
	let img = new Image();
	img.onload = function () {
		let bg = document.getElementById("bg");
		if (bg) {
			bg.style.backgroundImage = "url('assets/php/getBackgroundPicture.php?t=" + Date.now() + "')";
			bg.style.backgroundSize = "cover";
			bg.style.backgroundPosition = "center";
		}
	};
	img.onerror = function () {
		// No background in database — OBS gets transparent
		let isOBS = window.navigator.userAgent.indexOf("OBS/") !== -1;
		if (isOBS) {
			document.getElementById("bg-hide-opt").checked = true;
			toggleBg(document.getElementById("bg-hide-opt"));
		}
	};
	img.src = "assets/php/getBackgroundPicture.php?t=" + Date.now();
}

/**
 * Applies the saved theme from localStorage.
 */
function applyThemeFromStorage() {
	let saved = localStorage.getItem("mp-theme");
	if (saved === "light") {
		document.documentElement.setAttribute("data-theme", "light");
		let toggle = document.getElementById("theme-toggle");
		if (toggle) toggle.checked = true;
	}
}

// Update render display on load
Visual.updateRenderDisplay();

// Initialize the app
ini();
