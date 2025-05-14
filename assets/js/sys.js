
class sys {
	
	static current_speed=60;
	static enabled=false;
	static can_move=true;
	
	static setSpeed(q=60) {
		if (sys.enabled) {
			if ((typeof q)==="number") {
				if (q!==sys.current_speed) {
					//document.getElementById("overrides").innerHTML=":root{--bg-dur-:"+q+"s;}";
					sys.current_speed=q;
				}
			}
		}
	}
	static resetSpeed() {
		if (sys.enabled) {
			if (sys.current_speed!==60) {
				//document.getElementById("overrides").innerHTML=":root{--bg-dur-:60s;}";
				sys.current_speed=60;
			}
		}
	}
	
	static newLocation() {
		//if (sys.can_move) {
			moveBG();
			//sys.can_move=false;
			//setTimeout(function(){sys.can_move=true;},100);
		//}
	}
	
	
}

