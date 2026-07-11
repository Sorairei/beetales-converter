# BeeTales Media Converter

A static web app for converting media files directly in the browser with ffmpeg.wasm. It can extract audio, convert WebM to MP4, and optimize existing MP4 videos without a backend, database, cookies, analytics, or online conversion service.

## Current Version

This version includes two conversion modes:

| Mode | Input | Output | Purpose |
| --- | --- | --- | --- |
| Extract audio | Video files such as MP4, MOV, MKV, WebM | MP3, WAV, AAC | Create audio files from video sources |
| Convert or optimize MP4 | `.webm` and `.mp4` video files | MP4 | Convert WebM or resize, trim, and recompress existing MP4 videos |

## Features

- Local browser-based conversion, with no server uploads.
- Supports audio output as `mp3`, `wav`, and `aac`.
- Supports WebM to MP4 video conversion.
- Supports MP4-to-MP4 optimization with trimming, resolution, and quality controls.
- Supports selecting, reviewing, and converting multiple files in one queue.
- Supports optional time-based trimming with `MM:SS` or `HH:MM:SS` start and end values.
- Provides smaller, balanced, and high-quality MP4 presets plus original, 1080p, 720p, and 480p resolution choices.
- Shows a local preview with duration and resolution before conversion.
- Tracks pending, active, completed, failed, and cancelled queue items individually.
- Validates trim values against the real duration of the selected files.
- Lets users safely cancel an active conversion while keeping completed results available.
- Lets users choose `128k`, `192k`, or `320k` bitrate.
- Displays per-file and overall progress, individual download links, and before/after file sizes.
- Modern responsive English interface.
- Releases the ffmpeg.wasm worker after each conversion to reduce memory usage.
- Includes ffmpeg.wasm as local static files in `vendor/ffmpeg`.

## Structure

```text
Converter/
|-- index.html
|-- style.css
|-- app.js
|-- assets/
|   |-- beetales-converter-hero.png
|   `-- beetales-logo.png
|-- vendor/
|   `-- ffmpeg/
|       |-- core/
|       |-- ffmpeg/
|       `-- util/
|-- README.md
`-- README2.md
```

## How It Works

The app runs fully in the browser:

1. The user selects or drops one or more local video files.
2. JavaScript validates the files and builds a removable conversion queue.
3. ffmpeg.wasm is loaded from the local `vendor/ffmpeg` folder.
4. Each selected file is written to ffmpeg's in-browser virtual filesystem and converted sequentially.
5. Each output is converted into a browser `Blob` with its own download link.
6. The interface compares the original and converted file sizes.
7. Temporary ffmpeg files are removed after every item and worker memory is released after the queue finishes.

No files are uploaded to any server.

## Local Use

For browser security reasons, serve the app from a local web server instead of opening the HTML file directly.

With Python:

```bash
cd video-to-audio-web
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

On Windows, if `python` is not available globally, use any local static server or open the project through a hosted environment such as GitHub Pages.

Opening `index.html` directly with `file://` is not recommended because browsers can block JavaScript modules, Web Workers, or WebAssembly files required by ffmpeg.wasm.

## GitHub Pages Deployment

The app can run on GitHub Pages because it is fully static.

Recommended repository contents:

```text
index.html
style.css
app.js
assets/
vendor/
README.md
README2.md
```

Make sure the `vendor/ffmpeg` folder is committed. The converter depends on these local ffmpeg.wasm files and does not load the conversion engine from a CDN.

After enabling GitHub Pages, open the published `https://...github.io/.../` URL instead of opening the file directly from your computer.

## Deploying With Nginx on Ubuntu

1. Install Nginx:

```bash
sudo apt update
sudo apt install nginx -y
```

2. Copy the files to the web directory:

```bash
sudo mkdir -p /var/www/video-to-audio-web
sudo cp -r index.html style.css app.js assets vendor README.md README2.md /var/www/video-to-audio-web/
sudo chown -R www-data:www-data /var/www/video-to-audio-web
```

3. Create the server block:

```bash
sudo nano /etc/nginx/sites-available/video-to-audio-web
```

Suggested configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/video-to-audio-web;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    types {
        text/html html;
        text/css css;
        application/javascript js;
        application/wasm wasm;
    }

    add_header X-Content-Type-Options nosniff;
}
```

4. Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/video-to-audio-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

5. Optional but recommended: enable HTTPS with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

- The first conversion can take longer because the browser loads ffmpeg.wasm from local static files.
- Large files require more memory and processing time.
- MP4 conversion and optimization are more CPU-intensive than audio extraction and may take longer.
- If the MP4 mode appears on screen but does not update the form when selected, the browser is probably blocking `app.js` because the app was opened with `file://`. Serve the folder from a local web server or GitHub Pages.
- If a `Worker` or `SecurityError` appears, verify that the browser is loading the current `app.js` version and that the `vendor/ffmpeg` folder was fully deployed.
- If ffmpeg finishes without generating a file, make sure the video contains a compatible audio track.
- The app does not depend on a CDN during conversion. It serves `@ffmpeg/ffmpeg`, `@ffmpeg/core`, and `@ffmpeg/util` locally from `vendor/ffmpeg`.

## Privacy and Security

- No backend is used.
- No database is used.
- No cookies are created.
- No analytics are included.
- Files stay in the user's browser during conversion.
- Generated downloads are temporary local object URLs created by the browser.
