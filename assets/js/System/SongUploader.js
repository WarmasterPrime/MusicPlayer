

class SongUploader {
	
	
	get onprogress() {
		return this._onprogress;
	}
	
	set onprogress(value) {
		if(value instanceof Function)
			this._onprogress=value;
	}
	
	get onresponse() {
		return this._onresponse;
	}
	
	set onresponse(value) {
		if(value instanceof Function)
			this._onresponse=value;
	}
	
	
	constructor(songName, songArtist, file) {
		this.file=file;
		this.songName=songName;
		this.songArtist=songArtist;
		this._onprogress;
		this._onresponse;
	}
	
	
	upload() {
		const ins=new XMLHttpRequest();
		//const meInstance=this;
		//ins.onprogress=function(event) {
		//	if(meInstance.onprogress!==undefined)
		//		meInstance.onprogress.call(this, event);
		//};
		ins.onload=function(event) {
			if(meInstance.onresponse)
				meInstance.onresponse.call(this, event, this.responseText);
		};
		const formData=new FormData();
		formData.append("file", this.file);
		formData.append("songName", this.songName);
		formData.append("songArtist", this.songArtist);
		ins.upload.addEventListener("progress", (event)=>{
			if(meInstance.onprogress!==undefined)
				meInstance.onprogress.call(meInstance, event);
		});
		ins.open("POST", "assets/php/songUpload.php", true);
		ins.send(formData);
	}
	
	
	
	
}

