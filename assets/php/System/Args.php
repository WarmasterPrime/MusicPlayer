<?php

class ArgsObject {
	
	public function __get($key) {
		if(isset($_POST[$key]))
			return $_POST[$key];
		if(isset($_GET[$key]))
			return $_GET[$key];
		if(isset($_FILES[$key]))
			return $_FILES[$key];
		return null;
	}
	
}
define("Args", new ArgsObject);

?>