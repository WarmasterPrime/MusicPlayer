
class gpu {
	
	static ini_complete=false;
	static client={
		"screen":{
			"width":window.innerWidth,
			"height":window.innerHeight
		},
		"display":{
			"elm":false,
			"element":function(){return gpu.localGetElm()},
			"ctx":false,
			"mode":"2d"
		}
	};
	
	static ini(elm=false) {
		if (elm!=false) {
			gpu.setElement(elm);
			//console.log(elm);
		}
		if (gpu.ini_complete===false) {
			gpu.install();
		}
	}
	// Performs installation process.
	static install() {
		gpu.setupEventListeners();
		gpu.getContext();
	}
	// Installs event listeners.
	static setupEventListeners() {
		window.addEventListener("resize",function(){
			gpu.client.screen.width=window.innerWidth;
			gpu.client.screen.height=window.innerHeight;
			gpu.updateDisplaySize();
		});
	}
	// Updates the client's browser display size.
	static updateDisplaySize() {
		if (gpu.client.display.elm!==false) {
			gpu.client.display.elm.width=gpu.client.screen.width;
			gpu.client.display.elm.height=gpu.client.screen.height;
		}
	}
	// Sets the width of the display element.
	static setWidth(size=false) {
		if ((typeof size)==="number") {
			if (size>=0) {
				gpu.client.screen.width=size;
			}
		}
	}
	// Sets the height of the display element.
	static setHeight(size=false) {
		if ((typeof size)==="number") {
			if (size>=0) {
				gpu.client.screen.height=size;
			}
		}
	}
	// Sets the display element.
	static setElement(parent_element=false) {
		let t=this.is_element(parent_element);
		let res=false;
		if (t===true) {
			gpu.client.display.elm=parent_element;
			res=true;
		}
		return res;
	}
	// Returns true if parameter is an element.
	static is_element(q=false) {
		let res=false;
		let t=(typeof q);
		if (t==="object" || t==="element") {
			let tmp=false;
			try{
				tmp=q instanceof HTMLElement;
			}catch{}
			res=tmp;
		}
		return res;
	}
	// Creates a canvas context instance.
	static getContext() {
		if (gpu.client.display.elm!==false) {
			if (gpu.client.display.ctx===false) {
				gpu.client.display.ctx=gpu.client.display.elm.getContext(gpu.client.display.mode);
			}
		}
	}
	
	// Determines what graphic to generate.
	static create(q=false) {
		let res=false;
		if (this.is_array(q)) {
			let shape=this.getShape(q);
			let obj={
				"shape":shape,
				"x":this.getX(q),
				"y":this.getY(q),
				"w":this.getW(q),
				"h":this.getH(q),
				"ctx":gpu.client.display.ctx,
				"elm":gpu.client.display.elm,
				"fill":this.getFill(q),
				"border-color":this.getBC(q),
				"border-size":this.getBS(q),
				"data":q
			};
			//let x=this.getX(q);
			//let y=this.getY(q);
			//let w=this.getW(q);
			//let h=this.getH(q);
			if (shape==="line") {
				cgi.line(obj);
			} else if (shape==="triangle") {
				cgi.triangle(obj);
			} else if (shape==="box") {
				cgi.box(obj);
			} else if (shape==="hexagon") {
				cgi.hexagon(obj);
			} else if (shape==="pentagon") {
				cgi.pentagon(obj);
			}
		}
		return res;
	}
	
	
	
	// Returns the border color.
	static getBC(q=false) {
		let res=false;
		if (this.is_array(q)) {
			if (q["border-color"]) {
				if ((typeof q["border-color"])==="string") {
					res=q["border-color"].toLowerCase();
				}
			}
		}
		return res;
	}
	// Returns the border size.
	static getBS(q=false) {
		let res=false;
		if (this.is_array(q)) {
			if (q["border-size"]) {
				if ((typeof q["border-size"])==="string") {
					q["border-size"]=parseFloat(q["border-size"]);
				}
				if ((typeof q["x"])==="number") {
					res=q["border-size"];
				}
			}
		}
		return res;
	}
	// Returns the fill color.
	static getFill(q=false) {
		let res=false;
		if (this.is_array(q)) {
			if (q["fill"]||q["color"]||q["background-color"]||q["background"]) {
				let sel=q["fill"]||q["color"]||q["background-color"]||q["background"];
				if ((typeof sel)==="string") {
					res=sel.toLowerCase();
				}
			}
		}
		return res;
	}
	// Returns the shape name.
	static getShape(q=false) {
		let res=false;
		if (this.is_array(q)) {
			if (q["shape"]) {
				if ((typeof q["shape"])==="string") {
					res=q["shape"].toLowerCase();
				}
			}
		}
		return res;
	}
	// Returns the x position for the object.
	static getX(q=false) {
		let res=0;
		if (this.is_array(q)) {
			if (q["x"]) {
				if ((typeof q["x"])==="string") {
					q["x"]=parseFloat(q["x"]);
				}
				if ((typeof q["x"])==="number" || q["x"]===0 || q["x"]===1) {
					res=q["x"];
				}
			}
		}
		return res;
	}
	// Returns the y position for the object.
	static getY(q=false) {
		let res=0;
		if (this.is_array(q)) {
			if (q["y"]) {
				if ((typeof q["y"])==="string") {
					q["y"]=parseFloat(q["y"]);
				}
				if ((typeof q["y"])==="number" || q["y"]===0 || q["y"]===1) {
					res=q["y"];
				}
			}
		}
		return res;
	}
	// Returns the width of the object.
	static getW(q=false) {
		let res=0;
		if (this.is_array(q)) {
			if (q["width"]) {
				if ((typeof q["width"])==="string") {
					q["width"]=parseFloat(q["width"]);
				}
				if ((typeof q["width"])==="number") {
					res=q["width"];
				}
			}
		}
		return res;
	}
	// Returns the height of the object.
	static getH(q=false) {
		let res=0;
		if (this.is_array(q)) {
			if (q["height"]) {
				if ((typeof q["height"])==="string") {
					q["height"]=parseFloat(q["height"]);
				}
				if ((typeof q["height"])==="number") {
					res=q["height"];
				}
			}
		}
		return res;
	}
	// Returns true if parameter is an array.
	static is_array(q=false) {
		let res=false;
		let t=(typeof q);
		if (t==="array"||t==="object") {
			res=true;
		}
		return res;
	}
	
	// Local function that returns the element...
	static localGetElm(){return gpu.client["display"]["elm"];}
	
	
	
}

























