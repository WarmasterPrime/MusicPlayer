
var viz={};
var GV_Ran=false;
/**
 * Controls the visualization of the audio visualizer and performs rendering operations.
 */
class Visual {
	
	static last_measurement=0;
	static base_speed=60;
	static paused=true;
	static ghost=false;
	static cbg=true;
	static lyricsEnabled=true;
	static audioAccuracy=512;
	static xOffset=-1;
	static progBarElm;
	/**
	* The background color configuration object.
	**/
	static cbg_ovr={
		"r":255,
		"g":0,
		"b":100,
		"a":0.5
	};
	/**
	* Determines the current polygonal generation design to produce for the audio visualizer.
	**/
	static currentDesign="bar";
	/**
	* Determines if the polygonal shape generated (based on the audio visualizer) should be filled in with a color or not.
	* Enabling this will add additional points to complete the polygonal shape from the end point to the starting point.
	**/
	static fillPolygon=true;
	
	/**
	 * Creates a new instance of the Visualizer class.
	 * @param {HTMLDivElement} q The HTMLDivElement object that will operate as the container for the HTMLCanvasElement.
	 */
	constructor(q=false) {
		console.log("New object created");
		this.id=q.id;
		this.elm=document.createElement("canvas");
		this.elm.id="visualizer";
		this.ctx=false;
		this.src=false;
		this.ana=false;
		this.bufferLength=0;
		this.dataArray=false;
		this.actx=false;
		this.ran=0;
		/**
		* The bar color configuration object.
		**/
		this.bar={
			"width":0,
			"height":1,
			"color":{
				"r":250,
				"g":50,
				"b":25,
				"a":1
			}
		};
		this.actx=new AudioContext();
		this.src=this.actx.createMediaElementSource(this.audio);
		this.ana=this.actx.createAnalyser();
		this.elm.width=this.width;
		this.elm.height=this.height;
		this.ctx=this.elm.getContext("2d");
		this.src.connect(this.ana);
		this.ana.connect(this.actx.destination);
		this.ana.fftSize=Visual.audioAccuracy;
		this.bufferLength=this.ana.frequencyBinCount;
		this.dataArray=new Float32Array(this.bufferLength);
		this.bar.width=(this.width/this.bufferLength)*2.5;
		this.bar.height=0;
		
		Visual.color.red=document.getElementById("r").value;
		Visual.color.green=document.getElementById("g").value;
		Visual.color.blue=document.getElementById("b").value;
		Visual.updateColor();
		
	}
	
	/**
	 * Initializes this class object.
	 */
	static ini()
	{
		this.progBarElm = document.getElementById("head");
		//Visual.AcceptUrlParams();
		viz.elm=document.getElementById("visualizer");
		viz.ctx=viz.elm.getContext("2d");
		let www=-0.5;
		let hhh=21.5;
		hhh=65;
		viz.elm.width=window.innerWidth-www;
		viz.elm.height=window.innerHeight-hhh;
		viz.width=window.innerWidth-www;
		viz.height=window.innerHeight-hhh;
		delete(www,hhh);
		viz.actx=new AudioContext();
		viz.src=viz.actx.createMediaElementSource(document.getElementById("player"));
		viz.ana=viz.actx.createAnalyser();
		viz.src.connect(viz.ana);
		viz.ana.connect(viz.actx.destination);
		viz.ana.fftSize=Visual.audioAccuracy;
		viz.bufferLength=viz.ana.frequencyBinCount;
		
		//viz.audioBuffer = new AudioBuffer();
		
		viz.dataArray=new Float32Array(viz.bufferLength);
		
		
		viz.bar={
			"width":1,
			"height":viz.height,
			"color":{
				"r":Visual.color.red,
				"g":Visual.color.green,
				"b":Visual.color.blue,
				"a":1
			}
		};
		viz.bar.maxHeight=Visual.getMaxHeight();
		viz.bar.width=(window.innerWidth/(viz.bufferLength*2));
		viz.id=viz.elm.id;
		window.addEventListener("resize",function(){
			//viz.elm=document.getElementById("visualizer");
			//viz.ctx=viz.elm.getContext("2d");
			Visual.updateRenderDisplay();
		});
	}
	
	/**
	 * Gets the audio element.
	 */
	get audio() {
		return document.getElementById(this.id);
	}
	/**
	 * Gets the width of the window.
	 */
	static get width() {
		return window.innerWidth;
	}
	/**
	 * Gets the height of the window.
	 */
	static get height() {
		return window.innerHeight;
	}
	
	static updateAudioAccuracy(value) {
		value=Math.floor(parseFloat(value));
		if(value>=32 && value<=32768 && value % 2===0 && Visual.isPow2(value)) {
			Visual.audioAccuracy=value;
			viz.ana.fftSize=Visual.audioAccuracy;
			viz.bufferLength=viz.ana.frequencyBinCount;
			viz.dataArray=new Float32Array(viz.bufferLength);
		}
	}
	
