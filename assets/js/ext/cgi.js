
let tmp = [];

class cgi {
	static saved=false;
	static debug=0;
	// Generates a line.
	static line(q=false) {
		cgi.setup(q);
		if ((typeof q.data.line.type)==="string") {
			q.ctx.lineCap=q.data.line.type.toLowerCase();
		}
		q.ctx.lineTo(q.w,q.h);
		cgi.fin(q);
	}
	// Generates a triangle.
	static triangle(q=false) {
		//cgi.setup(q);
		q.ctx.save();
		q.ctx.beginPath();
		q.ctx.moveTo((q.x + (q.w/2)),q.y);
		q.ctx.lineTo((q.x+q.w),(q.y+q.h));
		//q.ctx.moveTo((q.x+q.w),(q.y+q.h));
		q.ctx.lineTo(q.x,(q.y+q.h));
		//q.ctx.moveTo(q.x,(q.y+q.h));
		q.ctx.lineTo((q.x+(q.w/2)),q.y);
		q.ctx.closePath();
		q.ctx.clip();
		cgi.setup(q);
		cgi.fin(q);
	}
	// Generates a box.
	static box(q=false) {
		cgi.setup(q);
		q.ctx.rect(q.x,q.y,q.w,q.h);
		cgi.fin(q);
	}
	// Generates a pentagon.
	static pentagon(q=false) {
		//cgi.setup(q);
		q.ctx.save();
		q.ctx.beginPath();
		q.ctx.moveTo((q.x+(q.w/2)),q.y);
		q.ctx.lineTo(q.x+q.w,q.y+(q.h/2.5));
		
		q.ctx.lineTo((q.x+(q.w-(q.w/4))),(q.y+q.h));
		q.ctx.lineTo((q.x+(q.w/4)),(q.y+q.h));
		
		//q.ctx.lineTo(q.x,(q.y+(q.h-(q.h/3))));
		q.ctx.lineTo(q.x,q.y+(q.h/2.5));
		q.ctx.lineTo((q.x+(q.w/2)),q.y);
		
		/*
		q.ctx.lineTo(q.x,q.y);
		q.ctx.lineTo(q.x,q.y+q.h);
		q.ctx.lineTo(q.x+q.w,q.y+q.h);
		q.ctx.lineTo(q.x+q.w,q.y);
		q.ctx.lineTo(q.x,q.y);
		q.ctx.lineTo((q.x+(q.w/2)),q.y);
		*/
		q.ctx.closePath();
		q.ctx.clip();
		cgi.setup(q);
		cgi.fin(q);
	}
	// Generates a hexagon.
	static hexagon(q=false) {
		/*
		if (cgi.saved===false) {
			q.ctx.save();
			cgi.saved=true;
		}
		*/
		q.ctx.save();
		q.ctx.pos={
			"x":q.x,
			"y":q.y
		};
		//cgi.setup(q);
		let bpos=(((q.w)/4));
		//console.log(q.w/4);
		//console.log(calc);
		q.ctx.moveTo(q.x,(q.y+(q.h/2)));
		q.ctx.beginPath();
		//q.ctx.moveTo(q.x,q.y);
		q.ctx.moveTo(q.x,(q.y+(q.h/2)));
		q.ctx.lineTo(q.x+bpos,q.y);
		q.ctx.lineTo(q.x+(bpos*3),q.y);
		
		//console.log(q.x);
		
		q.ctx.lineTo(q.x+q.w,q.y+(q.h/2));
		q.ctx.lineTo(q.x+(bpos*3),q.y+q.h);
		q.ctx.lineTo(q.x+bpos,q.y+q.h);
		q.ctx.lineTo(q.x,(q.y+(q.h/2)));
		
		q.ctx.lineTo(q.x,q.y+q.h);
		/*
		q.ctx.lineTo(q.x+q.w,q.y+q.h);
		q.ctx.lineTo(q.x+q.w,q.y);
		q.ctx.lineTo(q.x,q.y);
		q.ctx.lineTo(q.x,q.y+(q.h/2));
		*/
		
		console.log(`[${q.x}, ${(q.y+(q.h/2))}] [${q.x+bpos}, ${q.y}] [${q.x+(bpos*3)}, ${q.y}] [${q.x+q.w}, ${q.y+(q.h/2)}] [${q.x+(bpos*3)}, ${q.y+q.h}] [${q.x+bpos}, ${q.y+q.h}] [${q.x}, ${(q.y+(q.h/2))}] [${q.x}, ${q.y+q.h}]`);
		
		
		q.ctx.closePath();
		q.ctx.clip();
		cgi.setup(q);
		cgi.fin(q);
		//q.ctx.restore();
	}
	
