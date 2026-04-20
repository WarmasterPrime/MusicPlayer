# MusicPlayer

An in-browser, audio-reactive music player + visualizer. Renders a WebAudio-driven
visualization (2D Canvas and 3D WebGL/THREE.js designs) on top of a PHP/MySQL
backend that handles song storage, lyrics, user accounts, layouts, chat, a store,
and more.

Frontend is pure ES modules (`.mjs`) with no bundler. Backend is PHP 8 + PDO
against three MySQL databases (`accounts`, `media`, `musicplayer`). Runs on any
LAMP/WAMP stack — the reference dev environment is WampServer on Windows.

---

<details>
<summary>Setup</summary>

### Requirements
- **Web server** — Apache/Nginx with PHP ≥ 8.0 and `mod_rewrite` enabled. The
  reference dev stack is WampServer (`A:\wamp64\www\WebRoot\www\MusicPlayer`).
- **MySQL/MariaDB** — three databases: `accounts`, `media`, `musicplayer`. The
  app bootstraps schemas on first run via `assets/php/System/SchemaSetup.php`
  (hit `assets/php/runSchemaSetup.php` as an admin to migrate).
- **Modern browser** — Chrome/Edge recommended. Firefox works except for the
  mic-lyrics feature (Web Speech API is behind a flag there).

### Install
1. Clone into your web root, e.g. `A:/wamp64/www/WebRoot/www/MusicPlayer`.
2. Create the three databases and a user that can `SELECT/INSERT/UPDATE/DELETE/ALTER`.
3. Create `db.ini` at `A:/wamp64/www/ServerAssets/Assets/Server/Info/PHP/db.ini`
   (the path is hard-coded in `assets/php/System/Database.php`). Format:
   ```ini
   [connection]
   server = localhost
   port = 3306

   [credentials]
   username = musicplayer
   password = <your-password>
   ```
4. Visit the site in a browser, register a first account, then run
   `assets/php/runSchemaSetup.php` (logged in as an admin) to populate tables.
5. Drop songs via the upload UI or directly into `assets/uploads/` and point the
   songs table at them.
6. Optionally override the background image in `assets/css/bg.css`.

### Reference ports / paths
- Dev preview server runs on port 8765 (see `.claude/launch.json`).
- Session files live in `sessions/` (gitignored).
- Uploaded songs go under `assets/uploads/`.
- Lyric files under `assets/lyrics/`.
- External visualizer design files under `assets/designs/*.vizdesign.json`.

</details>

---

<details>
<summary>UI controls</summary>

| Input | Action |
| --- | --- |
| Space | Play / pause |
| ↑ / ↓ | Volume up / down |
| ← / → | Seek −5s / +5s |
| Mouse → left edge | Open left panel (settings, auth) |
| Mouse → right edge | Open song-navigation menu |
| Mouse drag on 3D canvas | Orbit camera |
| Mouse wheel on 3D canvas | Zoom |
| Gear icon | Open ModalOptions (visualizer + playback settings) |

</details>

---

<details>
<summary>URL parameters</summary>

Anything in `#...=...` after the URL hash is parsed by `UrlParams.mjs` and used
to hydrate app state on load. Most ModalOptions controls write back here so
state survives a refresh and can be shared by copy-pasting the URL.

| Param | Type | Meaning |
| --- | --- | --- |
| `song` | string | The ID of the song to auto-load. |
| `r`, `g`, `b` | 0–255 | Visualizer bar color. |
| `design` | string | Active visualizer design name (e.g. `bar`, `lyricparticles`, `recordplayer`, `3dsphere`). |
| `lyrics` | bool | Show caption overlay. |
| `micLyrics` | bool | Start live mic-driven lyrics on load (requires user gesture in some browsers). |
| `lyricCount` | 500–30000 | Particle count for the Lyric Particles design. |
| `lyricCurve` | 0–100 | Cylindrical curvature of Lyric Particles text. |
| `recordText` | string | Front-plaque text for the Record Player design. |
| `layout` | uuid | Load a shared custom layout from the database. |
| `camMode` | `static`/`orbit`/`spiral`/`fly`/`codesandbox` | 3D camera motion. |
| `sphere` | bool | Show the background CSS sphere. |
| `newBg` | bool | Use the animated background layer. |
| `fade` | bool | Enable color-fade cycling. |
| `progressBar` | bool | Show the progress bar. |
| `audioAccuracy` | int | `Analyser.fftSize` override. |
| `view` | `privacy`/`terms` | Open a legal modal on load. |

