<?php

class VProcess {
	
	private $path=null;
	
	function __construct($path) {
		if(file_exists($path) && is_file($path))
			$this->path = $path;
	}
	
	public function run() {
		if($this->path!==null) {
			$output=null;
			$result = exec("\"" . $this->path . "\"", $output);
			return array(
				"result"=>$result,
				"output"=>$output
			);
		}
	}
	
}

?>