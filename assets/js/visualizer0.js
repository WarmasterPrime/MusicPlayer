

var viz={};
var GV_Ran=false;
class visual {
	
	constructor(q=false) {
		
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
		//this.width=window.innerWidth;
		//this.height=window.innerHeight;
		this.actx=new AudioContext();
		this.src=this.actx.createMediaElementSource(this.audio);
		this.ana=this.actx.createAnalyser();
		this.elm.width=this.width;
		this.elm.height=this.height;
		this.ctx=this.elm.getContext("2d");
		this.src.connect(this.ana);
		this.ana.connect(this.actx.destination);
		
		this.ana.fftSize=256;
		this.bufferLength=this.ana.frequencyBinCount;
		
		this.dataArray=new Uint8Array(this.bufferLength);
		
		this.bar.width=((this.width/this.bufferLength)*2.5);
		this.bar.height=0;
	}
	
	get audio() {
		return document.getElementById(this.id);
	}
	
	static width() {
		return (window.innerWidth-10);
	}
	static height() {
		return window.innerHeight-10;
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
		
		this.ana.fftSize=256;
		this.bufferLength=this.ana.frequencyBinCount;
		
		this.dataArray=new Uint8Array(this.bufferLength);
		
		this.bar.width=((this.width/this.bufferLength)*2.5);
		this.bar.height=0;
	}
	
	
	static render() {
		var ctx=false;
		viz.elm=document.getElementById("visualizer");
		ctx=viz.elm.getContext("2d");
		if (GV_Ran===false) {
			viz.elm.width=window.innerWidth-500;
			viz.elm.height=window.innerHeight-100;
			viz.width=window.innerWidth-500;
			viz.height=window.innerHeight-100;
			viz.actx=new AudioContext();
			viz.src=viz.actx.createMediaElementSource(document.getElementById("player"));
			viz.ana=viz.actx.createAnalyser();
			viz.src.connect(viz.ana);
			viz.ana.connect(viz.actx.destination);
			viz.ana.fftSize=256;
			viz.bufferLength=viz.ana.frequencyBinCount;
			viz.dataArray=new Uint8Array(viz.bufferLength);
			viz.bar={
				"width":1,
				"height":viz.height,
				"color":{
					"r":2,
					"g":0,
					"b":0.55,
					"a":1
				}
			};
			viz.bar.width=((viz.width+parseFloat(document.getElementById("barWidth").value))/viz.bufferLength)*0.25;
			console.log(viz);
			viz.id=viz.elm.id;
			
			console.log(viz.dataArray.length);
			
			GV_Ran=true;
		}
		//this.setup();
		//this.audio=document.getElementById(this.id);
		var x,i,lim,y,r,g,b,a,calc,w,h,bh,bw,offset,percent;
		
		var usr={
				"bar":{
					"width":parseFloat(document.getElementById("barWidth").value),
					"maxHeight":parseFloat(document.getElementById("maxHeight").value)
				}
			};
		
		percent=2480;
		percent=500;
		percent=1000;
		percent=usr.bar.maxHeight*100;
		
		if (document.getElementById("player").paused!==true) {
			//console.log(viz);
			
			//console.log(ctx);
			
			requestAnimationFrame(visual.render);
			
			x=0;
			
			
			lim=viz.bufferLength-20;
			
			lim=viz.bufferLength-75;
			
			
			
			
			viz.ana.getByteFrequencyData(viz.dataArray);
			//viz.ctx.fillStyle="rgba(0,0,0,0.0)";
			
			viz.bar.width=((viz.width/viz.bufferLength)*0.25) * (usr.bar.width);
			
			i=0;
			w=viz.width;
			h=viz.height;
			bh=viz.bar.height;
			bw=viz.bar.width;
			offset=viz.width/((viz.dataArray.length*2)*(viz.bar.width/1.32));
			//console.log(viz.bar.width);
			offset=(viz.width)/((lim*2)*viz.bar.width)*2;
			//offset=(offset/(lim/(usr.bar.width*55)));
			offset=offset-(usr.bar.width*0.17);
			
			offset=-1;
			
			
			if (!document.getElementById("ghost").checked) {
				ctx.clearRect(0,0,viz.width,viz.height);
			}
			
			//ctx.fillStyle="rgba(0,0,0,0.0)";
			
			//console.log(viz.dataArray);
			
			var o=0;
			
			o=lim;
			//i++;
			for(o=lim;o>-1;o--){
				
				//y=(viz.dataArray[o]/viz.bar.height)*percent;
				if (usr.bar.maxHeight===0) {
					y=(viz.dataArray[o]/256)*viz.height;
				} else {
					y=(viz.dataArray[o]/viz.bar.height)*percent;
				}
				//console.log(y);
				calc=(y/viz.height)*256;
				//calc=y;
				
				r=(viz.bar.color.r*calc);
				g=(viz.bar.color.g*calc);
				b=(viz.bar.color.b*calc);
				
				a=1;
				ctx.fillStyle="rgb("+r+","+g+","+b+")";
				ctx.fillRect((x+(i*offset)),h-y,bw,viz.height);
				x+=bw+1;
				i++;
			}
			
			for(o=0;o<lim;o++){
				
				//y=(viz.dataArray[o]/viz.bar.height)*percent;
				if (usr.bar.maxHeight===0) {
					y=(viz.dataArray[o]/256)*viz.height;
				} else {
					y=(viz.dataArray[o]/viz.bar.height)*percent;
				}
				//console.log(y);
				calc=(y/viz.height)*256;
				//calc=y;
				r=(viz.bar.color.r*calc);
				g=(viz.bar.color.g*calc);
				b=(viz.bar.color.b*calc);
				
				a=1;
				ctx.fillStyle="rgb("+r+","+g+","+b+")";
				ctx.fillRect((x+(i*offset)),h-y,bw,viz.height);
				
				
				x+=bw+1;
				i++;
			}
			
			
			
		}
		//this.render();
	}
	
}

