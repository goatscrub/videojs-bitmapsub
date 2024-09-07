# videojs-bitmapsub

This videojs plugin helps you displaying bitmap subtitle type, like vobsub (DVD) or pgssub (Blueray), into video.js player as images.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

  - [How it works](#how-it-works)
  - [Usage](#usage)
    - [Setting up plugin](#setting-up-plugin)
    - [Plugin options and defaults values](#plugin-options-and-defaults-values)
  - [Prepare your data](#prepare-your-data)
  - [How to configure your track](#how-to-configure-your-track)
    - [Examples](#examples)
  - [What metadata track contains](#what-metadata-track-contains)
  - [script to generate tiled images](#script-to-generate-tiled-images)
    - [DVD vobsub vob2imgpacked.php](#dvd-vobsub-vob2imgpackedphp)
    - [Bluray pgssub](#bluray-pgssub)
- [Crédits](#cr%C3%A9dits)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## How it works
This plugin can't handle vobsub or pgssub file as-is, you need to generate individual bitmap subtitle image and pack it into large images files. With a  webvtt metadata track file describe which and when image must be displayed with its cues.  
With that description, plugin select corresponding image region from packed images and display at given time into your player instance.  
This repository provide all you need to:
- extract subtitles images from vobsub or pgssub
- pack individual images into bigger ones
- generate corresponding webvtt metadata file description

> __**NOTE:**__ No OCR (Optical Character Recognition) involved into this process. Again, bitmap subtitles are displayed as images, and they are packed into bigger file only to avoid HTTP traffic, but it's not mandatory.
## Usage
Append CSS and javascript into your document. **CSS link need a specific id**: `css-bitmap-subtitle`:
```
<link href="//path-plugin/dist/videojs-bitmapsub.min.css" rel="stylesheet" id="css-bitmap-subtitle" />
<script src="//path-plugin/dist/videojs-bitmapsub.js"></script>
```
### Setting up plugin
Two video.js classical ways, at video.js player creation:
```
<!-- @ player creation -->
<script type="text/javascript">
videojs('sample', {
  plugins: {
    bitmapSubtitle: { pathPrefix: '/images-subtitles/'}
    }
  }
});
</script>

<!-- @ passing options directly to plugin -->
<script type="text/javascript">
const player=videojs('sample')
player.bitmapSubtitle({ pathPrefix: '/images-subtitles/'})
</script>
```
### Plugin options and defaults values

|name|default|description|
|----|---|---|
|pathPrefix|`'/bitmapsub/'`|web path to your subtitles packed images files|
|labelPrefix|`''`|menu label prefix|
|labelSuffix|`' ⋅BMP'`|menu label suffix|
|name|bitmapsub|plugin name|

## Prepare your data
### Generate subtitles images packs
#### DVD .vob and .idx files — vob2imgpacked.php
For DVD subtitles, two files are needed, a `.vob` and a `.idx`. With vobsub2imgpacked.php you can specify one of them, second one is automaticaly find.  
It's an ugly script wrapper arround `sub2png` executable. (Why in PHP ?)
```
./vob2imgpacked.php -i tmp/montypython/python.sub -o tmp/montypython/

./vob2imgpacked.php -h
vobsub2imgpacked.php

 -i    Input vobsub file, .sub or .idx extension
 -o    Output directory
 -d    Debug mode, don't remove generated files.
 -h    This help description.
 -v    Print program version.

```
### Bluray pgssub
Python script, relatively slow. default columns and row values .sup files
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
- image
- metadata track
## How to configure your track
Bitmapsub plugin search for metadata track and filters them by label prefix.  
Label prefix format is: `subtitle_type:video_width:track_label`
|type|example|description|
|---|---|---|
|`vobsub`|`label="vobsub:720:english"`|DVD source with video image width 720px and label text `english`|
|`pgssub`|`label="pgssub:1920:français"`|Bluray source with video image width 1920px and label text `françFais`|

### Examples
```
<!-- DVD -->
<track default src="/webvtt-path/file.vtt" kind="metadata" label="pgssub:1920:english" language="eng" />
<!-- bluray -->
<track src="/webvtt-path/file.vtt" kind="metadata" label="pgssub:1920:français" language="fre" />
```

## What metadata track contains
```
WEBVTT - python.sub

NOTE Video size: 720x576
NOTE File generated with vob2imgpacked.php 2024-09-05 07:09:37
NOTE Cue format: bitmap-file.png width:height:driftX:driftY

1
00:00:49.760 --> 00:00:51.239
python.1.vobsub.png 73:22:0:0
```

# Crédits
differentes sources de docs, vobsub & pgssub
de code pgsreader et inspiration
- [Presentation Graphic Stream (SUP files) BluRay Subtitle Format](https://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/)
- [packetized elementary stream](https://en.wikipedia.org/wiki/Packetized_elementary_stream)
- [pgsreader](https://github.com/EzraBC/pgsreader)
- [mpeg program stream — wikipedia](https://en.wikipedia.org/wiki/MPEG_program_stream)
- [Packetized Elementary Stream Headers](https://dvd.sourceforge.net/dvdinfo/pes-hdr.html)
- [sup-decode](https://github.com/robjtede/sup-decode/blob/master/src/decode/rle.rs)
- [SupSubtitleParser](https://github.com/yzi2004/SupSubtitleParser)
- [pattent](https://patentimages.storage.googleapis.com/ab/c6/ed/195ad89b2b8f10/US7912305.pdf)
## License

MIT. Copyright (c) goatscrub Ludovic Mabilat


[videojs]: http://videojs.com/
