<?php

//@ini_set("output_buffering", "off");
//@ini_set("zlib.output_compression", false);

header('Content-Type: text/plain');
//header('Transfer-Encoding: chunked');
//header('Connection: keep-alive');

//ob_implicit_flush(true);
//ob_end_flush();

require_once("Data/VFileInfo.php");

class JSLoader {
	
	public $projectPath;
	public $items;
	
	function __construct() {
		$this->projectPath = self::getProjectDirectory();
		//$this->items = self::getAllFiles();
	}
	
	
	public function getAllFiles() {
		return self::scanDir($this->projectPath);
	}
	
	public function asyncGetAllFiles() {
		self::asyncScanDir($this->projectPath);
	}
	
	private function asyncScanDir($path) {
		$path = realpath($path);
		$list = scandir($path);
		$sel = null;
		foreach($list as $sel) {
			if(!($sel==="." || $sel==="..")) {
				$selPath = self::pathCombine($path, $sel);
				if(is_file($selPath) && str_ends_with($selPath, ".js")) {
					sleep(1);
					print_r((new VFileInfo($this->projectPath, $selPath))->toString());
					flush();
					//ob_flush();
					fastcgi_finish_request();
				} else if(is_dir($selPath)) {
					self::scanDir($selPath);
				}
			}
		}
	}
	
	private function scanDir($path) {
		$res=[];
		$path = realpath($path);
		$list = scandir($path);
		$sel = null;
		foreach($list as $sel) {
			if(!($sel==="." || $sel==="..")) {
				$selPath = self::pathCombine($path, $sel);
				if(is_file($selPath) && str_ends_with($selPath, ".js")) {
					array_push($res, new VFileInfo($this->projectPath, $selPath));
				} else if(is_dir($selPath)) {
					$res=array_merge($res, self::scanDir($selPath));
				}
			}
		}
		return $res;
	}
	
	public static function getProjectDirectory() {
		return self::isProjectDir($_SERVER["SCRIPT_FILENAME"]);
	}
	
	private static function isProjectDir($path) {
		$path = realpath($path);
		if(is_file($path))
			$path = realpath(dirname($path));
		if(is_dir($path)) {
			if(self::arrayContains($path, scandir($path), "index"))
				return $path;
			else
				return self::isProjectDir(dirname($path));
		}
	}
	
	private static function arrayContains($parentDir, $array, $value) {
		for($i=0;$i<count($array);$i++) {
			$sel = $parentDir . "\\" . $array[$i];
			if(self::valueEqualsCaseInsensitive($sel, $value))
				return true;
		}
		return false;
	}
	
	private static function valueEqualsCaseInsensitive($a, $b) {
		return strstr(strtolower($a), strtolower($b));
	}
	
	private static function pathCombine($dir, $item) {
		return $dir . (str_ends_with($dir, "\\") ? "" : "\\") . $item;
	}
	
}

$ins = new JSLoader();
$ins->asyncGetAllFiles();


//var_dump($ins);

?>