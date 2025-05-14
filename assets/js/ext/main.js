
setTimeout(function(){ini0();},0);

function ini0() {
	if ((typeof gpu)!=="undefined") {
		installCanvas();
		let conf={
			"color":{
				"r":255,
				"g":0,
				"b":100,
				"a":0.5
			}
		};
		setup(conf);
		//setup();
	} else {
		setTimeout(function(){ini();},50);
	}
}

function installCanvas(q=false) {
	if (document.getElementById("main-before")) {
		let par=document.getElementById("main-before");
		let elm=document.createElement("canvas");
		let id=genID();
		let t=(typeof q);
		let config={};
		if (t==="string") {
			try{
				q=JSON.parse(q);
			}catch{}
		}
		t=(typeof q);
		if (t==="array" || t==="object") {
			t=(typeof q["id"]);
			if (t!=="undefined") {
				id=q["id"];
			}
		}
		elm.id=id;
		elm.classList.add("canvas");
		elm.classList.add("display");
		elm.width=window.innerWidth;
		elm.height=window.innerHeight;
		par.appendChild(elm);
		gpu.ini(document.getElementById(id));
		window.addEventListener("resize",function(){setup();});
	}
}

function genID() {
	let t=(typeof document.getElementById("canvas-display"));
	let i=0;
	let lim=100;
	let res="canvas-display";
	while(t==="undefined" && i<lim) {
		res="canvas-display-"+i;
		t=(typeof document.getElementById(res));
		i++;
	}
	return res;
}

var GV_dur=0;
var GV_CONF=false;
function setup(q=false) {
	//gpu.ini();
	// r=150,g=0,b=50
	
	let ctx=document.getElementById("canvas-display").getContext("2d");
	ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
	
	let r=150;
	let g=0;
	let b=50;
	let a=0.75;
	
	if (q===false) {
		if (GV_CONF!==false) {
			let t=(typeof GV_CONF);
			if (t==="array" || t==="object") {
				q=GV_CONF;
			}
		}
	}
	if ((typeof q.color)!=="undefined") {
		if ((typeof q.color.r)!=="undefined") {
			r=q.color.r;
		}
		if ((typeof q.color.g)!=="undefined") {
			g=q.color.g;
		}
		if ((typeof q.color.b)!=="undefined") {
			b=q.color.b;
		}
		if ((typeof q.color.a)!=="undefined") {
			a=q.color.a;
		}
	}
	
	let t=(typeof q);
	let mode=false;
	let w=0;
	let h=0;
	let obj={
		"shape":"hexagon",
		"x":0,
		"y":0,
		"width":115,
		"height":100,
		//"width":23,
		//"height":20,
		//"fill":"rgba(" + r + "," + g + "," + b + "," + a + ")",
		"border-color":"black",
		"border-size":1,
		"t-mode":1,
		"t-count":0,
		"fill":"radial-gradient",
		"gradient":{
			"x":115,
			"y":100,
			"colors":[
				"rgba(" + r + "," + g + "," + b + "," + a + ")",
				"rgba(0,0,0,0.0)"
			]
		}
	};
	
	
	if (t==="array"||t==="object") {
		GV_CONF=q;
		if (q["animation"]) {
			if (q["animation"]["mode"]) {
				if (q["animation"]["mode"]==="breathe") {
					mode="breathe";
				}
			}
		}
		if ((typeof q["color"])==="array"||(typeof q["color"])==="object") {
			if ((typeof q["color"]["r"])==="number") {
				r=q["color"]["r"];
			}
			if ((typeof q["color"]["red"])==="number") {
				r=q["color"]["red"];
			}
			
			if ((typeof q["color"]["g"])==="number") {
				g=q["color"]["g"];
			}
			if ((typeof q["color"]["green"])==="number") {
				g=q["color"]["green"];
			}
			
			if ((typeof q["color"]["b"])==="number") {
				b=q["color"]["b"];
			}
			if ((typeof q["color"]["blue"])==="number") {
				b=q["color"]["blue"];
			}
			
			if ((typeof q["color"]["a"])==="number") {
				a=q["color"]["a"];
			}
			if ((typeof q["color"]["alpha"])==="number") {
				a=q["color"]["alpha"];
			}
			
		}
		if ((typeof q["width"])==="number") {
			//obj["width"]=q["width"];
			w=q["width"];
		}
		if ((typeof q["height"])==="number") {
			//obj["height"]=q["height"];
			h=q["height"];
		}
		if ((typeof q["t-mode"])==="number") {
			obj["t-mode"]=q["t-mode"];
			//console.log(q["t-mode"]);
		}
		if ((typeof q["t-count"])==="number") {
			obj["t-count"]=q["t-count"];
			//console.log(q["t-count"]);
		}
	}
	
	//obj["fill"]="rgba(" + r + "," + g + "," + b + "," + a + ")";
	
	let i=-2;
	let o=-2;
	let cols=Math.floor(window.innerWidth/obj.width)+4;
	let rows=Math.floor(window.innerHeight/obj.height)+4;
	obj["cols"]=cols;
	obj["rows"]=rows;
	obj["i"]=0;
	obj["o"]=0;
	//obj["x"]=-1*obj.width;
	//obj["y"]=-1*obj.height;
	let tmp=0;
	let tmp0={
		"shape":"hexagon",
		"x":0,
		"y":0,
		//"width":109,
		//"height":94,
		"width":100,
		"height":85,
		//"width":23,
		//"height":20,
		//"fill":"rgba(" + r + "," + g + "," + b + "," + a + ")",
		"border-color":"black",
		"border-size":1,
		"t-mode":1,
		"t-count":0
	};
	let offset=(obj["width"]-tmp0["width"])-7;
	//console.log(offset);
	tmp0["fill"]="rgba(0,0,0,0.5)";
	while(i<cols){
		o=0;
		tmp=(i*18);
		if ((i%2)===0) {
			obj["x"]=(i*obj["width"])-tmp;
			//tmp0["x"]=(i*obj["width"])-tmp;
			tmp0["x"]=obj["x"]+offset;
		} else {
			obj["x"]=(i*obj["width"])-(obj["width"]/256)-tmp;
			//tmp0["x"]=(i*obj["width"])-(obj["width"]/256)-tmp;
			tmp0["x"]=obj["x"]+offset;
		}
		while(o<rows){
			//obj["x"]=(i*obj["width"])+1;
			//obj["y"]=obj["y"]+50;
			if ((i%2)===0) {
				obj["y"]=(o*obj["height"]);
				//tmp0["y"]=(o*tmp0["height"]);
				tmp0["y"]=obj["y"];
			} else {
				obj["y"]=(o*obj["height"])-(obj["height"]/1.85);
				//tmp0["y"]=(o*tmp0["height"])-(tmp0["height"]/1.85);
				tmp0["y"]=obj["y"];
			}
			obj["y"]=obj["y"]+(o*8);
			//tmp0["y"]=tmp0["y"]+(o*8);
			tmp0["y"]=obj["y"]+offset;
			//console.log(obj);
			//gpu.create(tmp);
			gpu.create(obj);
			//tmp0=obj;
			//tmp0["x"]=(obj["x"]+10);
			//tmp0["y"]=(obj["y"]+10);
			//tmp0["width"]=(obj["width"]-10);
			//tmp0["height"]=(obj["height"]-10);
			gpu.create(tmp0);
			//console.log(tmp0);
			//return false;
			o++;
		}
		i++;
	}
	//col(obj);
	//setTimeout(function(){col(obj);},0);
	//gpu.create(obj);
	/*
	setTimeout(function(){
		if (r>0 && g<150 && b===0) {
			r--;
			g++;
		} else if (g>0 && b<150) {
			g--;
			b++;
		} else if (b>0 && r<150) {
			r++;
			b--;
		}
		setup(r,g,b);
	},50);
	*/
}

