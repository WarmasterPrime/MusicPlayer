<?php

class VSystem {
	
	public static function initialize() {
		$classes = get_declared_classes();
		foreach($classes as $sel) {
			$ins = new ReflectionClass($sel);
			$parentClass = $ins->getParentClass();
			$constructor = $ins->getConstructor();
			if(!is_bool($parentClass)) {
				
			}
		}
	}
	
	
	private static function invokesParent($classReflectionObj) {
		$path = $classReflectionObj->getFileName();
		if(is_string($path) && file_exists($path) && filesize($path)>0) {
			$contents = file_get_contents($path);
		}
	}
	
	
	
	
	private static function getMethodSourceCode($data) {
		$res=[];
		if(strstr($data, "function")) {
			
		}
		return $res;
	}
	
}

?>