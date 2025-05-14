

class Player {
	
	/**
	 * Gets the volume as a percentage.
	 */
	get volume() {
		return this.element.volume * 100;
	}
	/**
	 * Sets the volume level as a percentage.
	 */
	set volume(value) {
		if(typeof(value)==="number" && value>=0 && value<=100)
			this.element.volume=value/100;
	}
	/**
	 * Gets the current time position the playhead is at within the song.
	 */
	get currentTime() {
		return this.element.currentTime*1000;
	}
	/**
	 * Gets the duration of the song in milliseconds.
	 */
	get duration() {
		return this.element.duration*1000;
	}
	/**
	 * Sets the current time position the playhead should move to within the song.
	 */
	set currentTime(value) {
		value/=1000;
		if(value<0)
			value=0;
		if(value>this.duration)
			value=this.duration;
		if(typeof(value)==="number")
			this.element.currentTime=value;
	}
	/**
	 * Gets the currently active audio source as a string.
	 */
	get source() {
		return this.element.currentSrc;
	}
	/**
	 * Sets the audio source.
	 */
	set source(value) {
		if(typeof(value)==="string") {
			this.element.src=value;
			this.songName=Player.getSongName(value);
			this.songArtist=Player.getSongArtist(value);
			this.getSongLyrics(this.songName, this.songArtist);
		}
	}
	/**
	 * Returns a boolean value indicating if the audio is currently playing.
	 */
	get isPlaying() {
		return this._isPlaying;
	}
	/**
	 * Returns a boolean value indicating if the audio can be played without interruptions.
	 */
	get canPlayThrough() {
		return this._canPlayThrough;
	}
	/**
	 * Returns a string representation of the name of the song.
	 */
	get songName() {
		return this._songName;
	}
	/**
	 * Sets the name of the song being played.
	 */
	set songName(value) {
		this._songName=value;
		this.display=this.songArtist + " - " + this.songName;
	}
	/**
	 * Returns a string representation of the artist of the song.
	 */
	get songArtist() {
		return this._songArtist;
	}
	/**
	 * Sets the artist of the song.
	 */
	set songArtist(value) {
		this._songArtist=value;
		this.display=this.songArtist + " - " + this.songName;
	}
	/**
	 * Returns a string representation of the song name and song artist that is displayed on the song title element.
	 */
	get display() {
		return this.songNameElement.innerText;
	}
	/**
	 * Sets the textual content to be displayed on song title element.
	 */
	set display(value) {
		this.songNameElement.innerText=value;
	}
	/**
	 * Returns a boolean value representing if the browser received a user interaction event (Check if both the user activation is active OR if it has been activated).
	 */
	get userActivation() {
		return window.navigator.userActivation.isActive || window.navigator.userActivation.hasBeenActive;
	}
	
	/**
	 * Creates a new instance of the player controller.
	 * @param {HTMLAudioElement} playerElement The audio element.
	 * @param {HTMLDivElement} captionElement The div element that displays the captions/subtitles.
	 * @param {HTMLDivElement} progressBarElement The div element that indicates the player's current position in the song.
	 */
	constructor(playerElement, captionElement, progressBarElement, songNameElm) {
		this.element=playerElement;
		this.captionElement=captionElement;
		this.progressBarElement=progressBarElement;
		this.songNameElement=songNameElm;
		this.lyrics={};
		this.lyricsEnabled=true;
		this.currentSong=null;
		this._songName=null;
		this._songArtist=null;
		this._isPlaying=false;
		let meInstance=this;
		this._canPlayThrough=false;
		this.element.oncanplaythrough=function(){
			meInstance._canPlayThrough=true;
		};
		this.element.onloadstart=function(){
			meInstance._canPlayThrough=false;
		};
		this.processingPlayRequest=false;
		let bodyElement = document.querySelector("body");
		bodyElement.addEventListener("mousedown", function(event) {
			setTimeout(function(){Player.mouseActionProcess(event, meInstance);},250);
		});
		bodyElement.addEventListener("keydown", function(event) {
			if(event.code==="ArrowRight")
				meInstance.currentTime=meInstance.currentTime + 3000;
			else if(event.code==="ArrowLeft")
				meInstance.currentTime=meInstance.currentTime - 3000;
			else if (event.code==="Space")
			{
				if (!meInstance.isPlaying)
				{
					meInstance.play(meInstance.source);
					setTimeout(function(){meInstance.updateHead();},0);
					Visual.render();
				}
				else
					meInstance.pause();
			}
			else if(event.code==="ArrowUp")
				meInstance.volume+=1;
			else if(event.code=="ArrowDown")
				meInstance.volume-=1;
		});
	}
	
