<?php

require_once("AccessorInfo.php");

class VObject {
	
	protected $staticProperties = [];
	protected $properties = [];
	protected $methods = [];
	protected $staticMethods = [];
	protected $reflectionObject;
	
	
	public function __construct() {
		$this->reflectionObject = new ReflectionClass($this);
		
		var_dump($this->reflectionObject);
		$this->properties = self::getProperties($this->reflectionObject);
		//$this->staticProperties = self::getStaticProperties($this->reflectionObject);
		$this->methods = self::getMethods($this->reflectionObject);
		//$this->staticMethods = self::getStaticMethods($this->reflectionObject);
	}
	
	public function __get(string $name) {
		if(array_key_exists($name, $this->properties)) {
			return $this->properties[$name];
		}
		throw new Exception("The given property name \"" . $name . "\" does not exist.");
	}
	
	public function __set(string $name, $value) {
		if(array_key_exists($name, $this->properties)) {
			$this->properties[$name] = $value;
		} else {
			throw new Exception("The given property name \"" . $name . "\" does not exist.");
		}
	}
	
	public function getPropertyNames(): array {
		return array_keys($this->properties);
	}
	
	public function getMethodNames(): array {
		return $this->methods;
	}
	
	protected static function getProperties($obj) {
		$res = [];
		foreach($obj->getProperties(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE) as $sel)
			array_push($res, self::getAccessorInfo($sel));
		return $res;
	}
	
	protected static function getStaticProperties($obj) {
		$res = [];
		foreach($obj->getProperties(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE | ReflectionProperty::Is_STATIC) as $sel)
			array_push($res, self::getAccessorInfo($sel));
		return $res;
	}
	
	protected static function getMethods($obj) {
		$res = [];
		foreach($obj->getMethods(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE) as $sel)
			array_push($res, self::getAccessorInfo($sel));
		return $res;
	}
	
	protected static function getStaticMethods($obj) {
		$res = [];
		foreach($obj->getMethods(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE | ReflectionProperty::Is_STATIC) as $sel)
			array_push($res, self::getAccessorInfo($sel));
		return $res;
	}
	
	protected static function getAccessorInfo($obj) {
		$type = get_class($obj);
		$name = $obj->name;
		$classObj = $obj->class;
		//var_dump($type === "ReflectionProperty");
		if($type === "ReflectionProperty") {
			return new AccessorInfo(new ReflectionProperty($classObj, $name));
		} else if($type === "ReflectionMethod") {
			return new AccessorInfo(new ReflectionMethod($classObj, $name));
		}
	}
	
}

?>