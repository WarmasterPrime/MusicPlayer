


setTimeout(function(){return ini();},100);
var GV_Pl=false;
var GV_i=0;
var GV_player_md=false;

var player=new Player(document.getElementById("player"), document.getElementById("caption"), document.getElementById("head"), document.getElementById("song-name"));

function ini()
{
	if((typeof Server)!=="undefined")
	{
		let obj=UrlParams.GetParams();
		setupListeners();
		initial();
		checkSong();
		setColorsFromUrl(obj);
		
		document.getElementById("r").addEventListener("change",function()
		{
			saveColorToParam();
			//setTimeout(function(){UrlParams.SetParam("r",Visual.color.red.toString());},10);
		});
		document.getElementById("g").addEventListener("change",function()
		{
			saveColorToParam();
			//setTimeout(function(){UrlParams.SetParam("g",Visual.color.green.toString());},10);
		});
		document.getElementById("b").addEventListener("change",function()
		{
			saveColorToParam();
			//setTimeout(function(){UrlParams.SetParam("b",Visual.color.blue.toString());},10);
		});
		
	}
	else
	{
		GV_i++;
		setTimeout(function(){ini();},10);
	}
}

function initial()
{
	var elm,temp;
	if(document.getElementById("player"))
	{
		audioLib.ini();
		let t=false;
		let p=true;
		try
		{
			t=(typeof window.navigator.userAgent);
		}
		catch(e)
		{
			t=true;
			p=false;
		}
		p=!(t==="undefined" || t==="null" || t==="string");
		p=window.navigator.userAgent.indexOf("OBS/")==-1;
		//document.getElementById("song-name").innerHTML="UserAgent: "+window.navigator.userAgent;
		if(!p)
		{
			data=(typeof window.navigator.userAgent);
			document.getElementById("bg-hide").hidden=false;
			document.getElementById("bg-hide-opt").checked=true;
			toggleBg(document.getElementById("bg-hide-opt"));
		}
		elm=document.getElementById("player");
		var telm=document.createElement("canvas");
		telm.id="visualizer";
		document.getElementById("media").appendChild(telm);
		elm.addEventListener("play",function(){return startAudio();});
		document.getElementById("visualizer").addEventListener("dblclick",function()
		{
			audioLib.selectSong(true);
		});
		//player=new Player(document.getElementById("player"), document.getElementById("caption"), document.getElementById("head"));
		setTimeout(function(){player.updateHead();},0);
	}
	else
		document.getElementById("song-name").innerHTML="FAILED";
	audioLib.getItems();
	//Visual.ini();
}


function saveColorToParam()
{
	UrlParams.SetParam("r",Visual.color.red.toString());
	UrlParams.SetParam("g",Visual.color.green.toString());
	UrlParams.SetParam("b",Visual.color.blue.toString());
}

function setColorsFromUrl(obj)
{
	if(obj["r"])
	{
		Visual.color.red=parseFloat(obj["r"]);
		document.getElementById("r").value=Visual.color.red*100;
	}
	if(obj["g"])
	{
		Visual.color.green=parseFloat(obj["g"]);
		document.getElementById("g").value=Visual.color.green*100;
	}
	if(obj["b"])
	{
		Visual.color.blue=parseFloat(obj["b"]);
		document.getElementById("b").value=Visual.color.blue*100;
	}
	Visual.updateColor();
}

// http://doft.ddns.net/musicplayer/#/genres/EDM/Vicetone/Vicetone%20-%20Angels%20(Radio%20Edit).mp3
function checkSong()
{
	if(window.location.hash && (typeof window.location.hash)==="string" && window.location.hash.length>0)
	{
		//let q=window.location.hash.substring(1,window.location.hash.length);
		let obj=UrlParams.GetParams();
		if(!(Object.keys(obj).length>0))
		{
			window.location.hash="song="+window.location.hash.substring(1);
			obj=UrlParams.GetParams();
		}
		if(Object.keys(obj).length>0)
		{
			let q=obj["song"];
			if(q.includes(window.location.hostname))
				q=q.replace(/[A-z\.\_\/\-\:]+Music/i,"");
			q=decodeURI(q);
			if(q.substring(0,1)==="/")
				q=q.substring(1,q.length);
			if(q.substring(q.length-1,q.length)==="/")
				q=q.substring(0,q.length-1);
			let tmp=q.substring(q.length-5,q.length);
			if(tmp.includes(".mp3") || tmp.includes(".m4a") || tmp.includes("mp4"))
				player.play(q);
			else
				player.select(q);
			if(obj["hideSongName"]!==undefined) {
				document.getElementById("song-name").hidden=obj["hideSongName"]==="false" ? false : true;
			}
			if(obj["hideBar"]!==undefined) {
				document.getElementById("bar").style.opacity=obj["hideBar"]==="false" ? 1 : 0;
			}
			if(obj["delay"]!==undefined) {
				setTimeout(function(){player.play(undefined, true);}, parseFloat(obj["delay"]));
			}
			if(obj["shuffle"]!==undefined) {
				let elm=document.getElementById("player");
				let tmp=document.getElementById("shuffle-opt");
				tmp.checked=true;
				if(tmp.checked)
				{
					elm.loop=false;
					if (elm.paused)
						player.selectSong();
				}
				else
					elm.loop=true;
			}
			if(obj["loop"]!==undefined) {
				document.getElementById("player").loop=obj["loop"]==="false" ? false : true;
			}
		}
		//else
			//window.location.hash="song="+window.location.hash.substring(1);
	}
}