`UrlParams.SetParam(key, value)` and `UrlParams.removeParam(key)` update the
fragment without triggering a reload (`history.replaceState`).

</details>

---

<details>
<summary>Directory layout</summary>

```
MusicPlayer/
├─ index.html                       # Entry point — loads assets/js/main.mjs
├─ README.md
├─ LICENSE.txt
├─ assets/
│  ├─ css/                          # Styles (main.css, bg.css, modals, etc.)
│  ├─ designs/*.vizdesign.json      # External 2D visualizer design files
│  ├─ js/                           # Client-side ES modules
│  │  ├─ main.mjs                   # Bootstrap + URL-param hydration
│  │  ├─ Player.mjs                 # <audio> controls + lyric loading
│  │  ├─ Visualizer.mjs             # 2D canvas renderer + design dispatcher
│  │  ├─ Visualizer3D.mjs           # THREE.js 3D renderer + all 3D designs
│  │  ├─ VizEngine.mjs              # Runtime for .vizdesign.json files
│  │  ├─ VizExprCompiler.mjs        # "=expr" string → Function compiler
│  │  ├─ Lyrics.mjs                 # Multi-format lyric parser/lookup
│  │  ├─ MicLyrics.mjs              # Web Speech API → lyrics shim
│  │  ├─ Modal*.mjs                 # Modals (options, auth, layout, etc.)
│  │  ├─ UrlParams.mjs              # Hash-param get/set
│  │  ├─ Color*.mjs                 # Color math + picker
│  │  ├─ ext/                       # Vendored libs (three.module.mjs, etc.)
│  │  └─ System/                    # Shared helpers (VJson, typed data)
│  ├─ lyrics/                       # Fallback flat-file lyrics tree
│  └─ php/
│     ├─ session.php                # Auth helpers: isLoggedIn, getCurrentUser
│     ├─ System/
│     │  ├─ Database.php            # PDO factory (reads db.ini)
│     │  └─ SchemaSetup.php         # Schema migrations
│     ├─ get*.php / save*.php       # Song / lyric / profile CRUD
│     ├─ layoutManager.php          # Custom layout CRUD + get_shared
│     ├─ exportData.php             # "Download My Data" export
│     ├─ streamSong.php             # Authenticated audio stream
│     ├─ admin/                     # Admin endpoints (users, coupons, etc.)
│     ├─ auth/                      # Google OAuth flow
│     ├─ chat/                      # In-app chat
│     ├─ store/                     # Purchasing / subscriptions
│     └─ fonts/                     # Font upload/listing
├─ sessions/                        # PHP session files (gitignored)
└─ Versions/                        # Frozen snapshots of previous releases
```

</details>

---

<details>
<summary>Client-side modules</summary>

### Entry + playback
- **`main.mjs`** — Bootstraps the app. Reads URL params via `UrlParams`, sets
  up global `Visual` (Visualizer instance), wires listeners, and kicks off
  `ModalLayoutDesigner.checkUrlLayout()` / `applyActiveLayout()`.
- **`Player.mjs`** — Thin wrapper around the `<audio>` element. Tracks
  `currentTime`, loads lyrics via `getSongLyrics.php`, exposes
  `loadLyrics(obj)` which constructs a `Lyrics` instance (`this.lyrics`).
  `Visualizer` extends `Player` so `Visual.lyrics` is the canonical lyric
  source everywhere.

### Visualization
- **`Visualizer.mjs`** — The 2D rendering class. Holds the visible
  `<canvas>`, pulls `Uint8Array` FFT data from `AnalyserNode.getByteFrequencyData`,
  and hands off to either an internal `#render<DesignName>()` method or
  `VizEngine.render(...)` for designs that live as `.vizdesign.json`. Handles
  layout-system components (progress bar, lyric caption, text flows) and
  color-fade cycling.