	static isPow2(n) {
		if (n <= 0) return false;
		return (n & (n - 1)) === 0;
	}
	
	static color={
		color:new Color(250, 0, 50),
		"red":2.55,
		"green":0,
		"blue":1.0,
		"fade":false,
		"fades":{
			"r":true,
			"g":false,
			"b":false,
			"start":false,
			"state":0,
			"inc":0.01,
			"max":3,
			"gmax":0,
			"bmax":0,
			"rmax":0
		},
		"saved":{
			"r":2,
			"g":0,
			"b":0.55
		}
	};
	
	static fullTranscript="";
	
	static lyrics={};
	
	static captionElm=document.getElementById("caption");
	
	static transcribe(ct) {
		Visual.fullTranscript+=ct;
		if(ct.isEndpoint)
			Visual.fullTranscript+="\n";
	}
	
	setup() {
		this.elm=document.getElementById("visualizer");
		this.ctx=false;
		this.src=false;
		this.ana=false;
		this.bufferLength=0;
		this.dataArray=false;
		this.actx=false;
		this.ran=0;
		this.bar={
			"width":0,
			"height":1,
			"color":{
				"r":250,
				"g":50,
				"b":25,
				"a":1
			}
		};
		this.actx=new AudioContext();
		this.src=this.actx.createMediaElementSource(this.audio);
		this.ana=this.actx.createAnalyser();
		this.elm.width=this.width;
		this.elm.height=this.height;
		this.ctx=this.elm.getContext("2d");
		this.src.connect(this.ana);
		this.ana.connect(this.actx.destination);
		
		this.ana.fftSize=Visual.audioAccuracy;
		this.bufferLength=this.ana.frequencyBinCount;
		
		this.dataArray=new Float32Array(this.bufferLength);
		
		this.bar.width=((this.width/this.bufferLength)*2.5);
		this.bar.height=0;
		this.bar.maxHeight=Visual.getMaxHeight();
		this.paused=false;
	}
	
	static getMaxHeight() {
		let res=(window.innerHeight*2.5)-100;
		return res;
	}
	
	static setR(q=false) {
		Visual.color.red=q / 100;
		Visual.updateColor();
	}
	static setG(q=false) {
		Visual.color.green=q / 100;
		Visual.updateColor();
	}
	static setB(q=false) {
		Visual.color.blue=q / 100;
		Visual.updateColor();
	}
	
	static initialLoad=0;
	/**
	 * Updates the color preview panel.
	 */
	static updateColorPreview() {
		if (document.getElementById("color-preview"))
			document.getElementById("color-preview").style.backgroundColor="rgb("+Visual.color.red+","+Visual.color.green+","+Visual.color.blue+")";
	}
	/**
	 * Updates the circle object's location.
	 */
	static updateCircleObject() {
		if (document.getElementById("obj"))
			document.getElementById("obj").style.background="radial-gradient(rgb("+(Visual.color.red*150)+","+(Visual.color.green*150)+","+(Visual.color.blue*150)+"), rgba(0,0,0,0) 30%)";
	}
	/**
	 * Determines if the HTMLCanvasElement object exists.
	 * @returns {boolean}
	 */
	static canvasExists() {
		return document.getElementById("canvas-display")!==undefined;
	}
	/**
	 * Updates the color values of the bars and circle.
	 */
	static updateColor()
	{
		setTimeout(function(){Visual.updateColorPreview();},0);
		setTimeout(function(){Visual.updateCircleObject();},0);
		if (Visual.canvasExists() && Visual.cbg) {
			if ((typeof setup)!=="undefined") {
				let conf={
					"color":Visual.cbg_ovr
				};
				setup(conf);
			} else
				console.warn("\"setup\" function does not exist.");
		}
		if ((typeof viz)!=="undefined") {
			if ((typeof viz.bar)==="undefined") {
				viz.bar={
					"color":{}
				};
			}
			viz.bar.color={
				"r":Visual.color.red,
				"g":Visual.color.green,
				"b":Visual.color.blue,
				"a":1
			};
		}
		Visual.updateColorBars();
	}
	/**
	 * Updates the bar colors.
	 * @param {number} ctl The color scaling value.
	 */
	static updateColorBars(ctl=150) {
		if(document.getElementById("head"))
			document.getElementById("head").style.backgroundColor="rgb("+Math.abs(Math.floor(Visual.color.red*ctl))+","+Math.abs(Math.floor(Visual.color.green*ctl))+","+Math.abs(Math.floor(Visual.color.blue*ctl))+")";
	}
	/**
	 * Resets the colors to the default colors.
	 */
	static resetColors() {
		Visual.color.red=2;
		Visual.color.green=0;
		Visual.color.blue=0.55;
		document.getElementById("head").style.backgroundColor="rgb(255,50,100)";
	}
	/**
	 * Parses the URL hash parameters and updates the configurations on this page.
	 */
	static AcceptUrlParams()
	{
		let obj=UrlParams.GetParams();
		if(obj["r"])
		{
			Visual.color.red=parseFloat(obj["r"]);
			document.getElementById("r").value=Visual.color.red;
		}
		if(obj["g"])
		{
			Visual.color.green=parseFloat(obj["g"]);
			document.getElementById("g").value=Visual.color.green;
		}
		if(obj["b"])
		{
			Visual.color.blue=parseFloat(obj["b"]);
			document.getElementById("b").value=Visual.color.blue;
		}
	}
	
