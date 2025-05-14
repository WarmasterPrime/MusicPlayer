
class UrlParams
{
	
	static GetParams()
	{
		let url=decodeURI(window.location.hash.substring(1));
		if(url.includes("&"))
		{
			let parts=url.split("&");
			let res={};
			for(let i=0;i<parts.length;i++)
			{
				if(parts[i].includes("="))
				{
					let tmp=parts[i].split("=");
					res[tmp[0]]=tmp[1];
				}
			}
			return res;
		}
		else if(url.includes("="))
		{
			let tmp={};
			let t=url.split("=");
			tmp[t[0]]=t[1];
			return tmp;
		}
		return {};
	}
	/**
	 * 
	 * @param {string} a 
	 * @param {string} b 
	 */
	static combine(a, b) {
		if(a.endsWith("/"))
			a=a.substring(0, a.length-1);
		if(b.startsWith("/"))
			b=b.substring(1);
		return a + "/" + b;
	}
	
	static separate(a, b) {
		if(a.endsWith("/"))
			a=a.substring(0, a.length-1);
		if(b.startsWith("/"))
			b=b.substring(1);
		return b.startsWith(a) ? b.substring(a.length) : b;
	}
	
	static SetParam(key, value)
	{
		if(typeof key === "string" && typeof value === "string")
		{
			let params=UrlParams.GetParams();
			params[key]=value;
			UrlParams.updateParams(params);
		}
		else
		{
			console.warn(typeof key);
			console.warn(typeof value);
		}
	}
	/**
	 * Removes a parameter from the URL.
	 * @param {string} paramName The name of the parameter.
	 */
	static removeParam(paramName) {
		let res={};
		let item,value;
		for([item,value] of Object.entries(UrlParams.GetParams()))
			if(item!==paramName)
				res[item]=value;
		UrlParams.UpdateParams(res);
	}
	
	static updateParams(params)
	{
		//console.log(params);
		//console.log(visual.UpdateParams.caller);
		let item,value,buffer="";
		for([item,value] of Object.entries(params))
			buffer+=(buffer.length>0 ? "&" : "") + item + "="+value;
		window.location.hash=encodeURI(buffer);
	}
	
}