- **`Visualizer3D.mjs`** — The 3D renderer. Owns a singleton
  `THREE.WebGLRenderer` and camera pole. Exposes static `activate(design)` /
  `deactivate()` / `render(...)` / `resize()` / `setViewport(...)` — the 2D
  visualizer calls these when a 3D design is selected or placed into a custom
  layout slot. Each 3D design has a `#setup<Name>` + `#render<Name>` pair
  (`recordPlayer`, `lyricParticles`, `pointWave`, `gelatin`, `dna`, `tunnel`,
  `sand`, `liquidSphere`, `smoke`, plus raw `3dbars` / `3dwaves` / `3dsphere`).
  Public config fields (e.g. `lyricParticleCount`, `lyricTextCurvature`,
  `recordPlateText`, `cameraMode`, `orbitEnabled`) are written to by
  ModalOptions.
- **`VizEngine.mjs` / `VizExprCompiler.mjs`** — Runtime that loads
  `.vizdesign.json` files, compiles `"=expr"` strings to `Function` objects
  once at load time, then executes declarative render steps (`loop`,
  `fillRect`, `arc`, `path`, `particles`, `subroutines`, …) at 60fps. Lets
  designs be authored as data rather than code.

### Lyrics
- **`Lyrics.mjs`** — Normalizes LRC / SRT / VTT / SBV / SUB / SCC / JSON /
  legacy flat-object formats to a canonical `[{timestamp, text}, …]` array.
  `getAtTime(ms)` returns the last line whose timestamp has passed. Has
  subtitle-format parsers with gap-marker synthesis so "blank lines in the
  source" translate to a rendered pause.
- **`MicLyrics.mjs`** — Uses `SpeechRecognition` (continuous + interim) to
  populate a live lyrics shim. When active it swaps `Visual.lyrics` for an
  object whose `getAtTime()` returns the most-recent recognized phrase
  (auto-clears after 4s of silence), so every existing lyric renderer (caption
  overlay, 3D Lyric Particles) picks it up with no per-renderer changes.

### Modals
| Module | Purpose |
| --- | --- |
| `ModalOptions.mjs` | Main settings panel — design grid, design-specific inputs, 3D lighting, colors, URL-param persistence. |
| `ModalAuth.mjs` | Login / register / Google OAuth. |
| `ModalLayoutDesigner.mjs` | Drag-drop custom layout editor; reads/writes `user_layouts`; `?layout=<id>` deep links. |
| `ModalLyricCreator.mjs` | Standalone lyric-editor that pulls the song from the database (no re-upload) and builds multi-track LRC output. |
| `ModalLyricsEditor.mjs` | In-place edit of the currently loaded song's lyrics. |
| `ModalSongManagement.mjs` | Metadata edit, lyric upload (`.lrc`, `.srt`, `.vtt`, …), delete. |
| `ModalProfile.mjs` | Profile + "Download My Data" export. |
| `ModalAdmin.mjs` | Admin: users, coupons, tax, refunds, feature grants. |
| `ModalChat.mjs` | Polling-based in-app chat. |
| `ModalStore.mjs` | Purchasing / subscription flow. |
| `ModalPlaylist*.mjs` | Playlist management + discovery. |
| `ModalUpload.mjs` | Song upload with metadata. |
| `ModalFonts.mjs` | Custom font upload / picker. |
| `ModalLegal.mjs` | Privacy / Terms markdown modals. |

### Support
- **`UrlParams.mjs`** — `GetParams()` / `SetParam(k,v)` / `removeParam(k)` over
  `location.hash` using `history.replaceState`.
- **`Api.mjs`** — Small `fetch`-based client with JSON post/get and graceful
  error surfacing. Always passes `credentials: "same-origin"`.
- **`Color.mjs`**, **`ColorPicker.mjs`** — Color model, hex/rgb/hsl helpers,
  picker UI.
- **`FeatureGate.mjs`** — Client mirror of the server's `authority` SET flags;
  gates premium features (Layout Designer, advanced stores, etc.).
- **`Toast.mjs`**, **`Modal.mjs`** — Notification + generic modal primitives.
- **`Tutorial.mjs`** — First-run walkthrough.

</details>

---

