<?php

if (isset($_POST["cmd"])) {
	saveData($_POST["cmd"]);
}

function saveData($q=false) {
	$file=fopen("conf.log");
	fwrite($q);
	fclose($file);
	unset($file);
}

?>