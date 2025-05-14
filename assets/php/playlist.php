<?php
require_once("A:/wamp64/www/WebRoot/www/files/WebAssets/php/db.php");
class playlist {
	// Returns an array of playlists.
	public static function getPlaylists() {
		$res=array();
		$tmp=playlist::checkUser();
		$pl=false;
		if ($tmp!==0x00 && is_array($tmp)) {
			$pl=playlist::parse_json($tmp);
			if (is_array($pl)) {
				$res=$pl;
			}
		}
		unset($tmp,$pl);
		return $res;
	}
	// Returns an array of songs within a given playlist.
	public static function getSongs($q=false) {
		$res=array();
		$c=false;
		$a=false;
		$w=false;
		$r=false;
		if (is_string($q)) {
			$c=array(
				"action"=>"select",
				"*"
			);
			$w=array(
				"playlist_id"=>$q
			);
			$a=array(
				"db"=>"musicplayer",
				"tb"=>"playlist",
				"cmd"=>$c,
				"where"=>$w
			);
			$r=db::connect($a);
			if (playlist::checkRes($r)===0x01) {
				$res=$r;
			}
		}
		unset($q,$c,$a,$w,$r);
		return $res;
	}
	// Returns the song data from a specified song id.
	public static function getSong($q=false) {
		$res=array();
		$c=false;
		$a=false;
		$w=false;
		$r=false;
		if (is_string($q)) {
			$c=array(
				"action"=>"select",
				"*"
			);
			$w=array(
				"db"=>"musicplayer",
				"tb"=>"songs",
				"cmd"=>$c,
				"where"=>$w
			);
			$r=db::connect($a);
			if (playlist::checkRes($r)===0x01) {
				$res=$r[0];
			}
		}
		unset($q,$c,$a,$w,$r);
		return $res;
	}
	// Returns a parsed PHP array or false.
	private static function parse_json($q=false) {
		$res=false;
		try{
			$res=json_decode($q,true);
		}catch(Exception $e){}
		return $res;
	}
	
	private static function checkUser() {
		$res=playlist::hasCookie();
		if (!is_array($res)) {
			$res=0x00;
		}
		return $res;
	}
	
	private static function hasCookie() {
		$res=0x0000;
		$obj=false;
		//$tmp=false;
		//$acc=false;
		//$pl=false;
		if (isset($_COOKIE[$_SERVER["HTTP_HOST"] . "-authentication"])) {
			try{
				$obj=json_decode($_COOKIE["HTTP_HOST"] . "-authentication",true);
				$res=0x0001;
			}catch(Exception $e){
				$res=0x0000;
			}
			if ($res===0x0001) {
				if (isset($obj["username"]) && isset($obj["password"])) {
					$res=playlist::checkAuthKey($obj["key"]);
					/*
					if (is_array($acc)) {
						if (isset($acc["playlist"])) {
							try{
								$pl=json_decode($acc["playlist"],true);
							}catch(Exception $e){}
							if (is_array($pl)) {
								//
							} else {
								$res=0x2000;
							}
						}
					}
					*/
				} else {
					$res=0x1000;
				}
			}
		}
		unset($obj);
		return $res;
	}
	
	private static function checkDb() {
		$c=array(
			"action"=>"db_tb_exist_auto",
			"uid"=>"string",
			"username"=>"string",
			"password"=>"string",
			"algo"=>"string",
			"playlists"=>"string"
		);
		$a=array(
			"db"=>"musicplayer",
			"tb"=>"accounts",
			"cmd"=>$c
		);
		db::connect($a);
		$c=array(
			"action"=>"db_tb_exist_auto",
			"playlist_id"=>"string",
			"title"=>"string",
			"songs"=>"string",
			"length"=>"int"
		);
		$a["tb"]="playlists";
		$a["cmd"]=$c;
		db::connect($a);
		$c=array(
			"action"=>"db_tb_exist_auto",
			"song_id"=>"string",
			"title"=>"string",
			"path"=>"string",
			"type"=>"string"
		);
		$a["tb"]="songs";
		$a["cmd"]=$c;
		db::connect($a);
		$c=array(
			"action"=>"db_tb_exist_auto",
			"song_id"=>"string",
			"data"=>"blob"
		);
		$a["tb"]="song_data";
		$a["cmd"]=$c;
		db::connect($a);
	}
	
	private static function checkRes($q=false) {
		$res=0x00;
		if (isset($q)) {
			if ($q!==false) {
				if (is_array($q)) {
					if (count($q)>0) {
						$res=0x01;
					} else {
						$res=0x10;
					}
				} else {
					$res=0x00;
				}
			} else {
				$res=0x11;
			}
		}
		unset($q);
		return $res;
	}
	
	private static function checkAuthKey($q=false) {
		$res=0x00;
		playlist::checkDb();
		$c=array(
			"action"=>"select",
			"*"
		);
		$w=array(
			"username"=>$q["username"]
		);
		$a=array(
			"db"=>"musicplayer",
			"tb"=>"accounts",
			"cmd"=>$c,
			"where"=>$w
		);
		$r=db::connect($a);
		if (playlist::checkRes($r)===0x01) {
			if ($r[0]["algo"]) {
				$w["password"]=hash($r[0]["algo"],$q["password"]);
				$a["where"]=$w;
				$r=db::connect($a);
				if (playlist::checkRes($r)===0x01) {
					$res=$r[0];
				} else {
					$res=0x10;
				}
			} else {
				$res=0x11;
			}
		}
		unset($q,$c,$w,$a,$r);
		return $res;
	}
	
	
	
}






























?>