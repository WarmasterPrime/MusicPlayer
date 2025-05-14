<?php
require_once("A:/wamp64/www/webroot/www/files/webassets/php/db.php");
require_once("A:/wamp64/www/webroot/www/musicplayer/assets/php/SongInfo.php");

class Music {
	
	private static $db="musicplayer";
	private static $tb="songs";
	private static $dir="../lyrics/";
	private static $musicDir="A:/wamp64/www/WebRoot/www/files/Music/";
	
	private static $enforceDatabase=false;
	
	public function __construct($songName, $artist) {
		//if(is_string($songName) && is_string($artist)) {
			//$path=Music::$dir . $artist . "/" . $songName . ".json";
			//return is_file($path) ? file_get_contents($path) : "{}";
		//}
		//return "{}";
	}
	/**
	 * Selects a random song within the music directory.
	 * @param string|bool $q The last song that was received.
	 * @return string
	 */
	public static function getRandomSong($q=false) {
		$res="";
		$dir="A:/wamp64/www/WebRoot/www/files/Music/";
		$path="";
		$list=scandir($dir);
		$data=array();
		for($i=0;$i<count($list);$i++) {
			if($list[$i]!=="." && $list[$i]!=="..") {
				$path=$dir . $list[$i];
				if(file_exists($path)) {
					if(is_dir($path))
						$data=array_merge($data, Music::getItems($path."/"));
					else if(is_file($path) && strtolower(pathinfo($path)["extension"])==="mp3")
							array_push($data, Music::simplifyPath($path));
				}
			}
		}
		$sel=rand(0, count($data)-1);
		$res=$data[$sel];
		if(is_string($q)) {
			if (strstr($q,"/"))
				$q=explode("/",$q)[count(explode("/",$q))-1];
			if (Music::parse($res)===$q)
				$res=Music::getRandomSong($q);
		}
		return $res;
	}
	
	public static function getStream($songName, $artist) {
		
	}
	
