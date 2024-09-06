# videojs-bitmapsub

This videojs plugin helps you displaying bitmap subtitle type, like vobsub (DVD: .vob and .idx) or pgssub (Blueray: .sup), into video.js player as image.

It can't handle vobsub or pgssub file as-is, you need to generate individual bitmap subtitle image and pack it into large images files. After that, plugin select a subtitle by surrounding it one and display into your player instance.  
This repository provide all you need to extract subtitle image from vobsub or pgssub and pack all this images into bigger ones.

No OCR involved into this process. Bitmap subtitles are displayed as image, and they are packed into bigger file to avoid HTTP traffic, but it's not mandatory.
## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

  - [What you need](#what-you-need)
    - [options available and defaults](#options-available-and-defaults)
  - [script to generate tiled images](#script-to-generate-tiled-images)
    - [DVD vobsub vob2imgpacked.php](#dvd-vobsub-vob2imgpackedphp)
    - [Bluray pgssub](#bluray-pgssub)
- [Crédits](#cr%C3%A9dits)
  - [Installation](#installation)
  - [Usage](#usage)
    - [`<script>` Tag](#script-tag)
    - [Browserify/CommonJS](#browserifycommonjs)
    - [RequireJS/AMD](#requirejsamd)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## What you need

install pluing and add it to your player, with:
```
npm install --save-dev videojs-bitmapsub
```

Append plugin and CSS:
```
<link href="dist/videojs-bitmapsub.css" rel="stylesheet" id="css-bitmap-subtitle" />
<script src="dist/videojs-bitmapsub.js"></script>
```
append to your video.js player with option:
```
player_vobsub.bitmapSubtitle({pathPrefix: '/tmp/montypython/'})
```

### options available and defaults

|name|default|description|
|----|---|---|
|pathPrefix|'/bitmapsub/'|relative path to your tiled image files|
|labelPrefix|''|menu label prefix|
|labelSuffix|' ⋅BMP'|menu label suffix|
|name|bitmapsub|plugin name|

## script to generate tiled images
### DVD vobsub vob2imgpacked.php
It's an ugly script wrapper arround sub2png.
```
./vob2imgpacked.php -i tmp/montypython/python.sub -o tmp/montypython/
```
### Bluray pgssub
Python script, relatively slow. default columns and row values
```
usage: pgssub2imgpacked.py [-h] [-c COLUMNS] [-d] [-r ROWS] [-l LIMIT] [-t TARGETDIRECTORY] filename

PGS .sup file reader

positional arguments:
  filename

options:
  -h, --help            show this help message and exit
  -c COLUMNS, --columns COLUMNS
  -d, --debug
  -r ROWS, --rows ROWS
  -l LIMIT, --limit LIMIT
  -t TARGETDIRECTORY, --targetDirectory TARGETDIRECTORY

```

# Crédits
differentes sources de docs, vobsub & pgssub
de code pgsreader et inspiration

## Installation

```sh
npm install --save videojs-bitmapsub
```

## Usage

To include videojs-bitmapsub on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-bitmapsub.min.js"></script>
<script>
  var player = videojs('my-video');

  player.bitmapsub();
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-bitmapsub via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');

// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('videojs-bitmapsub');

var player = videojs('my-video');

player.bitmapsub();
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', 'videojs-bitmapsub'], function(videojs) {
  var player = videojs('my-video');

  player.bitmapsub();
});
```

## License

MIT. Copyright (c) goatscrub Ludovic Mabilat


[videojs]: http://videojs.com/
