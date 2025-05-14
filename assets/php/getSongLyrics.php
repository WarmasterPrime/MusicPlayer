<?php

require_once("Music.php");

if(isset($_POST["songName"]) && isset($_POST["artist"])) {
    print_r(Music::getLyrics($_POST["songName"], $_POST["artist"]));
}



?>