	private static function parse($q=""){return preg_replace("/([^A-z0-9 \t\n\-\_\+\=\!\@\#\$\%\^\&\*\(\)\~\`\'\"\:;\[\{\]\}\|\?\<\>\,\.\/\\\\]*)/","",$q);}
	/**
	 * Gets all results that most closely matches the name of the song being searched.
	 * @param string $songName The name of the song to search for.
	 * @return array
	 */
	public static function searchSong($songName) {
		$res=array();
		if(is_string($songName)) {
			$items=Music::getItems(Music::$musicDir);
			for($i=0;$i<count($items);$i++) {
				$info=pathinfo($items[$i]);
				$perc=0;
				$charsMatched=similar_text($songName, $info["filename"], $perc);
				if($perc>50 || $charsMatched>(strlen($songName)/2))
					array_push($res, Music::simplifyPath($items[$i]));
			}
		}
		return $res;
	}
	/**
	 * Gets all results that closely matches the search parameter.
	 * @param string $songName The name of the song.
	 * @return array
	 */
	public static function searchSongInDatabase($songName) {
		if(is_string($songName)) {
			$cmd=array(
				"action"=>"select",
				"*"=>"*"
			);
			$like=array(
				"songName"=>$songName
			);
			$a=array(
				"db"=>Music::$db,
				"tb"=>Music::$tb,
				"cmd"=>$cmd,
				"like"=>$like
			);
			return db::connect($a);
		}
		return array();
	}
	/**
	 * Gets the directory items within the given directory path.
	 * @param string $path The path of the directory to scan.
	 * @return array
	 */
	private static function getItems($path) {
		$res=array();
		$list=scandir($path);
		$tmpPath="";
		for($i=0;$i<count($list);$i++) {
			if($list[$i]!=="." && $list[$i]!=="..") {
				$tmpPath=$path.$list[$i];
				if(file_exists($tmpPath)) {
					if(is_dir($tmpPath))
						$res=array_merge($res, Music::getItems($tmpPath."/"));
					else if(is_file($tmpPath)) {
						$ext=strtolower(pathinfo($tmpPath)["extension"]);
						$exts=array(
							"mp3",
							"m4a",
							"mp4",
							"mov"
						);
						foreach($exts as $e)
							if($e===$ext)
								array_push($res, Music::simplifyPath($tmpPath));
					}
				}
			}
		}
		return $res;
	}
	/**
	 * Simplifies the path.
	 * @param string $path The path to the file or directory to simplify.
	 * @return string
	 */
	private static function simplifyPath($path) {
		return preg_replace("/(A:\\/wamp64\\/www\\/WebRoot\\/www\\/files\\/Music\\/)/i","",$path);
	}
	/**
	 * Saves a song and it's data.
	 * @param string $songName The name of the song.
	 * @param string $artist The artist of the song.
	 * @param string $songData The song data as a string value.
	 */
	public static function saveSong($songName, $artist, $songData) {
		if(is_string($songName) && is_string($artist) && is_string($songData) && strlen($songName)>0 && strlen($artist)>0 && strlen($songData)>0) {
			$a=array();
			if(Music::exists($songName, $artist)) {
				$cmd=array(
					"action"=>"update",
					"songData"=>$songData
				);
				$where=array(
					"songName"=>$songName,
					"artist"=>$artist
				);
				$a=array(
					"db"=>Music::$db,
					"tb"=>Music::$tb,
					"cmd"=>$cmd,
					"where"=>$where
				);
			} else {
				$cmd=array(
					"action"=>"insert",
					"songName"=>$songName,
					"artist"=>$artist,
					"album"=>"",
					"datePublished"=>"",
					"lyrics"=>"",
					"genre"=>"",
					"keywords"=>"",
					"added"=>strval(time())
				);
				$a=array(
					"db"=>Music::$db,
					"tb"=>Music::$tb,
					"cmd"=>$cmd
				);
			}
			db::connect($a);
		}
	}
	/**
	 * Gets the lyrics of the song from the database.
	 */
	public static function getLyrics($songName, $artist) {
		if(is_string($songName) && is_string($artist)) {
			$path=Music::$dir . $artist . "/" . $songName . ".json";
			$res=is_file($path) ? file_get_contents($path) : "{}";
			if(!Music::exists($songName, $artist) || !Music::$enforceDatabase) {
				$info=new SongInfo(Music::normalize($songName), Music::normalize($artist), "", "", $res, "", "");
				//var_dump($info);
				//Music::saveSongInfo($info);
				//return json_encode(Music::getMusicInfo($songName, $artist)["lyrics"], JSON_UNESCAPED_UNICODE);
				//var_dump($res);
				//return json_encode($res, JSON_UNESCAPED_UNICODE);
				return $res;
			} else {
				//print_r(Music::getMusicInfo($songName, $artist)["lyrics"]);
				//var_dump(Music::getMusicInfo($songName, $artist)["lyrics"], json_encode(Music::getMusicInfo($songName, $artist)["lyrics"], true));
				//return json_encode(Music::getMusicInfo($songName, $artist)["lyrics"], JSON_UNESCAPED_UNICODE);
			}
			return $res;
		}
		return "{}";
	}
	/**
	 * Determines if the song exists within the database.
	 * @param string $songName The name of the song to search for.
	 * @param string $artist The name of the artist to search for.
	 */
	public static function exists($songName, $artist) {
		return Music::getMusicInfo($songName, $artist)!==null;
	}
	/**
	 * Gets the song info of the song name and the artist.
	 * @param string $songName The name of the song to search for.
	 * @param string $artist The name of the artist to search for.
	 * @return array|null
	 */
	public static function getMusicInfo($songName, $artist) {
		if(is_string($songName) && is_string($artist)) {
			Music::setupDatabase();
			$cmd=array(
				"action"=>"select",
				"*"=>"*"
			);
			$where=array(
				"songName"=>strtolower($songName),
				"artist"=>strtolower($artist)
			);
			$a=array(
				"db"=>Music::$db,
				"tb"=>Music::$tb,
				"cmd"=>$cmd,
				"where"=>$where
			);
			$res=db::connect($a);
			//var_dump("START");
			//print_r($res[0]["lyrics"]);
			//var_dump("END");
			return is_array($res) && count($res)>0 ? $res[0] : null;
		}
		return null;
	}
	/**
	 * Saves the song info to the database.
	 * @param SongInfo $info The song info object that stores the information of the song.
	 */
	public static function saveSongInfo($info) {
		if(!Music::exists($info->songName, $info->artist)) {
			$cmd=array(
				"action"=>"insert",
				"songName"=>$info->songName,
				"artist"=>$info->artist,
				"album"=>$info->album,
				"datePublished"=>$info->datePublished,
				"lyrics"=>$info->lyrics,
				"genre"=>$info->genre,
				"keywords"=>$info->keywords,
				"added"=>strval(time())
			);
			$a=array(
				"db"=>Music::$db,
				"tb"=>Music::$tb,
				"cmd"=>$cmd
			);
			db::connect($a);
		}
	}
	/**
	 * Creates the database and it's tables.
	 */
	public static function setupDatabase() {
		$cmd=array(
			"action"=>"db_tb_exist_auto",
			"songName"=>"string",
			"artist"=>"string",
			"album"=>"string",
			"lyrics"=>"string",
			"datePublished"=>"string",
			"genre"=>"string",
			"keywords"=>"string",
			"added"=>"string",
			"songData"=>"file"
		);
		$a=array(
			"db"=>Music::$db,
			"tb"=>Music::$tb,
			"cmd"=>$cmd
		);
		db::connect($a);
	}
	/**
	 * Normalizes the input value.
	 * @param string $value The value to normalize.
	 * @return string
	 */
	private static function normalize($value) {
		return trim(preg_replace("/[^A-z\d\.\s]+/", "", $value));
	}
	
}

?>