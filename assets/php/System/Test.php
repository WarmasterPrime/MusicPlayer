<?php

//require_once("VObject.php");
//require_once("JSLoader.php");

//class Test extends VObject {
	
//	public static $StaticPublicProp = "This is a public static prop.";
//	protected static $StaticProtectedProp = "This is a protected static prop.";
//	private static $StaticPrivateProp = "This is a private static prop.";
	
//	public $PublicProperty = "This is a public property.";
//	protected $ProtectedProperty = "This is a protected property.";
//	private $PrivateProperty = "This is a private property.";
	
//	function __construct() {
//		parent::__construct();
//		var_dump($this->properties);
//	}
	
//}

/*
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', false);
header("HTTP/1.1 200 OK");
header('Content-Type: text/html');
header('Transfer-Encoding: chunked');
header('Connection: keep-alive');

function flush_data() {
	$str = ob_get_contents();
	ob_clean();
	echo dechex(strlen($str)) . "\r\n" . $str . "\r\n";
	ob_flush();
	flush();
}

echo "<!doctype html><html><head><title>Transfer-Encoding: chunked</title>";
echo "<script>";
for($i=0;$i<15;$i++) {
	echo "\t";
}
echo "</script></head><body><div>";

flush_data();

for($i=0;$i<3;$i++) {
	echo "Count $i<br/>";
	flush_data();
	sleep(1);
}

echo "</div></body></html>";

flush_data();

echo "0\r\n\r\n";
ob_flush();
*/




require_once("Stream/VStream.php");

//define("no-dark", true);

if (isset($_POST["request_path"])) {
	//stream(parseData($_POST["request_path"]));
}
if (isset($_GET["request_path"])) {
	stream(parse($_GET["request_path"]));
}


$testPath = "A:/wamp64/www/webroot/www/files/music/luv.mp3";
$testPath = "video.mp4";
$stream = new VStream($testPath);
$stream->start();







//for ($i = 1; $i <= 3; $i++) {
//    echo "Chunk $i\n";
//    flush();
//    ob_flush();
//    sleep(1); // Simulate delay
//}

//print_r(CommonMark::Parse($data));
//$data = highlight_file("VObject.php", true);

//print_r(CommonMark::Parse($data));

//print_r(CommonMark::Parse($data));
//$obj = new Test();
//$ins = new ReflectionClass($obj);
//var_dump($ins, $ins->getModifiers());


?>