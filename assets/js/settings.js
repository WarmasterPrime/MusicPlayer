
class Settings
{
	constructor()
	{
		this._showSongName=true;
		this._showBar=true;
		this._shuffle=false;
		this._ghost=false;
		this._fades=false;
		this._newBg=true;
		this._sphere=true;
		this._showHexColors=true;
		this._hexColor="#000000";
	}
	
	get ShowSongName()
	{
		return this._showSongName;
	}
	
	set ShowSongName(value)
	{
		if(typeof value === "boolean")
			this._showSongName=value;
	}
	
	get ShowBar()
	{
		return this._showBar;
	}
	
	set ShowBar(value)
	{
		if(typeof value === "boolean")
			this._showBar=value;
	}
	
	get Shuffle()
	{
		return this._shuffle;
	}
	
	set Shuffle(value)
	{
		if(typeof value === "boolean")
			this._shuffle=value;
	}
	
	get Ghost()
	{
		return this._ghost;
	}
	
	set Ghost(value)
	{
		if(typeof value === "boolean")
			this._ghost=value;
	}
	
	get Fades()
	{
		return this._fades;
	}
	
	set Fades(value)
	{
		if(typeof value === "boolean")
			this._fades=value;
	}
	
	get NewBg()
	{
		return this._newBg;
	}
	
	set NewBg(value)
	{
		if(typeof value === "boolean")
			this._newBg=value;
	}
	
	get Sphere()
	{
		return this._sphere;
	}
	
	set Sphere(value)
	{
		if(typeof value === "boolean")
			this._sphere=value;
	}
	
	get ShowHexColors()
	{
		return this._showHexColors;
	}
	
	set ShowHexColors(value)
	{
		if(typeof value === "boolean")
			this._showHexColors;
	}
	
	get HexColor()
	{
		return this._hexColor;
	}
	
	set HexColor(value)
	{
		if(typeof value === "string")
			this._hexColor=value;
	}
	
	
}

