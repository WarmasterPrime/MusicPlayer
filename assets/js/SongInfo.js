
class SongInfo {
    
    /**
     * Returns the name of the song.
     */
    get name() {
        return this.songName;
    }
    /**
     * Returns the artist of the song.
     */
    get artist() {
        return this.songArtist;
    }
    /**
     * Returns the size of the data size of the song file.
     */
    get size() {
        return this.songFile.size;
    }
    /**
     * Returns the duration of the song.
     */
    get duration() {
        return this.songFile.duration;
    }
    
    /**
     * Creates a new structured object that stores the song information.
     * @param {string} songName The name of the song.
     * @param {string} songArtist The artist of the song.
     * @param {string|File|HTMLAudioElement} songFileOrElement The file object of the song.
     */
    constructor(songName, songArtist, songFileOrElement) {
        this.songName=songName;
        this.songArtist=songArtist;
        this.element;
        
        if(songFileOrElement!==undefined) {
            if(typeof songFileOrElement === "string") {
                SongInfo.getDataFromUrl(songFileOrElement, this.#updateSongFileData);
                this.element=document.createElement("audio");
                this.element.src=songFileOrElement;
                let meInstance=this;
                this.element.onload=function(ev) {
                    meInstance.#updateSongFileDataAlternative();
                };
            }
            else if(songFileOrElement instanceof File)
                this.songFile=songFileOrElement;
            else if(songFileOrElement instanceof HTMLAudioElement) {
                this.element=songFileOrElement;
                SongInfo.getDataFromElement(songFileOrElement);
            }
            if(this.element instanceof HTMLAudioElement) {
                if(this.element.readyState>3)
                    meInstance.#updateSongFileDataAlternative();
                else
                    this.element.load();
            }
        }
    }
    /**
     * The alternative operation that updates the song information that is not related to the raw data of the audio file.
     */
    #updateSongFileDataAlternative() {
        this.songFile.duration=this.element.duration;
    }
    /**
     * Updates the information for the songFile property.
     * @param {object} songInfoData The JSON object containing the song information.
     */
    #updateSongFileData(songInfoData) {
        this.songFile=songInfoData;
    }
    /**
     * Gets the audio data from the HTMLAudioElement object.
     * @param {HTMLAudioElement} audioElement The HTML audio element.
     * @param {Function} callBackFunction The call back function.
     */
    static getDataFromElement(audioElement, callBackFunction=undefined) {
        if(audioElement instanceof HTMLAudioElement)
            SongInfo.getDataFromUrl(SongInfo.getAudioSource(audioElement), callBackFunction);
    }
    /**
     * Gets the url from the audio element.
     * @param {HTMLAudioElement} audioElement The HTMLAudioElement object.
     * @returns {string|undefined}
     */
    static getAudioSource(audioElement) {
        return audioElement instanceof HTMLAudioElement ? audioElement.currentSrc : undefined;
    }
    /**
     * Asynchronously gets the audio file data and invokes the callback function with the information object.
     * @param {string} url The url of the audio file.
     * @param {Function} callBackFunction The call back function.
     */
    static getDataFromUrl(url, callBackFunction=undefined) {
        if(typeof url === "string") {
            let tmp=fetch(url).then(response => {
                const fileSizeFromHeaders=response.headers.get("Content-Length");
                const blob=response.blob();
                return Promise.all([blob, fileSizeFromHeaders]);
            }).then(([blob, fileSizeFromHeaders]) => {
                const fileSize=fileSizeFromHeaders ? parseInt(fileSizeFromHeaders) : blob.size;
                let res={
                    size:fileSize,
                    blob:blob
                };
                return Promise.all([res]);
            }).catch(error => {
                console.error("Failed to fetch audio data from the given URL \"" + url.toString() + "\".\n\n", error);
            });
            tmp.then(q=>{
                if(callBackFunction!==undefined && callBackFunction instanceof Function)
                    callBackFunction.call(this, q[0]);
            });
        }
    }
    /**
     * Gets the file name of the url.
     * @param {string} url The url of the file.
     * @returns {string}
     */
    static getFileName(url) {
        let obj=new URL(url, url.startsWith("http") ? undefined : window.location.protocol + "//" + window.location.hostname);
        const pattern=/\/(?<fileName>[^/]+)(\.[^S\z]+)($|\z)/gm;
        //console.log(pattern.exec(decodeURI(obj.pathname)).groups.fileName);
        //console.log(pattern.exec(decodeURI(obj.pathname)).groups.fileName);
        let res=pattern.exec(decodeURI(obj.pathname));
        //console.log(res);
        if(res!==undefined && res!==null && Object.keys(res).includes("groups"))
            return res.groups!==undefined ? res.groups.fileName : url;
        return url;
    }
    
    static getSongNameParts(url) {
        //console.log(SongInfo.getFileName(url).split("-"));
        return SongInfo.getFileName(url).split("-");
    }
    
    static getSongName(url) {
        let ins=SongInfo.getSongNameParts(url);
        if(ins.length>1) {
            let tmp=ins[1].trimStart().trimEnd();
            let pattern=/[^A-z\d\.\s]+/gm;
            //console.log((tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd());
            return (tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd();
        }
        return ins;
    }
    
    static getArtist(url) {
        let ins=SongInfo.getSongNameParts(url);
        if(ins.length>1) {
            let tmp=ins[0].trimStart().trimEnd();
            let pattern=/[^A-z\d\.\s]+/gm;
            //console.log((tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd());
            return (tmp.match(pattern) ? tmp.replace(pattern, "") : tmp).trimStart().trimEnd();
            //return SongInfo.getSongNameParts(url)[0].trimStart().trimEnd();
        }
        return ins;
    }
    
}
