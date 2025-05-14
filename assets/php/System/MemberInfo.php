<?php

class MemberInfo {
    
    private $items=array();
    /**
     * Gets the member by the given name.
     */
    public function __get($name) {
        $info=$this->getMemberByName($name);
        $callerObj=MemberInfo::getCaller();
        if($info!==null && MemberInfo::isAccessible($info, $callerObj))
            return $info["isProperty"] ? $this->$name : $this->$name();
        return null;
    }
    
    public function __construct() {
        $this->items=$this->getMembers();
    }
    /**
     * Determines if the requested member is accessible or not.
     * @param array $info The requested member's info object.
     * @param array $callerObject The caller object.
     * @return bool
     */
    private static function isAccessible($info, $callerObject) {
        if($info["isPublic"])
            return true;
        else if(isset($callerObject["class"])) {
            if($info["className"]===$callerObject["class"] && $info["isPrivate"])
                return true;
            $rc=new ReflectionClass($callerObject["class"]);
            if($rc->isInstance($info["className"]) && $info["isProtected"])
                return true;
        }
        return false;
    }
    
    /**
     * Gets all of the members associated with the class.
     * @return array
     */
    protected function getMembers() {
        $ins=new ReflectionObject($this);
        $list=array_merge($this->getMethods(), $this->getProperties());
        return $list;
    }
    /**
     * Gets the member info from the given name.
     * @param string $name The name of the member.
     * @return array
     */
    protected function getMemberByName($name) {
        foreach($this->items as $sel)
            if($sel["name"]===$name)
                return $sel;
        return null;
    }
    /**
     * Determines if the member name exists.
     * @param string $name The name of the member.
     * @return bool
     */
    protected function memberNameExists($name) {
        return $this->getMemberByName($name)!==null;
    }
    /**
     * Gets the calling function/method that called the method this method was invoked in.
     * @return array
     */
    protected static function getCaller() {
        $list=debug_backtrace();
        return $list[2];
    }
    
    protected function getMethods() {
        $ins=new ReflectionObject($this);
        $res=array();
        foreach($ins->getMethods() as $sel) {
            array_push($res, MemberInfo::prepareInfoObject($sel));
        }
        return $res;
    }
    
    protected function getProperties() {
        $ins=new ReflectionObject($this);
        $res=array();
        foreach($ins->getProperties() as $sel)
            array_push($res, MemberInfo::prepareInfoObject($sel));
        return $res;
    }
    
    private static function prepareInfoObject($instance) {
        $name=$instance->name;
        $className=$instance->class;
        $isMethod=$instance instanceof ReflectionMethod;
        $rm=$isMethod ? new ReflectionMethod($className, $name) : new ReflectionProperty($className, $name);
        return array(
            "name"=>$name,
            "class"=>$className,
            "modifiers"=>Reflection::getModifierNames($rm->getModifiers()),
            "reflectionMethod"=>$rm,
            "type"=>!$isMethod ? $rm->getType() : null,
            "isMethod"=>$isMethod,
            "isProperty"=>$rm instanceof ReflectionProperty,
            "isPrivate"=>$rm->isPrivate(),
            "isProtected"=>$rm->isProtected(),
            "isPublic"=>$rm->isPublic(),
            "isReadOnly"=>$isMethod ? $rm->isFinal() : $rm->isReadOnly(),
            "isStatic"=>$rm->isStatic()
        );
    }
    
}

?>