<details>
<summary>Server-side endpoints</summary>

All PHP endpoints return JSON (`Content-Type: application/json`) unless noted.
Authentication is via PHP session; `session.php` provides
`isLoggedIn()` / `getCurrentUser()`. Endpoints that require auth return
`{ "success": false, "message": "Not logged in." }` otherwise.

### Songs & streaming
- `get.php` — Lists songs or playlists (`cmd=playlist|song`, `value=path`).
- `getAllSongs.php` — Full library for the authed user.
- `getRandomSong.php` — Random song (optional `cmd` directory filter).
- `getSongById.php` — Metadata lookup; returns `stream_url` pointing at
  `streamSong.php`.
- `streamSong.php` — Authenticated audio stream (`?id=<uuid>`).
- `uploadSong.php` / `songUpload.php` — Upload new songs (multipart form).
- `updateSong.php` — Metadata edit.

### Lyrics
- `getLyrics.php` — Fetch by `song_id`.
- `getSongLyrics.php` — Legacy lookup by `songName` + `artist`.
- `saveLyrics.php` — Persist the canonical
  `[{timestamp, text}, …]` array. Preserves gap markers (empty-text entries)
  used by the renderer to blank the caption between verses.

### Accounts
- `login.php` / `logout.php` / `register.php` — Standard session flow.
- `checkSession.php` — Session probe used by frontend boot.
- `getProfile.php` / `updateProfile.php` — User profile fields.
- `getProfilePicture.php` / `deleteBackground.php` / `getBackgroundPicture.php`
  — Avatar + background blob handling.
- `auth/google*.php`, `auth/linkGoogle.php`, `auth/unlinkGoogle.php`,
  `auth/getLinkedPlatforms.php` — Google OAuth link flow.
- `exportData.php` — "Download My Data" as `txt` / `csv` / `json`. Tolerant to
  missing columns in older schemas and includes linked platforms, saved
  layouts, and user lyric contributions.

### Layouts & UI state
- `layoutManager.php`
  - `action=list` — User's own layouts.
  - `action=get&id=` — Owned layout (ownership-gated).
  - `action=get_shared&id=` — Capability-style fetch for `?layout=<id>` deep
    links — returns any layout by ID without ownership check, so a shared URL
    resolves for recipients who don't own the layout.
  - `action=save` / `delete` / `set_active`.
- `getUserPreferences.php` / `saveUserPreference.php` — Key/value preference
  bag (design, colors, etc.).

### Playlists
- `getPlaylists.php`, `getPlaylistSongs.php`, `discoverPlaylists.php`,
  `playlist.php`, `searchSongs.php`.

### Chat
- `chat/listConversations.php`, `getConversation.php`, `sendMessage.php`,
  `poll.php`, `updateTyping.php`, `getTyping.php`, `closeConversation.php`,
  `deleteConversation.php`, `uploadAttachment.php`, `cleanupStale.php`.

### Store / admin
- `store/*` — Product / subscription / coupon purchase flow.
- `admin/*` — User management, coupon CRUD, refund issue, feature grant/revoke,
  tax rate management (requires authority flags).

### System
- `runSchemaSetup.php` — Triggers schema migrations (admin-only).
- `System/Database.php` — PDO factory; reads `db.ini`.
- `System/SchemaSetup.php` — Migrations.
- `System/Authority*`, `System/FeatureGate.php` — Permission model.

</details>

---

<details>
<summary>Database</summary>

Three databases, each connected to via `Database::connect("<name>")`:

- **`accounts`** — `users`, `user_platforms`, `user_layouts`,
  `user_preferences`, `user_features`, admin tables (coupons, refunds, taxes).
- **`media`** — `songs` (title, artist, album, duration, file path), playlists,
  playlist_songs, song metadata blobs.
- **`musicplayer`** — `lyrics` (`song_id`, `lyrics_json`, `language`,
  `updated_by`), plus app-wide content tables.

All tables use `utf8mb4` / `utf8mb4_unicode_ci`. IDs are `CHAR(36)` UUIDs.
Schema is created and migrated by `System/SchemaSetup.php` — call
`runSchemaSetup.php` as an admin after a fresh install.

</details>

---

