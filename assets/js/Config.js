
class Config {
	
	get items() {
		return UrlParams.GetParams();
	}
	
	get songUrl() {
		return this.items["song"];
	}
	set songUrl(value) {
		if(typeof(value)==="string")
			UrlParams.SetParam("song", value);
	}
	
	get r() {
		return this.items["r"];
	}
	set r(value) {
		let type=typeof value;
		if(type==="string" || type==="number")
			UrlParams.SetParam("r");
	}
	
	get g() {
		return this.items["g"];
	}
	set g(value) {
		let type=typeof value;
		if(type==="string" || type==="number")
			UrlParams.SetParam("g");
	}
	
	get b() {
		return this.items["b"];
	}
	set b(value) {
		let type=typeof value;
		if(type==="string" || type==="number")
			UrlParams.SetParam("b");
	}
	
	get design() {
		return this.items["design"];
	}
	set design(value) {
		if(typeof(value)==="string")
			UrlParams.SetParam("design", value);
	}
	
	
	
	
	constructor() {
		
	}
	
	add(key, value) {
		if(typeof(key)==="string") {
			UrlParams.SetParam(key, value);
		} else
			Config.error("Key must be a string value.");
	}
	
	static error(message) {
		const timestamp=new Date().stringify();
		console.groupCollapsed("(" + timestamp + ") ERROR");
		console.table([
			{Key: "Timestamp", Value: timestamp},
			{Key: "Type", Value: "Exception"},
			{Key: "Message", Value: message},
			{Key: "Stack Trace", Value: console.trace()}
		])
		console.groupEnd();
	}
	
	
	
}