	/**
	 * Updates the rendering operation.
	 */
	static updateRenderDisplay() {
		//viz.elm.height=window.innerHeight;
		//viz.elm.width=window.innerWidth-1;
		//viz.width=viz.elm.width;
		//viz.height=viz.elm.height;
		//viz.bar.maxHeight=Visual.getMaxHeight();
		//viz.bar.width=window.innerWidth/(viz.bufferLength*2);

		viz.elm.height = window.innerHeight;
		viz.elm.width = window.innerWidth - 1;
		viz.width = viz.elm.width;
		viz.height = viz.elm.height;
		viz.bar.maxHeight = Visual.getMaxHeight();
		// Dynamically adjust bar width to fit the entire visualization within the canvas
		viz.bar.width = viz.width / (viz.bufferLength * 2);
		// Calculate an offset to center the visualization if needed
		Visual.xOffset = 0; // Reset offset, will be recalculated in rendering methods if necessary
	}
	/**
	 * Entry point to perform the rendering.
	 */
	static render()
	{
		let elm=document.getElementById("player");
		let src=elm.currentSrc;
		Visual.getSongLyrics(SongInfo.getSongName(src), SongInfo.getArtist(src));
		if(GV_Ran===false)
		{
			Visual.ini();
			GV_Ran=true;
		}
		Visual.postRender();
	}
	/**
	 * Performs rendering caluclations and rendering operations.
	 */
	static postRender() {
		//let h,x,i,y,r,g,b,a,calc,bh,bw;
		
		if(Visual.paused===false)
		{
			requestAnimationFrame(Visual.postRender);
			Visual.playLyrics();
			viz.ana.getFloatFrequencyData(viz.dataArray);
			if(!Visual.ghost)
				viz.ctx.clearRect(0,0,viz.width,viz.height);
			Visual.#calculateColors();
			let tre=0;
			switch(Visual.currentDesign) {
				case "bar":
					tre=Visual.#renderBars();
					break;
				case "line":
					tre=Visual.#renderLines();
					break;
				case "verticalLines":
					tre=Visual.#renderVerticalLines();
					break;
				case "radial":
					tre=Visual.#renderRadial();
					break;
				case "curvedLines":
					tre=Visual.#renderCurvedLines();
					break;
			}
			let ard=tre/(150*viz.bufferLength);
			//setTimeout(function(){Visual.#applyBarColor(ard);},0);
			if(GV_NewBG_State)
			{
				if(tre>0)
				{
					let mdiff=(Visual.last_measurement/viz.dataArray[0]);
					if(mdiff<1 && mdiff>0.85)
						sys.newLocation();
				}
				if(Visual.last_measurement!==viz.dataArray[0])
					Visual.last_measurement=viz.dataArray[0];
			}
		}
		//delete(x,i,y,r,g,b,a,calc,h,bh,bw);
	}
	