<details>
<summary>Visualizer subsystem</summary>

### 2D (Canvas)
`Visualizer.mjs` drives the main `<canvas>`. Each frame:
1. Pull `Uint8Array` data from `AnalyserNode.getByteFrequencyData`.
2. Compute `toff` (threshold offset) from user settings.
3. Either call a built-in `#render<Design>()` method or hand off to
   `VizEngine.render(ctx, data, bufferLength, barColor, viz)` for JSON-defined
   designs.
4. Render overlays (lyrics caption, progress bar, text flows) on top.

Built-in 2D designs: `bar`, `verticalLines`, `line`, `radial`, `circle`,
`polygon`, `curvedLines`, `snow`, `rain`, `water`, `lightning`, `tetris`.
Some of these are also exposed as editable `.vizdesign.json` files under
`assets/designs/` via the VizEngine.

### 3D (THREE.js WebGL)
`Visualizer3D.mjs` owns one `WebGLRenderer` shared across all 3D designs and a
camera pole (`THREE.Object3D` parent → `PerspectiveCamera` child) so the
orbit-and-zoom input can be applied globally. When the active design is 3D:

1. `Visualizer.mjs` calls `Visualizer3D.activate(design)`.
2. `Visualizer3D` disposes any previous design's meshes and invokes
   `#setup<Name>()` to populate the scene.
3. Each frame, `#render<Name>(dataArray, bufferLength, barColor, toff)` runs
   — updating uniforms, vertex displacement, instance transforms, camera pole,
   particle lifecycles, etc.
4. Custom layouts can embed 3D designs in sub-regions via
   `setViewport()` + `clearViewport()` which wrap `renderer.setViewport()` and
   `setScissor()` so multiple designs can share the canvas.

3D designs: `3dbars`, `3dwaves`, `3dsphere`, `recordplayer`, `lyricparticles`,
`pointwave`, `gelatinshape`, `dna3d`, `tunnel3d`, `sand3d`, `liquidsphere`,
`smoke3d`, plus the animal meshes.

### External design files (VizEngine)
`.vizdesign.json` files describe a design declaratively:

```jsonc
{
  "name": "bar",
  "label": "Bar",
  "type": "2d",
  "audio": { "toff": 150, "bassRange": 0.03, "bassNormDivisor": 150 },
  "render": {
    "steps": [
      { "type": "loop", "var": "i", "from": 0, "to": "=binCount",
        "body": [
          { "type": "fillRect",
            "x": "=i * barWidth",
            "y": "=height - (data[i] * maxHeight / 255)",
            "w": "=barWidth - 1",
            "h": "=data[i] * maxHeight / 255",
            "style": "=hsl(i / binCount * 360, 80, 50)" } ] }
    ]
  }
}
```

`"=…"` strings are compiled to `Function` once at load time by
`VizExprCompiler`, then invoked per-frame with a scope containing `data[]`,
`bass`, `mid`, `energyNorm`, `width`, `height`, `time`, `frame`, trig helpers,
etc.

### Custom layouts
`ModalLayoutDesigner.mjs` lets users drag-arrange visualizer designs + UI
components (progress bar, text flows, lyric captions) into custom positions.
Layouts persist in `accounts.user_layouts` and are fetched via
`layoutManager.php`. The `?layout=<id>` URL param deep-links to any layout by
ID (via `action=get_shared`) so shared URLs work for other users.

</details>

---

<details>
<summary>Lyrics subsystem</summary>

1. **Load.** `Player.getSongLyrics(name, artist)` fetches the canonical JSON
   array from `getSongLyrics.php` and calls `loadLyrics()`, which constructs
   `new Lyrics(obj)`.
2. **Normalize.** `Lyrics` detects the format and converts to
   `[{timestamp, text}, …]` (milliseconds). Blank lines / gap markers in LRC
   and subtitle formats are preserved as empty-text entries so the caption
   correctly blanks between verses.
3. **Query.** At ~60fps the renderer calls `Visual.lyrics.getAtTime(ms)` which
   returns the most-recent line whose timestamp ≤ `ms`.
4. **Render.** The caption overlay writes the returned string into `#caption`.
   The 3D Lyric Particles design reads the same string from
   `Visualizer3D.#getActiveLyric()` and re-targets its point cloud onto the
   letter-shapes of the new text.

