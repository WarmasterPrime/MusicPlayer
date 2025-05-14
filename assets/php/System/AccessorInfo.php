<?php

class AccessorInfo {
	
	public readonly bool $isPublic;
	
	public readonly bool $isProtected;
	
	public readonly bool $isPrivate;
	
	public readonly bool $isStatic;
	
	public readonly bool $isReadonly;
	
	
	
	function __construct($value) {
		$modifierNames = Reflection::getModifierNames($value->getModifiers());
		var_dump($value);
		if(is_subclass_of($value, "ReflectionMethod") || is_subclass_of($value, "ReflectionProperty")) {
			$this->isPublic = $value->isPublic();
			$this->isPrivate = $value->isPrivate();
			$this->isProtected = $value->isProtected();
			$this->isStatic = array_key_exists($modifierNames, "static");
			$this->isReadonly = array_key_exists($modifierNames, "readonly");
		}
	}
	
}

?>