<?php

require_once("A:/wamp64/www/WebRoot/www/files/WebAssets/PHP/db.php");

class SearchApi {
    
    private static $apiKeyFilePath = "A:/Server/API/Keys/gemini.key";
    private static $searchQuery = "In the form of a JSON object, please give me the song name, artist, album, duration, publish date, and lyrics with the lyric timestamps. Please search the web for the lyrics and timestamps. Only respond with a JSON object.\n";
    private $apiKey;
    
    private static $db="musicplayer";
    private static $tb="songs";
    
    /**
     * Creates a new instance of the searcher api.
     */
    public function __construct() {
        $this->apiKey=$this->getApiKey();
    }
    /**
     * Gets the API key.
     */
    private function getApiKey() {
        return file_exists(SearchApi::$apiKeyFilePath) ? file_get_contents(SearchApi::$apiKeyFilePath) : "";
    }
    
    private static function databaseSetup() {
        $cmd=array(
            "action"=>"db_tb_exist_auto",
            "query"=>"string",
            "name"=>"string",
            "artist"=>"string",
            "album"=>"string",
            "published"=>"string",
            "lyricData"=>"string",
            "duration"=>"string",
            "raw"=>"string",
            "added"=>"string"
        );
        $args=array(
            "db"=>SearchApi::$db,
            "tb"=>SearchApi::$tb,
            "cmd"=>$cmd
        );
        db::connect($args);
    }
    
    private static function getObject($aiResponse) {
        if(is_string($aiResponse))
            $aiResponse=json_decode($aiResponse, true);
        $obj=$aiResponse["candidates"][0]["content"]["parts"][0]["text"];
        if(str_starts_with($obj, "```json\n"))
            $obj=preg_replace("/(^```json\n|\n```\$/gm");
        $obj=json_decode($obj, true);
        return $obj;
    }
    
    private static function addRecord($query, $songInfo) {
        $cmd=array(
            "action"=>"insert",
            "query"=>$query,
            "name"=>$songInfo["song_name"],
            "artist"=>$songInfo["artist"],
            "album"=>$songInfo["album"],
            "duration"=>$songInfo["duration"],
            "publishDate"=>$songInfo["publish_date"],
            "lyrics"=>$songInfo["lyrics"],
            "raw"=>$songInfo
        );
        $args=array(
            "db"=>SearchApi::$db,
            "tb"=>SearchApi::$tb,
            "cmd"=>$cmd
        );
        db::connect($args);
    }
    
    public static function checkIfQueryExists($query) {
        SearchApi::databaseSetup();
        $cmd=array(
            "action"=>"select",
            "*"=>"*"
        );
        $where=array(
            "query"=>$query
        );
        $args=array(
            "db"=>SearchApi::$db,
            "tb"=>SearchApi::$tb,
            "cmd"=>$cmd,
            "where"=>$where
        );
        $res=db::connect($args);
        return is_array($res) && count($res)>0 ? $res : null;
    }
    
    public function getSongDetails($query) {
        if(is_string($query) && strlen($query)) {
            $tmp=SearchApi::checkIfQueryExists($query);
            if($tmp!==null) {
                return $tmp;
            } else {
                $q=SearchApi::$searchQuery . "\"" . $query . "\"";
                $ins=curl_init();
                curl_setopt($ins, CURLOPT_URL, "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=".$this->apiKey);
                curl_setopt($ins, CURLOPT_HEADER, 0);
                curl_setopt($ins, CURLOPT_HTTPHEADER, array(
                    "Content-Type: application/json",
                    "Content-Length: " . strlen($q),
                    "User-Agent: Virtma/0.0.1",
                    "Accept: */*",
                    "Connection: keep-alive",
                    "Accept-Encoding: *"
                ));
                $result=curl_exec($ins);
                curl_close($ins);
                //SearchApi::addRecord($query, SearchApi::getObject($response));
            }
        }
    }
    
}










if($_POST["q"]==="request") {
    
}





?>