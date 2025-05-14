# MusicPlayer

<details>
	<summary>Setup</summary>
	- Download the project zip file.
	- Extract the zip file into the root directory of your web server.
	- To change the background image, access the bg.css file in the css directory located within the assets directory, update the url path to point to the publicly accessible image file.
</details>

<details>
	<summary>UI Controls</summary>
	- Spacebar: Toggle play/pause of song.
	- Arrow Up: Increase volume.
	- Arrow Down: Decrease volume.
	- Arrow Left: Skip back 5 seconds.
	- Arrow Right: Skip forward 5 seconds.
	- Move mouse to the top edge: Shows song controls and visualization settings.
	- Move mouse to the right edge: Shows the song navigation menu.
</details>

<details>
	<summary>REST API</summary>
	| Attribute | Data Type | Description | Example |
	| --- | --- | --- | --- |
	| song | string | The url path to the song file. | #song=http://doft.ddns.net/files/Music/NCS/Together%2520%255BNCS%2520Lyrics%255D.mp3 |
	| r | float | The red color value for the visualization. | #r=255 |
	| g | float | The green color value for the visualization. | #g=0 |
	| b | float | The blue color value for the visualization. | #b=0 |
</details>

<details>
	<summary>Source Code</summary>

	<details>
		<summary>Basics</summary>
		## main.js
		The main.js file is the entry point of the application. It initializes all client-side modules, assets, etc. and prepares the audio visualizer for songs to be played, loaded, and visualized. This file should not be modified unless specifying additional REST API arguments.

		## Player.js
		The Player.js file is responsible for the song controls including audio adjustment, seeking, playing/pausing, loading the song url, maintaining runtime information of the song being played, and automated loading management for songs. This class can also store the song lyrics data and load the lyrics visually to the client onto an HTML element.

		## Lyrics.js
		The Lyrics.js file is responsible for storing and retrieving the lyrics at the given time frame. It is a simple class that allows accepts the lyrics data as a JSON object (Which consists of a key-value pair where the key is the time of when the lyric should be displayed and the value is the lyric string itself). While the song is being played, using the `getAtTime(int)` method will retrieve the lyric that is available at the given time frame. The time passed to this method does not have to match exactly the time specified in the lyrics JSON object as the method will find the lyric based on the if the given time frame is greater than a given key in the object. If it is, then the lyric string is returned to the caller.

		## Visualizer.js
		The Visualizer class is responsible for managing the visualizations of the song frequencies at every tick. The constructor for this object accepts an argument that will act as the parent HTML div container element to contain the HTML canvas element. This HTML canvas element will be used to render the audio frequencies of the song at every tick. The Visualizer class also allows the adjustment of the color of the bars, the rendering style, and other rendering features provided in the class. The class uses a floating point array to store the frequencies of the song at every tick. It allows for a smoother animation compared to the Int array in it's initial iterations. This class has also undergone several refactoring and optimizations to improve the performance of the rendering. The class also allows for the adjustment of the bar width, height, and spacing between each bar. The class also allows for the adjustment of the number of bars to be rendered. The class also allows for the adjustment of the color of the bars, the rendering style, and other rendering features provided in the class. The class uses a floating point array to store the frequencies of the song at every tick. It allows for a smoother animation compared to the Int array in it's initial iterations. This class has also undergone several refactoring and optimizations to improve the performance of the rendering.

		## UrlParams.js
		The UrlParams class provides methods to encode data into the URL.

		## SongInfo.js
		The SongInfo class is responsible for storing the song information such as the song name, artist name, and album name. This class is used to display the song information on the UI. The class also provides methods to retrieve the song information from the URL.

		## Color.js
		The Color class is designed to provide a more maintainable and scalable system to adjust color values with ease.

		## Config.js
		The config class is designed to provide a means to store, update, and manage configuration data for the visualizer. All configurations that can be modified in the interface will eventually go into this class dynamically and be stored in the URL parameters.

		## cgi.js
		The cgi class is designed to provide a basic and easy means to render designs onto the HTML canvas element. It uses the gpu class as tool and performs the calculations for the renderings.

		## gpu.js
		The gpu class is designed to provide an easy means to access and manipulate the the renderings of the HTML canvas element.

		## SongSearcher.js
		The SongSearcher class is a work in progress class that aims for the ability to search for songs available on the server. This feature requires all of the songs to be referenced or stored (With the metadata for each song) on a database.
	</details>
	<details>
		<summary>Server-Side Requests</summary>
		## get.php
		Obtains the song url(s) from the server that are located within the given playlist/directory. Use `cmd` to specify the command to perform (Either `playlist` or `song`), and the `value` to specify the playlist/directory. This only accepts POST requests.

		## getRandomSong.php
		Returns the url of a random song from the server. Use the `cmd` parameter to specify the parent directory to limit the search to/in. This accepts both POST and GET requests.

		## getSongLyrics.php
		Returns the JSON string of the lyrics object for the requested song. Use `songName` to specify the name of the song, and `artist` to specify the artist of the song. If a lyrics object exists in the database or in the file system, then it will return the lyrics object, or it will return an empty JSON object.
	</details>

</details>
<details>
	<summary>Examples</summary>

	<details>
		<summary>Server Requests</summary>
		### Get songs within a directory/playlist (And play the song)
		```js
		let player = new Player(document.getElementById("player"), document.getElementById("caption"), document.getElementById("head"), document.getElementById("song-name")); // Creates a new instance of the Player class.
		let songs = player.select("http://doft.ddns.net/files/Music/NCS/"); // Gets the songs within the NCS directory.
		player.play(songs[0]); // Plays the first song found in the NCS directory.
		```

		### Get a random song
		```js
		let player = new Player(document.getElementById("player"), document.getElementById("caption"), document.getElementById("head"), document.getElementById("song-name")); // Creates a new instance of the Player class.
		player.selectSong(); // Contacts the server and selects a random song to play immediately.
		```
	</details>

	

</details>