### Mic-driven lyrics
`MicLyrics.start()` requests mic access, starts a `SpeechRecognition` session
(continuous, interim results), and **replaces `Visual.lyrics`** with a live
shim whose `getAtTime()` returns the most-recently recognized phrase. Because
every renderer polls `Visual.lyrics.getAtTime()`, swapping the object is all
that's needed — no per-renderer wiring. `MicLyrics.stop()` restores the
previous `Lyrics` instance.

### Supported input formats
`.lrc`, `.srt`, `.vtt`, `.sbv`, `.sub`, `.scc`, plain `.txt`, canonical JSON
(array or legacy flat object). All go through `Lyrics.fromAny(text, ext)`.

### Lyric Creator
`ModalLyricCreator.mjs` is a standalone editor: multi-track timeline, waveform
+ playhead, drag-to-position lyric blocks, auto-generate from existing lyric
file. It loads the currently selected song from the database via
`getSongById.php` + `streamSong.php` (no file re-upload) and serializes back
via `Lyrics.toLrc()` → `saveLyrics.php`.

</details>

---

<details>
<summary>Developer workflow</summary>

### Local iteration
- Edit files in place; no build step. Reload the browser to pick up changes.
- The preview server at `http://localhost:8765/` (set up in
  `.claude/launch.json`) serves the repo root. Use it for snapshot /
  console-log debugging without disturbing your main browser session.
- Inspect `console.log` from there with preview tooling or `F12` devtools.

### Adding a new design
- **Simple 2D:** drop a `.vizdesign.json` into `assets/designs/` and register
  it in `assets/designs/manifest.json`. No JS changes needed.
- **Procedural 2D:** add a `#renderMyDesign()` to `Visualizer.mjs`, register
  in the main switch, and add a thumbnail SVG + grid entry to ModalOptions.
- **3D:** add `#setupMyDesign()` + `#renderMyDesign()` to `Visualizer3D.mjs`,
  wire into the activate/render switches, return design name from `is3D()`.

### Adding a new URL-persisted option
1. Add a public static field on the module that owns the state.
2. In ModalOptions' `#buildDesignSection()` (or appropriate tab), build the UI
   row and wire its `input`/`change` listener to write the field and call
   `UrlParams.SetParam(...)`.
3. In `main.mjs`'s URL-hydration block, read the param and write the field.
4. If the option should show/hide per design, update the design-switch
   handler and `#syncAllControls`.

### Conventions
- ES2022 class fields, private `#` fields preferred for internal state.
- No bundler, no TypeScript. Use JSDoc for types where it helps.
- PHP endpoints return `{"success": boolean, …}`. Always catch `Throwable`
  and include a meaningful `message`.
- URL params live in the `#` hash (not `?`) so they never reach the server.
- Don't hard-code the production host; `Api.mjs` uses relative paths only.

### Committing
- `.gitignore` excludes `.claude/`, session files, media binaries
  (`.mp4` / `.gif` / `.jpg` / `.png` / `.webp`), and VS build output.
- Commit messages follow a brief subject-then-bullets style (see
  `git log --oneline`).

</details>

---

<details>
<summary>REST examples</summary>

### Open a shared layout
```
https://<host>/MusicPlayer/#layout=abc123-uuid
```
On load, `main.mjs` → `ModalLayoutDesigner.checkUrlLayout()` fetches via
`layoutManager.php?action=get_shared&id=abc123-uuid` and applies it.

### Launch with a specific visualizer + color
```
https://<host>/MusicPlayer/#design=lyricparticles&lyricCount=15000&lyricCurve=40&r=120&g=200&b=255
```

### Customise the Record Player
```
https://<host>/MusicPlayer/#design=recordplayer&recordText=My+Studio
```

### Start mic lyrics automatically
```
https://<host>/MusicPlayer/#design=lyricparticles&micLyrics=true
```
(First visit requires a user click to satisfy the browser's mic-permission
gesture requirement; subsequent loads with the param will re-prompt.)

</details>

---

<details>
<summary>License</summary>

See `LICENSE.txt`.

</details>