function setupListeners()
{
	let list=document.querySelectorAll("span.item");
	for(let i=0;i<list.length;i++)
	{
		if(list[i].classList.contains("item") && list[i].getAttribute("type")!=="file")
			list[i].setAttribute("onclick","procItem(this)");
	}
	setupAudioPlay();
}

function setupAudioPlay()
{
	if(document.getElementById("player"))
	{
		let elm=document.getElementById("player");
		elm.addEventListener("play",function()
		{
			setSongHash();
		});
	}
}

function setSongHash() {
	if(document.getElementById("player"))
	{
		let elm=document.getElementById("player");
		let q=elm.src;
		//if (q.indexOf("doft.ddns.net")!=-1)
		//	q=q.replace(/[A-z\.\_\/\-\:]+Music/i,"");
		q=encodeURI(decodeURI(q));
		UrlParams.SetParam("song",q);
		//window.location.hash=q;
	}
}

function setDesignHash(value) {
	if(typeof(value)==="string")
		UrlParams.SetParam("design", value);
}

function playSong()
{
	if(document.getElementById("play-state"))
	{
		let elm=document.getElementById("play-state");
		if(elm.classList.contains("play"))
		{
			elm.classList.remove("play");
			elm.classList.add("pause");
		}
		else if(elm.classList.contains("pause"))
		{
			elm.classList.remove("pause");
			elm.classList.add("play");
		}
	}
}

function setupSeek() {
	if(document.getElementById("thumb"))
	{
		window.addEventListener("mouseup",function()
		{
			GV_player_md=false;
		});
		window.addEventListener("mousedown",function(event)
		{
			if((typeof event.target)!=="undefined" && (typeof event.target.id)==="string")
				GV_player_md=true;
		});
		window.addEventListener("mousemove",function(event)
		{
			if (GV_player_md)
			{
				let elm=document.getElementById("seekbar");
				let part_1=(window.innerWidth-(window.innerWidth-elm.offsetLeft));
				let x=(((event.clientX-(part_1*1.5))/elm.offsetWidth)*10000)/100;
				let part_2=(event.clientX-elm.offsetLeft);
				let max=100-(((elm.offsetLeft-5)/elm.offsetWidth)*100);
				if (x<max && x>0)
				{
					GV_ph_pos=(x/max)*100;
					document.getElementById("thumb").style.left=x+"%";
				}
			}
		});
	} else {
		setTimeout(function(){setupSeek();},100);
	}
}

var GV_NewBG_State=true;

function toggleNewBG(elm=false)
{
	if (document.getElementById("main-before"))
		document.getElementById("main-before").style.display=elm.checked ? "block" : "none";
}
function toggleSphere(elm=false)
{
	if (document.getElementById("obj"))
	{
		let e=document.getElementById("obj");
		if(elm.checked)
		{
			e.style.display="block";
			GV_NewBG_State=true;
		}
		else
		{
			e.style.display="none";
			GV_NewBG_State=false;
		}
	}
}

function procItem(elm=false)
{
	if(elm!==undefined && elm instanceof HTMLElement && elm.getElementsByTagName("input").length>0)
		elm.getElementsByTagName("input")[0].click();
}

function svrResp(q=false)
{
	document.getElementById("song-name").innerHTML=q;
}

