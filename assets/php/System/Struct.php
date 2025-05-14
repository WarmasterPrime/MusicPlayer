<?php

require_once("KeyValuePair.php");

class Struct {
	
	private $items=array();
	
	public function __get($key) {
		return array_key_exists($key, $this->items) ? $this->items[$key] : null;
	}
	
	
	public function __construct() {
		for($i=0;$i<func_num_args();$i++) {
			$sel=func_get_arg($i);
			if($sel instanceof KeyValuePair)
				$this->items[$sel->key]=$sel->value;
		}
	}
	/**
	 * Gets the string representation of the variable name.
	 * @param mixed The variable to obtain the name of.
	 * @return string
	 */
	protected static function getVarName($var) {
		foreach($GLOBALS as $var_name => $value)
			if($value===$var)
				return $var_name;
		return null;
	}
	
	/**
	 * Determines if the property name exists for this instance of the structured object.
	 * @param string $name The name of the property to check.
	 * @return bool
	 */
	protected function propExists($name) {
		return is_string($name) && property_exists($this, $name);
	}
	
}

?>