	// Generates a octogon.
	static octogon(q=false) {
		/*
		if (cgi.saved===false) {
			q.ctx.save();
			cgi.saved=true;
		}
		*/
		q.ctx.save();
		q.ctx.pos={
			"x":q.x,
			"y":q.y
		};
		//cgi.setup(q);
		let bpos=(((q.w)/4));
		//console.log(q.w/4);
		//console.log(calc);
		q.ctx.moveTo(q.x,(q.y+(q.h/2)));
		q.ctx.beginPath();
		//q.ctx.moveTo(q.x,q.y);
		q.ctx.moveTo(q.x,(q.y+(q.h/2)));
		q.ctx.lineTo(q.x+bpos,q.y);
		q.ctx.lineTo(q.x+(bpos*3),q.y);
		
		//console.log(q.x);
		
		q.ctx.lineTo(q.x+q.w,q.y+(q.h/2));
		q.ctx.lineTo(q.x+(bpos*3),q.y+q.h);
		q.ctx.lineTo(q.x+bpos,q.y+q.h);
		q.ctx.lineTo(q.x,(q.y+(q.h/2)));
		
		q.ctx.lineTo(q.x,q.y+q.h);
		/*
		q.ctx.lineTo(q.x+q.w,q.y+q.h);
		q.ctx.lineTo(q.x+q.w,q.y);
		q.ctx.lineTo(q.x,q.y);
		q.ctx.lineTo(q.x,q.y+(q.h/2));
		*/
		q.ctx.closePath();
		q.ctx.clip();
		cgi.setup(q);
		cgi.fin(q);
		//q.ctx.restore();
	}
	
	
	
	
	
	static clear(q){q.ctx.clearRect(0,0,q.w,q.h);}
	
	static fin(q=false) {
		q.ctx.restore();
		if (q.shape==="line") {
			q.ctx.stroke();
		} else {
			//q.ctx.fillRect(q.x,q.y,q.w,q.h);
			//q.ctx.filleStyle="rgba(0,0,0,0.0)";
			//q.ctx.fillStyle="rgba(0,255,0,0.0)";
			//q.ctx.fill();
			//q.ctx.restore();
			//q.ctx.stroke();
		}
		//q.ctx.restore();
		//console.log("Image rendering complete.");
		//console.log(q);
	}
	
	// Sets up the beginning phase of the object generation process.
	static setup(q=false) {
		/*
		if (cgi.saved===false) {
			q.ctx.save();
			cgi.saved=true;
			console.log("SAVED");
		}
		*/
		//q.ctx.save();
		//console.log(q);
		q.ctx.moveTo(q.x,q.y);
		if (q.fill!==false) {
			q.ctx.fillStyle=cgi.getColor(q.fill,q);
			if (q.shape!=="line") {
				q.ctx.fillRect(q.x,q.y,q.w,q.h);
				
			}
		}
		if (q["border-color"]) {
			q.ctx.strokeStyle=cgi.getColor(q["border-color"],q);
		}
		if ((typeof q["border-width"])==="number") {
			q.ctx.lineWidth=q["border-width"];
		}
		//console.log(q);
	}
	// Returns the color...
	static getColor(q=false,ctx=false) {
		let res="";
		// gradient(
		if (q.indexOf("linear-gradient")!=-1) {
			let g=ctx.ctx.createLinearGradient(ctx.data.gradient.x+(ctx.data.width/2),ctx.data.gradient.y+(ctx.data.height/2),ctx.data.gradient.width,ctx.data.gradient.height);
			let i=0;
			let lim=ctx.data.gradient.colors.length;
			let sel=false;
			while(i<lim){
				if (ctx.data.gradient.colors[i]) {
					sel=ctx.data.gradient.colors[i];
					g.addColorStop(i,sel);
				}
				i++;
			}
			res=g;
		} else if (q.indexOf("radial-gradient")!=-1) {
			//console.log(Math.floor(ctx.data.gradient.x+(ctx.data.width/2)));
			/*
			let g=ctx.ctx.createRadialGradient(Math.floor(ctx.data.gradient.x+(ctx.data.width/2)),
											   Math.floor(ctx.data.gradient.y+(ctx.data.height/2)),
											   0,
											   Math.floor(ctx.data.gradient.width),
											   Math.floor(ctx.data.gradient.height),
											   100);
			*/
			//console.log(ctx);
			let g=ctx.ctx.createRadialGradient(ctx.x+(ctx.data.width/2),ctx.y+(ctx.data.height/2),0,ctx.x+ctx.data.width,ctx.y+ctx.data.height,155);
			let i=0;
			let lim=ctx.data.gradient.colors.length;
			let sel=false;
			while(i<lim){
				if (ctx.data.gradient.colors[i]) {
					sel=ctx.data.gradient.colors[i];
					g.addColorStop(i,sel);
				}
				i++;
			}
			res=g;
		} else {
			res=q;
		}
		return res;
	}
	
	
	
}