	static updateDesign(selectElement) {
		if(selectElement instanceof HTMLSelectElement)
			Visual.currentDesign=selectElement.value;
	}
	/**
	 * Renders a radius design.
	 * @returns int
	 */
	static #renderRadial() {
		let o=viz.bufferLength;
		let i=0, u=0, xx=(viz.bar.width+1)*(viz.bufferLength+Visual.xOffset), tre=0, toff=150, x=0, ii=viz.bufferLength-viz.bar.width;
		viz.ctx.beginPath();
		let tcl=100;
		viz.ctx.lineWidth=2;
		let tmpData=[];
		let radius=30;
		let centerX=viz.width/2;
		let centerY=viz.height/2;
		viz.ctx.moveTo(centerX, centerY);
		for(o=viz.bufferLength;o>-1;o--) {
			let y=((viz.dataArray[o]+toff)/viz.bar.height)*viz.bar.maxHeight;
			let calc=(y/viz.height)*256;
			viz.ctx.strokeStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
			let tmpX=x+(i*Visual.xOffset);
			let tmpY=viz.height-y;
			// (x-h)^2 + (y-k)^2 = r^2
			let theta=o * (2 * Math.PI) / (viz.bufferLength * 2);
			let calcX=o + radius * Math.cos(theta);
			let calcY=o + radius * Math.sin(theta);
			
			viz.ctx.lineTo(calcX + tmpX, calcY + tmpY);
			x+=viz.bar.width+1;
			i++;
			y=((viz.dataArray[u]+toff)/viz.bar.height)*viz.bar.maxHeight;
			calc=(y/viz.height)*256;
			viz.ctx.strokeStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
			let altX=xx+(ii*Visual.xOffset);
			let altY=viz.height-y;
			tmpData.push({x:altX, y:altY});
			if (viz.dataArray[u])
				tre+=viz.dataArray[u]+toff;
			u++;
			xx+=viz.bar.width+1;
			ii++;
		}
		viz.ctx.stroke();
		return tre;
	}
	/**
	 * Renders the lines.
	 */
	static #renderLines() {
		//let o=viz.bufferLength;
		//let i=0, u=0, xx=(viz.bar.width+1)*(viz.bufferLength+Visual.xOffset), tre=0, toff=150, x=0, ii=viz.bufferLength-viz.bar.width;
		//let tcl=100;
		//viz.ctx.lineWidth=2;
		//let tmpData=[];
		//let region;
		//viz.ctx.strokeStyle="red";
		//let colorCalc=Color.createFromRGB(0,0,0);
		//if(Visual.fillPolygon) {
		//	region=new Path2D();
		//	region.moveTo(0, viz.height);
		//} else {
		//	viz.ctx.beginPath();
		//	viz.ctx.moveTo(0, viz.height);
		//}
		//for(o=viz.bufferLength;o>-1;o--) {
		//	colorCalc=Color.createFromRGB(0,0,0);
		//	let y=((viz.dataArray[o]+toff)/viz.bar.height)*viz.bar.maxHeight;
		//	let calc=(y/viz.height)*256;
		//	let tmpX=x+(i*Visual.xOffset);
		//	let tmpY=viz.height-y;
		//	colorCalc.red=viz.bar.color.r*calc;
		//	colorCalc.green=viz.bar.color.g*calc;
		//	colorCalc.blue=viz.bar.color.b*calc;
		//	if(Visual.fillPolygon)
		//		region.lineTo(tmpX, tmpY);
		//	else {
		//		viz.ctx.strokeStyle=colorCalc.toString();
		//		viz.ctx.lineTo(tmpX, tmpY);
		//	}
		//	x+=viz.bar.width+1;
		//	i++;
		//	y=((viz.dataArray[u]+toff)/viz.bar.height)*viz.bar.maxHeight;
		//	calc=(y/viz.height)*256;
		//	let altX=xx+(ii*Visual.xOffset);
		//	let altY=viz.height-y;
		//	tmpData.push({x:altX, y:altY, calc:calc});
		//	if (viz.dataArray[u])
		//		tre+=viz.dataArray[u]+toff;
		//	u++;
		//	xx+=viz.bar.width+1;
		//	ii++;
		//}
		//for(let itu=0;itu<tmpData.length;itu++) {
		//	if(Visual.fillPolygon)
		//		region.lineTo(tmpData[itu].x, tmpData[itu].y);
		//	else {
		//		viz.ctx.strokeStyle="rgb("+(viz.bar.color.r*tmpData[itu].calc)+","+(viz.bar.color.g*tmpData[itu].calc)+","+(viz.bar.color.b*tmpData[itu].calc)+")";
		//		viz.ctx.lineTo(tmpData[itu].x, tmpData[itu].y);
		//	}
		//}
		//if(Visual.fillPolygon) {
		//	region.lineTo(Visual.width, Visual.height);
		//	region.closePath();
		//	viz.ctx.fillStyle=colorCalc.toString();
		//	viz.ctx.fill(region);
		//} else {
		//	viz.ctx.lineTo(Visual.width, Visual.height);
		//	viz.ctx.strokeStyle=colorCalc.toString();
		//	viz.ctx.stroke();
		//}
		//return tre;

		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150, x = 0;
		let totalVisWidth = viz.bar.width * (viz.bufferLength * 2);
		let startX = (viz.width - totalVisWidth) / 2; // Center the visualization
		x = startX;
		let xx = startX + totalVisWidth / 2;
		let ii = viz.bufferLength - viz.bar.width;
		let tcl = 100;
		viz.ctx.lineWidth = 2;
		let tmpData = [];
		let region;
		viz.ctx.strokeStyle = "red";
		let colorCalc = Color.createFromRGB(0, 0, 0);
		if (Visual.fillPolygon) {
			region = new Path2D();
			region.moveTo(startX, viz.height);
		} else {
			viz.ctx.beginPath();
			viz.ctx.moveTo(startX, viz.height);
		}
		for (o = viz.bufferLength; o > -1; o--) {
			colorCalc = Color.createFromRGB(0, 0, 0);
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = (y / viz.height) * 256;
			let tmpX = x + (i * Visual.xOffset);
			let tmpY = viz.height - y;
			colorCalc.red = viz.bar.color.r * calc;
			colorCalc.green = viz.bar.color.g * calc;
			colorCalc.blue = viz.bar.color.b * calc;
			if (Visual.fillPolygon)
				region.lineTo(tmpX, tmpY);
			else {
				viz.ctx.strokeStyle = colorCalc.toString();
				viz.ctx.lineTo(tmpX, tmpY);
			}
			x += viz.bar.width;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = (y / viz.height) * 256;
			let altX = xx + (ii * Visual.xOffset);
			let altY = viz.height - y;
			tmpData.push({x: altX, y: altY, calc: calc});
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width;
			ii++;
		}
		// ... existing code for the rest of the method ...
		return tre;

	}
	/**
	 * Renders the lines.
	 */
	static #renderCurvedLines() {
		let o=viz.bufferLength;
		let i=0, u=0, xx=(viz.bar.width+1)*(viz.bufferLength+Visual.xOffset), tre=0, toff=150, x=0, ii=viz.bufferLength-viz.bar.width;
		viz.ctx.beginPath();
		viz.ctx.moveTo(0, viz.height);
		let tcl=100;
		viz.ctx.lineWidth=2;
		let tmpData=[];
		let counter=0;
		let lastData={};
		let color=Color.createFromRGB(0,0,0);
		for(o=viz.bufferLength;o>=0;o--) {
			let y=((viz.dataArray[o]+toff)/viz.bar.height)*viz.bar.maxHeight;
			let calc=(y/viz.height)*256;
			color.red=viz.bar.color.r*calc;
			color.green=viz.bar.color.g*calc;
			color.blue=viz.bar.color.b*calc;
			viz.ctx.strokeStyle=color.toString();
			let tmpX=x+(i*Visual.xOffset);
			let tmpY=viz.height-y;
			if(counter>0 && counter%2===0) {
				viz.ctx.quadraticCurveTo(lastData.x, lastData.y, tmpX, tmpY);
				viz.ctx.moveTo(tmpX, tmpY);
			}
			lastData={x:tmpX, y:tmpY};
			
			x+=viz.bar.width+1;
			i++;
			y=((viz.dataArray[u]+toff)/viz.bar.height)*viz.bar.maxHeight;
			calc=(y/viz.height)*256;
			color=Color.createFromRGB(viz.bar.color.r*calc, viz.bar.color.g*calc, viz.bar.color.b*calc);
			viz.ctx.strokeStyle=color.toString();
			tmpData.push({x:xx+(ii*Visual.xOffset), y:viz.height-y, color:color});
			if (viz.dataArray[u])
				tre+=viz.dataArray[u]+toff;
			u++;
			xx+=viz.bar.width+1;
			ii++;
			counter++;
		}
		let itu=0;
		for(itu=0;itu<tmpData.length;itu++) {
			if(itu>0 && itu%2===0) {
				viz.ctx.strokeStyle=tmpData[itu].color.toString();
				viz.ctx.quadraticCurveTo(lastData.x, lastData.y, tmpData[itu].x, tmpData[itu].y);
				viz.ctx.moveTo(tmpData[itu].x, tmpData[itu].y);
			}
			lastData={x:tmpData[itu].x, y:tmpData[itu].y};
		}
		viz.ctx.quadraticCurveTo(lastData.x, lastData.y, window.innerWidth, window.innerHeight);
		viz.ctx.quadraticCurveTo(window.innerWidth, window.innerHeight, window.innerWidth * 1.1, window.innerHeight * 1.1);
		viz.ctx.stroke();
		return tre;
	}
	/**
	 * Renders the audio visualizer as bar designs.
	 */
	static #renderBars() {
		//let o=viz.bufferLength;
		//let i=0, u=0, xx=(viz.bar.width+1)*(viz.bufferLength+Visual.xOffset), tre=0, toff=150, x=0, ii=viz.bufferLength-viz.bar.width;
		//for(o=viz.bufferLength;o>-1;o--) {
		//	let y=((viz.dataArray[o]+toff)/viz.bar.height)*viz.bar.maxHeight;
		//	// 256
		//	let calc=(y/viz.height)*256;
		//	viz.ctx.fillStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
		//	viz.ctx.fillRect(x+(i*Visual.xOffset),viz.height-y,viz.bar.width,viz.height);
		//	x+=viz.bar.width+1;
		//	i++;
		//	y=((viz.dataArray[u]+toff)/viz.bar.height)*viz.bar.maxHeight;
		//	calc=(y/viz.height)*256;
		//	viz.ctx.fillStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
		//	viz.ctx.fillRect(xx+(ii*Visual.xOffset),viz.height-y,viz.bar.width,viz.height);
		//	if (viz.dataArray[u])
		//		tre+=viz.dataArray[u]+toff;
		//	u++;
		//	xx+=viz.bar.width+1;
		//	ii++;
		//}
		//return tre;

		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150, x = 0;
		// Calculate total width of visualization to center it
		let totalVisWidth = viz.bar.width * (viz.bufferLength * 2);
		let startX = (viz.width - totalVisWidth) / 2; // Center the visualization
		x = startX;
		let xx = startX + totalVisWidth / 2; // Midpoint for mirrored effect
		let ii = viz.bufferLength - viz.bar.width;
		for (o = viz.bufferLength; o > -1; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = (y / viz.height) * 256;
			viz.ctx.fillStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.fillRect(x + (i * Visual.xOffset), viz.height - y, viz.bar.width, viz.height);
			x += viz.bar.width;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = (y / viz.height) * 256;
			viz.ctx.fillStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.fillRect(xx + (ii * Visual.xOffset), viz.height - y, viz.bar.width, viz.height);
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width;
			ii++;
		}
		return tre;
	}
	/**
	 * Renders the audio visualizer as bar designs.
	 */
	static #renderVerticalLines() {
		let o=viz.bufferLength;
		let i=0, u=0, xx=(viz.bar.width+1)*(viz.bufferLength-1.025), tre=0, toff=150, x=0, ii=viz.bufferLength-viz.bar.width;
		viz.ctx.beginPath();
		viz.ctx.moveTo(0, viz.height);
		let tcl=100;
		viz.ctx.lineWidth=2;
		let tmpData=[];
		for(o=viz.bufferLength;o>-1;o--) {
			let y=((viz.dataArray[o]+toff)/viz.bar.height)*viz.bar.maxHeight;
			let calc=(y/viz.height)*256;
			viz.ctx.strokeStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
			let tmpX=x+(i*-1.025);
			let tmpY=viz.height-y;
			viz.ctx.lineTo(tmpX, tmpY);
			viz.ctx.moveTo(tmpX + viz.bar.width, tmpY+viz.height);
			x+=viz.bar.width+1;
			i++;
			y=((viz.dataArray[u]+toff)/viz.bar.height)*viz.bar.maxHeight;
			calc=(y/viz.height)*256;
			viz.ctx.strokeStyle="rgb("+(viz.bar.color.r*calc)+","+(viz.bar.color.g*calc)+","+(viz.bar.color.b*calc)+")";
			let altX=xx+(ii*-1.025);
			let altY=viz.height-y;
			tmpData.push({x:altX, y:altY});
			if (viz.dataArray[u])
				tre+=viz.dataArray[u]+toff;
			u++;
			xx+=viz.bar.width+1;
			ii++;
		}
		let itu;
		for(itu=0;itu<tmpData.length;itu++) {
			viz.ctx.moveTo(tmpData[itu].x+viz.bar.width, tmpData[itu].y+viz.height);
			viz.ctx.lineTo(tmpData[itu].x, tmpData[itu].y);
		}
		itu--;
		viz.ctx.moveTo(tmpData[itu].x, tmpData[itu].y);
		viz.ctx.lineTo(viz.width, viz.height);
		viz.ctx.stroke();
		return tre;
	}
	/**
	 * Performs drawing operations on the canvas.
	 */
	stroke() {
		setTimeout(function(){this.ctx.stroke();},0);
	}
	/**
	 * Sets the color of the bar and applies the alpha value to the bar's rgba color value.
	 * @param {int} ard The bar alpha color value.
	 */
	static #applyBarColor(ard) {
		let meIns = this;
		if(Visual.color.fade) {
			let tcl=100;
			let cl=Math.abs(Math.floor(viz.bar.color.r*tcl))+","+Math.abs(Math.floor(viz.bar.color.g*tcl))+","+Math.abs(Math.floor(viz.bar.color.b*tcl));
			let color=cl+","+ard;
			this.#applyProgBarStyle("filter:drop-shadow(0px 0px 10px rgba("+color+")) drop-shadow(16px 0px 10px rgba("+color+")) drop-shadow(-16px 0px 10px rgba("+color+")) drop-shadow(0px 16px 10px rgba("+color+")) drop-shadow(0px -16px 10px rgba("+color+"));background-color:rgb("+cl+")");
			
			setTimeout(function(){
				meIns.progBarElm.style.filter="drop-shadow(0px 0px 10px rgba("+color+")) drop-shadow(16px 0px 10px rgba("+color+")) drop-shadow(-16px 0px 10px rgba("+color+")) drop-shadow(0px 16px 10px rgba("+color+")) drop-shadow(0px -16px 10px rgba("+color+"))";
				meIns.progBarElm.style.backgroundColor="rgb("+cl+")";
			},100);
			
			//document.getElementById("head").style.filter="drop-shadow(0px 0px 10px rgba("+color+")) drop-shadow(16px 0px 10px rgba("+color+")) drop-shadow(-16px 0px 10px rgba("+color+")) drop-shadow(0px 16px 10px rgba("+color+")) drop-shadow(0px -16px 10px rgba("+color+"))";
			//document.getElementById("head").style.backgroundColor="rgb("+cl+")";
		} else {
			let tcl=100;
			let cl=Math.abs(Math.floor(viz.bar.color.r*tcl))+","+Math.abs(Math.floor(viz.bar.color.g*tcl))+","+Math.abs(Math.floor(viz.bar.color.b*tcl));
			let color=cl+","+ard;
			setTimeout(function() {
				meIns.progBarElm.style.filter="drop-shadow(0px 0px 10px rgba(" + color + ")) drop-shadow(16px 0px 10px rgba(" + color + ")) drop-shadow(-8px 0px 10px rgba(" + color + ")) drop-shadow(0px 16px 10px rgba(" + color + ")) drop-shadow(0px -16px 10px rgba(" + color + "))";
				meIns.progBarElm.style.backgroundColor="rgb("+ard+")";
			},100);
			//this.progBarElm.style.filter="drop-shadow(0px 0px 10px rgba(" + color + ")) drop-shadow(16px 0px 10px rgba(" + color + ")) drop-shadow(-8px 0px 10px rgba(" + color + ")) drop-shadow(0px 16px 10px rgba(" + color + ")) drop-shadow(0px -16px 10px rgba(" + color + "))";
			//this.progBarElm.style.backgroundColor="rgb("+ard+")";
			
			//this.#applyProgBarStyle("filter:drop-shadow(0px 0px 10px rgba(" + color + ")) drop-shadow(16px 0px 10px rgba(" + color + ")) drop-shadow(-8px 0px 10px rgba(" + color + ")) drop-shadow(0px 16px 10px rgba(" + color + ")) drop-shadow(0px -16px 10px rgba(" + color + "));background-color:rgb("+ard+")");
			//document.getElementById("head").style.filter="drop-shadow(0px 0px 10px rgba(" + color + ")) drop-shadow(16px 0px 10px rgba(" + color + ")) drop-shadow(-8px 0px 10px rgba(" + color + ")) drop-shadow(0px 16px 10px rgba(" + color + ")) drop-shadow(0px -16px 10px rgba(" + color + "))";
			//document.getElementById("head").style.backgroundColor="rgb("+ard+")";
		}
	}
	
	static #applyProgBarStyle(style) {
		this.progBarElm.style = style;
	}
	/**
	 * Calculates and renders the colors of the bars.
	 */
	static #calculateColors() {
		if(Visual.color.fade) {
			if (!Visual.color.fades.start) {
				Visual.color.saved.r=viz.bar.color.r;
				Visual.color.saved.g=viz.bar.color.g;
				Visual.color.saved.b=viz.bar.color.b;
				Visual.color.fades.state=Math.floor((Visual.color.saved.r/Visual.color.fades.max)/Visual.color.fades.inc);
				viz.bar.color.g=0;
				viz.bar.color.b=0.55;
				Visual.color.fades.start=true;
				Visual.color.fades["gmax"]=Visual.color.fades.max/Visual.color.fades.inc;
				Visual.color.fades["bmax"]=(Visual.color.fades.max/Visual.color.fades.inc)*2;
				Visual.color.fades["rmax"]=(Visual.color.fades.max/Visual.color.fades.inc)*3;
			}
			if(Visual.color.fades.state>=0 && Visual.color.fades.state<Visual.color.fades.gmax) {
				viz.bar.color.g+=Visual.color.fades.inc;
				viz.bar.color.r-=Visual.color.fades.inc;
			}
			else if(Visual.color.fades.state>=Visual.color.fades.gmax && Visual.color.fades.state<Visual.color.fades.bmax) {
				viz.bar.color.b+=Visual.color.fades.inc;
				viz.bar.color.g-=Visual.color.fades.inc;
			}
			else if(Visual.color.fades.state>=Visual.color.fades.bmax && Visual.color.fades.state<Visual.color.fades.rmax) {
				viz.bar.color.b-=Visual.color.fades.inc;
				viz.bar.color.r+=Visual.color.fades.inc;
			} else
				Visual.color.fades.state=0;
			Visual.color.fades.state++;
		} else {
			if(Visual.color.fades.start)
			{
				Visual.color.fades.start=false;
				viz.bar.color.r=Visual.color.saved.r;
				viz.bar.color.g=Visual.color.saved.g;
				viz.bar.color.b=Visual.color.saved.b;
				document.getElementById("head").style.backgroundColor="rgb(255,50,100)";
			}
		}
	}
	/**
	 * Obtains the song lyrics from the database and loads them into this object.
	 * @param {string} songName The name of the song.
	 * @param {string} artist The artist of the song.
	 */
	static getSongLyrics(songName, artist) {
		let a={
			"src":"assets/php/getSongLyrics.php",
			"args":{
				"songName":songName,
				"artist":artist
			}
		};
		Server.send(a, true, Visual.loadLyrics);
	}
	/**
	 * Plays the song lyrics if there are any lyrics.
	 */
	static playLyrics() {
		if(Visual.lyricsEnabled && Visual.lyrics!==undefined)
			Visual.displayLyrics(Math.floor(document.getElementById("player").currentTime*1000));
	}
	/**
	 * Loads the song lyrics into memory.
	 * @param {object} songLyricsObject The data object containing the song lyrics.
	 */
	static loadLyrics(songLyricsObject) {
		let data=Visual.parseJson(songLyricsObject);
		songLyricsObject=new Lyrics(data);
		Visual.lyrics=songLyricsObject;
	}
	/**
	 * Attempts to parse the string as a JSON object.
	 * @param {string} value The string to parse.
	 * @returns {object}
	 */
	static parseJson(value) {
		try {
			if(value instanceof ServerResponse)
				return value.value;
			return JSON.parse(value);
		} catch {
			console.error(value);
		}
	}
	/**
	 * Gets the current lyric set for the current time of the song.
	 * @param {Number|int|float} currentTime The current time position in the song.
	 * @returns {string|undefined}
	 */
	static getCurrentLyrics(currentTime) {
		return Visual.lyrics!==undefined && Object.keys(Visual.lyrics).length>0 ? Visual.lyrics.getAtTime(currentTime.toString()) : "";
	}
	/**
	 * Displays the current lyrics based on the current time position in the song.
	 * @param {Number|int|float} currentTime The current time position in the song.
	 */
	static displayLyrics(currentTime) {
		let text=Visual.getCurrentLyrics(currentTime);
		if(text!==undefined && text!=="]")
			Visual.captionElm.innerText=text;
	}
	
	/*
	static getSongLyrics(songName, artist) {
		// https://lyrist.vercel.app/api/{SONG_NAME}/{ARTIST}
		// https://lyrist.vercel.app/api/RuLe/Ado
		const baseUrl="https://lyrist.vercel.app/api/";
		let a={
			"src":baseUrl+songName+"/"+artist,
			"args":{
				"cmd":""
			}
		};
		Server.send(a, true, Visual.processSongLyrics);
	}
	*/
	/**
	 * Processes the song lyrics.
	 * @deprecated Not used.
	 * @param {string} data The data ro analyze.
	 */
	static processSongLyrics(data) {
		console.log(data);
	}
	/**
	 * Sets the caption value.
	 * @param {string} textValue The text to display on the caption/subtitle element.
	 */
	static setCaption(textValue="") {
		setTimeout(function(){document.getElementById("caption").innerText=textValue;},0);
	}
	
} // END OF VISUAL CLASS
document.getElementById("player").addEventListener("pause",function(){Visual.paused=true;});
document.getElementById("player").addEventListener("play",function(){Visual.paused=false;});
document.getElementById("ghost").addEventListener("click",function(){
	Visual.ghost=document.getElementById("ghost").checked;
});
document.getElementById("cbg").addEventListener("click",function(){
	Visual.cbg=document.getElementById("cbg").checked;
});
document.getElementById("hex-color").addEventListener("change",function(){
	SetHexColors();
});

