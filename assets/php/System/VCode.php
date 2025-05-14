<?php

class VCode {
	
	
	function __construct(ReflectionClass $obj) {
		$methods = $obj->getMethods(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE);
		$constructor = $obj->getConstructor();
		if($constructor!==null)
			array_push($methods, $constructor);
		
	}
	
	
	
	
	
}

?>