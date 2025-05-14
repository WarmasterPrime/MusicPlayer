<?php

require_once("Music.php");

if (isset($_POST["cmd"])) {
	//print_r(getSong(parse($_POST["cmd"])));
	print_r(Music::getRandomSong($_POST["cmd"]));
} else if (isset($_GET["cmd"])) {
	
	//print_r(getSong(parse($_GET["cmd"])));
	print_r(Music::getRandomSong($_GET["cmd"]));
} else {
	print_r(Music::getRandomSong(""));
}


/*
function parse($q=""){return preg_replace("/([^A-z0-9 \t\n\-\_\+\=\!\@\#\$\%\^\&\*\(\)\~\`\'\"\:;\[\{\]\}\|\?\<\>\,\.\/\\\\]*)/","",$q);}

function getSong($q=false) {
	$res="";
	$dir="A:/wamp64/www/WebRoot/www/files/Music/";
	$path="";
	$i=0;
	$list=scandir($dir);
	$data=array();
	while($i<count($list)){
		if ($list[$i]!=="." && $list[$i]!=="..") {
			$path=$dir.$list[$i];
			if (file_exists($path)) {
				if (is_dir($path))
					$data=array_merge($data,getItems($path."/"));
				else if(strtolower(pathinfo($path)["extension"])==="mp3")
					array_push($data,simp($path));
			}
		}
		$i++;
	}
	$sel=rand(0,count($data));
	if (isset($data[$sel])) {
		$res=$data[$sel];
	} else if (isset($data[$sel-1]))
		$res=$data[$sel-1];
	if (strstr($q,"/"))
		$q=explode("/",$q)[count(explode("/",$q))-1];
	if (parse($res)===$q)
		$res=getSong($q);
	unset($q,$dir,$path,$i);
	return $res;
}

function getItems($q=false) {
	$res=array();
	$list=array();
	$i=0;
	$path="";
	if (is_string($q)) {
		if (file_exists($q)) {
			if (is_dir($q)) {
				$list=scandir($q);
				while($i<count($list)){
					if ($list[$i]!=="." && $list[$i]!=="..") {
						$path=$q.$list[$i];
						if (file_exists($path)) {
							if (is_dir($path)) {
								$res=array_merge($res,getItems($path."/"));
							} else if (is_file($path)) {
								if (strtolower(pathinfo($path)["extension"])==="mp3") {
									array_push($res,simp($path));
								}
							}
						}
					}
					$i++;
				}
			}
		}
	}
	unset($q,$list,$i,$path);
	return $res;
}
function simp($q=false) {
	if (is_string($q)) {
		$q=preg_replace("/(A:\\/wamp64\\/www\\/WebRoot\\/www\\/files\\/Music\\/)/i","",$q);
	}
	return $q;
}
*/
?>