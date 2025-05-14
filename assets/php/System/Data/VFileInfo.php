<?php

class VFileInfo {
	
	public $extension;
	public $name;
	public $path;
	public $directory;
	public $namespace;
	
	function __construct($projectPath, $path) {
		$projectPath = self::getRealPath($projectPath);
		$path = self::getRealPath($path);
		$info = pathinfo($path);
		if(isset($info["extension"]))
			$this->extension = $info["extension"];
		$this->name = $info["filename"];
		$this->path = realpath($path);
		$this->directory = self::getRealPath($info["dirname"]);
		$this->namespace = preg_replace("/" . addslashes($projectPath) . "/", "", $this->directory);
	}
	
	public function getContents() {
		return file_get_contents($this->path);
	}
	
	public function getDocComment() {
		$file = fopen($this->path, "r");
		$buffer = "";
		$isCommentOpen = false;
		while(!feof($file)) {
			$line = fgets($file);
			if(strlen($line)>0) {
				if(self::isStartComment($line)) {
					$isCommentOpen=true;
					$buffer.=$line;
				}
				if(self::isEndComment($line))
				break;
			}
		}
		if(self::isStartComment($buffer)) {
			$buffer = preg_replace("/\\/\\*\\*/", "", $buffer);
		}
		if(self::isEndComment($buffer)) {
			$buffer = preg_replace("/\\*\\*\\//", "", $buffer);
		}
		return $buffer;
	}
	
	public function toString() {
		return json_encode(array(
			"path"=>$this->path,
			"name"=>$this->name,
			"extension"=>$this->extension,
			"directory"=>$this->directory,
			"namespace"=>$this->namespace
		), true);
	}
	
	private static function isStartComment($line) {
		return strstr($line, "/**");
	}
	
	private static function isEndComment($line) {
		return strstr($line, "**/");
	}
	
	private static function pathCombine($dir, $item) {
		return $dir . (str_ends_with($dir, "\\") ? "" : "\\") . $item;
	}
	
	private static function getRealPath($path) {
		$path=realpath($path);
		if(is_dir($path)) {
			if(!str_ends_with($path, "\\"))
				return $path."\\";
		}
		return $path;
	}
	
}

?>