<?php

require_once("System/Args.php");
require_once("A:/wamp64/www/WebRoot/www/files/WebAssets/php/db.php");

class SongUploader {
	
	public static $shareCodeLength=5;
	
	
	/**
	 * 
	 */
	public function __construct($songName, $songArtist, $songFile) {
		$this->songName=$songName;
		$this->songArtist=$songArtist;
		$this->songFile=$songFile;
		$this->timestamp=time();
		$this->size=$this->songFile["name"];
	}
	
	public function save() {
		$cmd=array(
			"action"=>"insert",
			"songName"=>$this->songName,
			"songArtist"=>$this->songArtist,
			"uploaded"=>time(),
			"size"=>$this->size,
			"shareCode"=>$this->generateShareCode()
		);
	}
	
	private function generateShareCode() {
		$code="";
		for($i=0;$i<SongUploader::$shareCodeLength;$i++) {
			
			
		}
	}
	
	private static function getRandomChar() {
		$rangeSelection=rand(0,3);
		switch($rangeSelection) {
			case 0:
				return chr(rand(48, 57));
			case 1:
				return chr(rand(65, 90));
			default:
				return chr(rand(97, 122));
		}
	}
	
	
}



?>