function moveBG() {
	if (document.getElementById("obj")) {
		let elm=document.getElementById("obj");
		let offset=500;
		elm.style.top=(Math.random()*window.innerHeight+(offset*2)-offset) / 1.25 + "px";
		elm.style.left=(Math.random()*window.innerWidth+(offset*2)-offset) / 1.25 + "px";
		//setTimeout(function(){moveBG();},1500);
	}
}

function col(obj=false) {
	if (obj["i"]<obj.cols) {
		obj["x"]=(obj["i"]*obj["width"]);
		setTimeout(function(){row(obj);},0);
	}
}
function row(obj=false) {
	if (obj["o"]<obj.rows) {
		obj["y"]=(obj["o"]*obj["height"]);
		let sel=(Math.random()*3);
		if (sel<1) {
			obj["fill"]="red";
		} else if (sel>=1 && sel<2) {
			obj["fill"]="green";
		} else {
			obj["fill"]="blue";
		}
		gpu.create(obj);
		obj["o"]++;
		setTimeout(function(){row(obj);},GV_dur);
	} else {
		obj["i"]++;
		obj["o"]=0;
		//obj["y"]=-1*obj.height;
		setTimeout(function(){col(obj);},0);
	}
}




function setup0() {
	//let template="<polygon points='-34.2 38.5 -34.2 0.5 -1.3 -18.5 31.6 0.5 31.6 38.5 -1.3 57.5 -34.2 38.5'></polygon>";
	let template="";
	let gen="";
	let i=0;
	let w=76;
	let h=76;
	let cols=Math.floor(window.innerWidth/w);
	let rows=Math.floor(window.innerHeight/h);
	let lim=500;
	let x=-34.2;
	let y=38.5;
	let o=0;
	let points=[];
	i=0;
	let coords="";
	let hs0=(h/4);
	let wtd0=0;
	let wtd=0;
	let posw=0;
	let off=5;
	while(i<rows){
		o=0;
		while(o<cols){
			if (true) {
				wtd=((w/2)*o)+(w/2);
				wtd0=((w/2)*o)+w;
				posw=wtd0-w;
				points=[
					wtd, (h*i),

					posw+off, (h*i)+hs0,
					posw+off, (h*i)+(hs0*3),

					wtd, (h*i)+h,

					wtd0-off, (h*i)+(hs0*3),
					wtd0-off, (h*i)+hs0

				];
				coords=points[0] + " " + points[1] + " " + points[2] + " " + points[3] + " " + points[4] + " " + points[5] + " " + points[6] + " " + points[7] + " " + points[8] + " " + points[9] + " " + points[10] + " " + points[11];
				template="<polygon points='" + coords + "'></polygon>";
				gen+=template;
			}
			o++;
		}
		i++;
	}
	let elm=false;
	
	elm=document.createElement("div");
	elm.id="bg";
	elm.className="bg";
	document.getElementById("main-container").appendChild(elm);
	
	
	elm=document.createElement("div");
	elm.id="hex-container";
	elm.className="container";
	elm.innerHTML="<svg viewBox='0 0 1280 500' preserveAspectRatio='xMidYMid slice'>" + gen + "</svg>";
	document.getElementById("main-container").appendChild(elm);
}