	static mouseActionProcess(event, instance) {
		if(event.buttons===8 || event.buttons===16) {
			let urlParams=UrlParams.GetParams();
			let songUrl=urlParams["song"];
			if(songUrl!==undefined) {
				instance.play(UrlParams.separate(window.location.protocol + "//" + window.location.hostname + "/files/Music/", songUrl));
			}
		}
	}
	
	/**
	 * Sets the display state of the progressbar element (If it should be shown or hidden).
	 * @param {boolean} state A boolean representing the state of the progressbar element display.
	 */
	#updateVisualOfProgressBar(state=false) {
		this.progressBarElement.hidden=state;
	}
	/**
	 * Updates the playhead indicator's (AKA progressbar) position in the song relative to the width of the page.
	 * @param {boolean} override (Default: false) A boolean representing if it should override the "isPlaying" property of this class.
	 */
	updateHead(override=false) {
		//console.log(this.isPlaying);
		if(this.isPlaying || override) {
			//console.log("PASSED");
			let start=this.currentTime;
			let end=this.duration;
			let stat=(start/end) * window.innerWidth;
			this.progressBarElement.style.width=stat+"px";
			//let stat=((start/end)*100);
			//this.progressBarElement.style.width=stat+"%";
			let meInstance=this;
			if(stat>window.innerWidth) {
				this.progressBarElement.style.transitionDuration="0.5s";
				this.progressBarElement.style.WebKitTransitionDuration="0.5s";
				setTimeout(function(){
					meInstance.progressBarElement.style.transitionDuration="0.0s";
					meInstance.progressBarElement.style.WebKitTransitionDuration="0.0s";
				},500);
			}
			setTimeout(function(){meInstance.updateHead();},1);
		}
	}
	/**
	 * Gets the audio data, audio information, or directory contents
	 * @param {string} query The string representation of the url or file path (On the server).
	 */
	select(query) {
		audioLib.select(query);
	}
	/**
	 * Selects a random song from the server (Excludes the currently active song).
	 */
	selectSong() {
		audioLib.selectSong();
	}
	/**
	 * Sets the URL/source of the song to play.
	 * @param {*} source 
	 */
	setSource(source) {
		this.source=source;
	}
	
	static getValueFromServerResponse(value) {
		return audioLib.notNull(ServerResponse) && value instanceof ServerResponse ? value.value : value;
	}
	/**
	 * Plays the song.
	 */
	play(source=undefined, overrideUserActivation=false) {
		source=Player.getValueFromServerResponse(source);
		this.display=this.songName + " - " + this.songArtist;
		this.processingPlayRequest=true;
		let iniTmp=window.location.protocol + "//" + window.location.hostname + "/files/Music/";
		let tmpSource=source.startsWith(iniTmp) ? source : UrlParams.combine(iniTmp, source);
		if(source!==undefined && tmpSource!==this.source)
			this.source=tmpSource;
		if(this.userActivation===true || overrideUserActivation===true) {
			if(this.canPlayThrough) {
				let meInstance=this;
				this.element.play();
				this._isPlaying=true;
				this.processingPlayRequest=false;
			} else {
				let ins=this;
				setTimeout(function(){ins.play(source);},500);
			}
		} else {
			this.display="CLICK HERE TO PLAY \"" + this.songName + "\"";
			let meIns=this;
			let elm=document.querySelector("body");
			let func=function(){
				elm.removeEventListener("click", func);
				setTimeout(function(){meIns.play(source);},10);
			};
			elm.addEventListener("click", func);
		}
	}
	/**
	 * Pauses the song.
	 */
	pause() {
		if(this._isPlaying)
			this.element.pause();
		this._isPlaying=false;
	}
	/**
	 * Seeks the audio by a specified value.
	 * @param {Number} value The seek value.
	 */
	seek(value) {
		this.currentTime+=value;
		this.updateHead(true);
	}
	/**
	 * Obtains the song lyrics from the database and loads them into this object.
	 * @param {string} songName The name of the song.
	 * @param {string} artist The artist of the song.
	 */
	getSongLyrics(songName, artist) {
		let a={
			"src":"assets/php/getSongLyrics.php",
			"args":{
				"songName":songName,
				"artist":artist
			}
		};
		let meInstance=this;
		Server.send(a, true, {"class":meInstance, "method":"loadLyrics"});
		//{"class":meInstance, "method":"loadLyrics"}
	}
	/**
	 * Displays the lyrics of the song (If the lyrics JSON file exists).
	 */
	playLyrics() {
		if(this.lyricsEnabled) {
			let time=Math.floor(this.currentTime);
			this.displayLyrics(time);
		}
		//setTimeout(function(){Visual.playLyrics();}, 50);
	}
	/**
	 * Loads the song lyrics into memory.
	 * @param {object} songLyricsObject The data object containing the song lyrics.
	 */
	loadLyrics(songLyricsObject) {
		let obj=Player.parseJson(songLyricsObject);
		let tmp=new Lyrics(obj);
		//console.log(this);
		this.lyrics=tmp;
	}
	/**
	 * Parses the parameter value to a JSON object.
	 * @param {*} value Expected to be a string representation of a JSON object.
	 * @returns {object}
	 */
	static parseJson(value) {
		try {
			return JSON.parse(value);
		} catch {
			if(value instanceof ServerResponse)
				return value.value;
			return value;
		}
	}
	/**
	 * Gets the current lyric set for the current time of the song.
	 * @param {Number|int|float} currentTime The current time position in the song.
	 * @returns {string|undefined}
	 */
	getCurrentLyrics(currentTime) {
		return this.lyrics!==undefined && Object.keys(this.lyrics).length>0 ? this.lyrics.getAtTime(currentTime.toString()) : "";
	}
	/**
	 * Displays the current lyrics based on the current time position in the song.
	 * @param {Number|int|float} currentTime The current time position in the song.
	 */
	displayLyrics(currentTime) {
		let text=this.getCurrentLyrics(currentTime);
		if(text!==undefined && text!=="]")
			this.setCaption(text);
	}
	/**
	 * 
	 * @param {HTMLInputElement} fileUploadElement The input element that stores the file.
	 */
	uploadSong(fileUploadElement) {
		let files=fileUploadElement.files;
		console.log(files);
		if(files.length>0 && files[0]) {
			let file=files[0];
			const url=window.URL || window.webkitURL;
			let fileUrl=url.createObjectURL(file);
			this.source=fileUrl;
			this.songName=Player.getSongName(file.name);
			this.songArtist=Player.getSongArtist(file.name);
			if(this.songName===this.songArtist)
				this.display=this.songName;
			this.play();
		}
	}
	/**
	 * Uploads and saves the song to the database.
	 * @param {File} file The file object to upload.
	 */
	saveSong(songName, songArtist, file) {
		//if(file instanceof File && typeof(songName)==="string" && typeof(songArtist)==="string") {
		//	const ins=new XMLHttpRequest();
		//	ins.onprogress=function(event) {
				
		//	};
		//}
	}
	
	static processSongLyrics(data) {
		console.log(data);
	}
	
	setCaption(textValue="") {
		this.captionElement.innerText=textValue;
	}
	
	static getName(q=false) {
		if (q!==false)
			q=q.match(/[\/]([^\/]+)\.(mp3|m4a|mp4|mov)/)[1];
		return q;
	}
	
	static getSongName(source) {
		return SongInfo.getSongName(source);
	}
	
	static getSongArtist(source) {
		return SongInfo.getArtist(source);
	}
	
	static installAssets() {
		if(!Player.assetsExist()) {
			
		}
	}
	
	static #installAsset(name, url) {
		let elm=document.createElement("script");
		elm.src=url;
		elm.name=name;
		
	}
	/**
	 * Determines if the assets exist.
	 * @returns {boolean}
	 */
	static assetsExist() {
		return typeof(Json)!==undefined;
	}
	
}
