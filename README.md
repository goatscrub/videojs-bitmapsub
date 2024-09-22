# videojs-bitmapsub

This videojs plugin helps you displaying bitmap subtitle type, like vobsub (DVD) or pgssub (Blueray), into video.js player as images.
![vobsub](docs/vobsub.png)
![pgssub](docs/pgssub.png)
## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [How it works](#how-it-works)
  - [JS & CSS](#js--css)
  - [Setting up plugin](#setting-up-plugin)
    - [Plugin options and defaults values](#plugin-options-and-defaults-values)
  - [Append metadata tracks](#append-metadata-tracks)
    - [Examples](#examples)
- [What metadata track generated contains](#what-metadata-track-generated-contains)
- [[WIP]](#wip)
- [Crédits & inspiration](#cr%C3%A9dits--inspiration)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## How it works
This plugin can't handle vobsub or pgssub file as-is, you need to generate individual bitmap subtitle image and pack it into large images files. A webvtt metadata track file is used, describing which and when image must be displayed with its cues.  
With that description, plugin select corresponding image region from packed subtitles images and display at given time into your video.js player instance.  
This repository provide all you need to:
- extract and pack subtitles images from vobsub or pgssub
- generate corresponding webvtt metadata file description
- plugin to handle generated metadata track

> __**NOTE:**__ No OCR (Optical Character Recognition) involved into this process. Again, bitmap subtitles are displayed as images, and they are packed into bigger file only to avoid HTTP traffic, but it's not mandatory.
## Usage
### Prepare your data
Generate subtitles images packs
#### DVD .vob and .idx files — vob2imgpacked.php
For DVD subtitles, two files are needed, a `.vob` and a `.idx`. With vobsub2imgpacked.php you can specify one of them, second one is automaticaly find if they have same base name, only extension differs, eg: `vobsub.vob` and `vobsub.idx`.  
It's an ugly script wrapper arround `sub2png` executable. (Why in PHP ?)  
This script depend on `subp2png` binary and `bash` shell or compatible.
```sh
$ ./vob2imgpacked.php -i tmp/montypython/python.sub -o tmp/montypython/

$ ./vob2imgpacked.php -h
vobsub2imgpacked.php

 -c    Number of columns, default 4.
 -h    This help description.
 -i    Input vobsub file, .sub or .idx extension
 -l    Number of lines, default 64.
 -o    Output directory
 -v    Print program version.
```
#### Bluray pgssub
Python script, relatively slow.  
With default row and column values, pack image can easily have a resolution of `4000 × 6500` pixels.
```sh
$ ./pgssub2imgpacked.py /tmp/sample.fre.sup -t bitmap-subtitle/
1823 image saved.

$ ./pgssub2imgpacked.py -h

usage: pgssub2imgpacked.py [-h] [-c COLUMNS] [-d] [-r ROWS] [-l LIMIT] [-t TARGETDIRECTORY] filename

Read PGS (.sup) file and generate pack of subtitles images. You can optionnaly define number of rows and columns.

positional arguments:
  filename

options:
  -h, --help            show this help message and exit
  -c COLUMNS, --columns COLUMNS
                        number of columns within image pack, default: 4
  -d, --debug           temporary files are not remove
  -r ROWS, --rows ROWS  number of rows within image pack, default: 64
  -l LIMIT, --limit LIMIT
                        limit number of subtitle to be processed, for tests purposes
  -t TARGETDIRECTORY, --targetDirectory TARGETDIRECTORY
                        folder destination for files generated
```
### JS & CSS
Append CSS and javascript into your document.
```html
<link href="//path-plugin/dist/videojs-bitmapsub.min.css" rel="stylesheet" />
<script src="//path-plugin/dist/videojs-bitmapsub.js"></script>
```
### Setting up plugin
Two video.js classical ways, at video.js player creation:
```js
<script type="text/javascript">

// On player creation
const player_1 = videojs('sample', {
  plugins: {
    bitmapSubtitle: { pathPrefix: '/images-subtitles/' }
    }
  }
});

// Passing options directly to plugin
const player_2 = videojs('sample')
player.bitmapSubtitle({ pathPrefix: '/images-subtitles/' })

</script>
```
#### Plugin options and defaults values

|name|default|description|
|----|---|---|
|pathPrefix|`'/bitmapsub/'`|web path to your subtitles packed images files|
|labelPrefix|`''`|menu label prefix|
|labelSuffix|`' ⋅BMP'`|menu label suffix|
|name|bitmapsub|instance plugin name|

### Append metadata tracks
Bitmapsub plugin search for metadata tracks and filters them by specific label prefix. Label prefix is composed of `subtitle_type` follow by `video_size`, separated by colon.  
So to be recognized correctly, your label must match format: `subtitle_type:video_width:track_label`, with subtitle type defined as follow:
|type|example|description|
|---|---|---|
|`vobsub`|`label="vobsub:720:english"`|DVD source with video image width 720px and label text `english`|
|`pgssub`|`label="pgssub:1920:français"`|Bluray source with video image width 1920px and label text `français`|

#### Examples
```html
<!-- DVD -->
<track default src="/webvtt-path/file.eng.vtt" kind="metadata" label="pgssub:1920:english" language="eng" />

<!-- Bluray -->
<track src="/webvtt-path/file.fre.vtt" kind="metadata" label="pgssub:1920:français" language="fre" />
```

## What metadata track generated contains
```
WEBVTT - python.sub

NOTE Video size: 720x576
NOTE File generated with vob2imgpacked.php 2024-09-05 07:09:37
NOTE Cue format: bitmap-file.png:width:height:driftX:driftY

1
00:00:49.760 --> 00:00:51.239
python.1.vobsub.png 73:22:0:0

[...]
```
## [WIP]
- settings panel
- moving packing script to RUST
- append bitmap subtitles into subscapsmenu
- menu icon ?

## Crédits & inspiration
- [Presentation Graphic Stream (SUP files) BluRay Subtitle Format — Scorpius](https://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/)
- [EzraBC / pgsreader — github](https://github.com/EzraBC/pgsreader)
- [robjtede / sup-decode — github](https://github.com/robjtede/sup-decode)
- [DVD-Video Information](https://dvd.sourceforge.net/dvdinfo/)
- [yzi2004 / SupSubtitleParser — github](https://github.com/yzi2004/SupSubtitleParser)
- [patent: Method for RLE of a bitmap data stream](https://patentimages.storage.googleapis.com/ab/c6/ed/195ad89b2b8f10/US7912305.pdf)
- [mpeg program stream — wikipedia](https://en.wikipedia.org/wiki/MPEG_program_stream)
- [packetized elementary stream — wikipedia](https://en.wikipedia.org/wiki/Packetized_elementary_stream)
## License

MIT. Copyright (c) goatscrub Ludovic Mabilat


[videojs]: http://videojs.com/
