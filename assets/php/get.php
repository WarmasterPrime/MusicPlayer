<?php
require_once("playlist.php");
require_once("parse.php");
if (isset($_POST["cmd"]))
	mgr(parse($_POST["cmd"]));
function mgr($q=false) {
	$res=array();
	$sel=false;
	if (is_string($q)) {
		if ($q==="playlists")
			$res=playlist::getPlaylists();
		else if (isset($_POST["value"])) {
			$sel=parse($_POST["value"]);
			if (strstr($q, "song"))
				$res=playlist::getSongs($sel);
		}
	}
	unset($q,$sel);
	return json_encode($res,true);
}
?>