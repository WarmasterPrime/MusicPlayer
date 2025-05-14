<?php

require_once("System/Struct.php");
require_once("System/KeyValuePair.php");

class SongInfo extends Struct {
	
	/**
	 * Stores a structured object consisting of the song information.
	 * @param string $songName The name of the song.
	 * @param string $artist The name of the artist.
	 * @param string $album The name of the album.
	 * @param string $datePublished The date the song was published.
	 * @param array|string $lyrics The JSON object of the song's lyrics.
	 * @param string $genre The genre of the song.
	 * @param array $keywords The keywords of the song.
	 */
	public function __construct($songName, $artist, $album, $datePublished, $lyrics, $genre, $keywords) {
		if(is_string($lyrics))
			$lyrics=json_decode($lyrics, true); // Used to convert the string into an array and then back to a string to conserve space.
		if(is_array($lyrics))
			$lyrics=json_encode($lyrics, JSON_UNESCAPED_UNICODE);
		parent::__construct(new KeyValuePair("songName", $songName), new KeyValuePair("artist", $artist), new KeyValuePair("album", $album), new KeyValuePair("datePublished", $datePublished), new KeyValuePair("lyrics", $lyrics), new KeyValuePair("genre", $genre), new KeyValuePair("keywords", $keywords));
	}
	
	
}

?>