setTimeout(function(){SetHexColors();},0);

function SetHexColors()
{
	let str=document.getElementById("hex-color").value;
	str=str.substring(1,str.length);
	let r=str.substr(0,2);
	let g=str.substr(2,2);
	let b=str.substr(4,2);
	let a="32";
	if(str.length>6)
		a=str.substr(6,2);
	// Now we must convert the hexadecimal into decimal for rgba processing.
	Visual.cbg_ovr={
		"r":HexToDec(r),
		"g":HexToDec(g),
		"b":HexToDec(b),
		"a":HexToDec(a)
	};
	Visual.updateColor();
}
document.getElementById("r").addEventListener("mousemove",function(event){
	let elm=document.getElementById("tooltip");
	//elm.innerHTML=Math.floor(parseFloat(document.getElementById("r").value)*10000)/100;
	elm.innerText=document.getElementById("r").value;
	elm.style.opacity=1;
	elm.style.top=event.clientY+"px";
	elm.style.left=(event.clientX+10)+"px";
});
document.getElementById("r").addEventListener("mouseout",function(){
	document.getElementById("tooltip").style.opacity=0;
});
document.getElementById("g").addEventListener("mousemove",function(event){
	let elm=document.getElementById("tooltip");
	//elm.innerHTML=Math.floor(parseFloat(document.getElementById("g").value)*10000)/100;
	elm.innerText=document.getElementById("g").value;
	elm.style.opacity=1;
	elm.style.top=event.clientY+"px";
	elm.style.left=(event.clientX+10)+"px";
});
document.getElementById("g").addEventListener("mouseout",function(){
	document.getElementById("tooltip").style.opacity=0;
});
document.getElementById("b").addEventListener("mousemove",function(event){
	let elm=document.getElementById("tooltip");
	//elm.innerHTML=Math.floor(parseFloat(document.getElementById("b").value)*10000)/100;
	elm.innerText=document.getElementById("b").value;
	elm.style.opacity=1;
	elm.style.top=event.clientY+"px";
	elm.style.left=(event.clientX+10)+"px";
});
document.getElementById("b").addEventListener("mouseout",function(){
	document.getElementById("tooltip").style.opacity=0;
});
// Returns the decimal value of the hex string.
function HexToDec(q=false) {
	let res=0;
	if ((typeof q)==="string")
		res=parseInt(q,16);
	return res;
}
