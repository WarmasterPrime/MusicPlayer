<?php

class KeyValuePair {
    
    private $_key;
    private $_value;
    
    public function __get($key) {
        if($key==="key")
            return $this->_key;
        else if($key==="value")
            return $this->_value;
        return null;
    }
    
    public function __construct($key, $value) {
        $this->_key=$key;
        $this->_value=$value;
    }
    
}

?>