function getObjData(q=false)
{
	let res="{}";
	let item="";
	let value="";
	let data="";
	let list=[
		"history",
		"self",
		"location",
		"customElements",
		"locationbar",
		"menubar",
		"personalbar",
		"scrollbars",
		"statusbar",
		"toolbar",
		"status",
		"closed",
		"iframes",
		"name",
		"document",
		"frames",
		"length",
		"top",
		"opener",
		"parent"
	];
	list=[];
	res=q;
	return res;
}

function toggleBg(elm=false)
{
	if(elm!==false)
	{
		let d=document.querySelector("html, body, .bg, .bg-000, .display, .display-000, .main-container");
		if (elm.checked)
		{
			let sty="box-shadow:unset !important;background:transparent !important;background-color:transparent !important;";
			d.style=sty
			document.querySelector(".main-container").hidden=true;
		}
		else
		{
			d.style="";
			document.querySelector(".main-container").hidden=false;
		}
	}
}

function toggleShuffle(q=false)
{
	let elm=document.getElementById("player");
	if(q.checked)
	{
		elm.loop=false;
		if (elm.paused)
			player.selectSong();
			//audioLib.selectSong();
	}
	else
		elm.loop=true;
}

function selectingSong(q=false)
{
	//audioLib.play(q);
	player.source=q;
	player.play();
}

function toggleSn(q=false)
{
	const state=!q.checked;
	document.getElementById("song-name").hidden=state;
	UrlParams.SetParam("hideSongName", state);
}



function loadBg()
{
	/*
	try {
		//elm.load();
		//elm.play();
	}catch(e){
		setTimeout(function(){loadBg();},100);
	}
	*/
}

function startAudio()
{
	let list=document.getElementsByTagName("canvas");
	if(list.length>0)
		list[0].focus();
	setTimeout(function(){player.updateHead();},0);
	Visual.render();
	/*
	elm=document.getElementById("player");
	if(document.getElementsByTagName("canvas").length>0)
		document.getElementsByTagName("canvas")[0].focus();
	setTimeout(function(){updateHead();},0);
	Visual.render();
	*/
}

var GV_colorStorage={
	"r":2,
	"g":0,
	"b":0.55
};

function toggleSongLyrics(elm=false) {
	Visual.lyricsEnabled=elm.checked;
	document.getElementById("caption").style.opacity=elm.checked ? 1 : 0;
}

function toggleBar(q = false) {
	const state = !q.checked;
	if (Visual.progressBar) {
		Visual.progressBar.setVisible(!state);
	}
	UrlParams.SetParam("hideBar", state);
}

function toggleFade(elm = false) {
	if (elm.checked === true) {
		GV_colorStorage = {
			"red": Visual.color.red,
			"green": Visual.color.green,
			"blue": Visual.color.blue
		};
		Visual.color.fade = true;
		if (Visual.progressBar) {
			Visual.progressBar.setFadeEffect(true);
		}
	}
	else {
		Visual.color.fade = false;
		if (Visual.progressBar) {
			Visual.progressBar.setFadeEffect(false);
		}
		setTimeout(function () {
			Visual.color["red"] = GV_colorStorage["red"];
			Visual.color["green"] = GV_colorStorage["green"];
			Visual.color["blue"] = GV_colorStorage["blue"];
		}, 100);
	}
}
/*
document.getElementsByTagName("body")[0].addEventListener("keydown",function(event)
{
	let elm=document.getElementById("player");
	if(event.code==="ArrowLeft"||event.code==="ArrowRight")
	{
		if(event.code==="ArrowRight")
			elm.currentTime=elm.currentTime+3;
		else
			elm.currentTime=elm.currentTime-3;
	}
	else if (event.code==="Space")
	{
		if (elm.paused)
		{
			elm.play();
			setTimeout(function(){updateHead();},0);
			Visual.render();
		}
		else
			elm.pause();
	}
	else if(event.code==="ArrowUp")
		document.getElementById("player").volume+=0.01;
	else if(event.code=="ArrowDown")
		document.getElementById("player").volume-=0.01;
});
*/
/*
function updateHead()
{
	let elm=document.getElementById("player");
	if(!elm.paused)
	{
		let start=elm.currentTime;
		let end=elm.duration;
		let stat=((start/end)*100);
		document.getElementById("head").style.width=stat+"%";
		if(stat>99)
		{
			document.getElementById("head").style.transitionDuration="0.5s";
			document.getElementById("head").style.WebKitTransitionDuration="0.5s";
			setTimeout(function(){
				document.getElementById("head").style.transitionDuration="0.0s";
				document.getElementById("head").style.WebKitTransitionDuration="0.0s";
			},500);
		}
		setTimeout(function(){updateHead();},100);
	}
}
*/

