#!/usr/bin/env php
<?php
$lines = 128;
$columns = 4;

require 'name-generator.php';
if ($argc <= 1) {
    echo "vobsub filename needed, abort.\n";
    exit(1);
}
// search for corresponding .vob or .idx files
$pathInfo = pathinfo($argv[1]);
$baseFilenamePath = implode(DIRECTORY_SEPARATOR, [$pathInfo['dirname'], $pathInfo['filename']]);
if (!file_exists($baseFilenamePath . '.vob') && !file_exists($baseFilenamePath . '.idx')) {
    printf("Files %s.vob or %s.idx missing, abort\n", $baseFilenamePath, $baseFilenamePath);
    exit(1);
}

$tmpFolderName = tempnam(sys_get_temp_dir(), 'vobsub-');
if (file_exists($tmpFolderName)) {
    unlink($tmpFolderName);
    mkdir($tmpFolderName, 0700);
}

// generate png files from .vob and .idx files
$pngBaseFilesPath = implode(DIRECTORY_SEPARATOR, [$tmpFolderName, $pathInfo['filename']]);
$pngBaseFilesPath = str_replace(DIRECTORY_SEPARATOR . DIRECTORY_SEPARATOR, DIRECTORY_SEPARATOR, $pngBaseFilesPath);
$subp2pngCmd = sprintf('subp2png -n %s -o %s 1>/dev/null', $baseFilenamePath, $pngBaseFilesPath);
// generate vobsub images
passthru($subp2pngCmd);

function idxMetadata() {
    // count number of subtitle available in .idx file
    global $baseFilenamePath;
    [$f_temp, $counter] = [fopen($baseFilenamePath . '.idx', 'r'), 0];
    while (($line = fgets($f_temp)) !== false) {
        if (str_starts_with($line, 'timestamp: ')) $counter++;
    }
    rewind($f_temp);
    $screen_size = 'screen size unknown';
    while (($line = fgets($f_temp)) !== false) {
        if (str_starts_with($line, 'size: ')) {
            $screen_size = explode(' ', $line)[1];
            break;
        }
    }
    fclose($f_temp);
    return [$counter, $screen_size];
}

function fileRangePack($totalItems, $packBy, $cmd) {
    $min_packs = floor($totalItems / $packBy);
    $n_loop = 1;
    while ($n_loop <= $min_packs) {
        // second cmd pass, set start, end and loop values
        passthru(sprintf($cmd, (($n_loop - 1) * $packBy) + 1, $n_loop * $packBy, $n_loop));
        $n_loop++;
    }
    // check if extra pack needed with the rest of totalItems
    $rest = $totalItems % $packBy;
    if ($rest > 0) {
        passthru(sprintf($cmd, $totalItems - $rest + 1, $totalItems, $n_loop));
        $n_loop++;
    }
    return $n_loop - 1;
}

$idxMeta = idxMetadata();
[$n_of_subs, $idx_screen_size] = [$idxMeta[0], $idxMeta[1]];
// filter images
for ($n = 1; $n <= $n_of_subs; $n++) {
    passthru(sprintf("mogrify -transparent 'rgb(255,255,255)' -trim %s%04d.png", $pngBaseFilesPath, $n));
}

// temporary packing, create columns of items
// compute zero leading pad
$padding_generated = strlen(ceil($n_of_subs / $lines));
$cmd = sprintf(
    "/bin/bash -c \"convert %s{%%04d..%%04d}.png -append %s.%%0%dd.tmp.png\"",
    $pngBaseFilesPath,
    $pngBaseFilesPath,
    $padding_generated
);
// return number of files generated
$generated_files = fileRangePack($n_of_subs, $lines, $cmd);
// compute zero leading pad for final stage files
$padding_final = strlen(ceil($generated_files / $columns));
$cmd = sprintf(
    "/bin/bash -c \"convert %s.{%%0%dd..%%0%dd}.tmp.png +append %s.%%0%dd.vobsub.png\"",
    $pngBaseFilesPath,
    $padding_generated,
    $padding_generated,
    $pngBaseFilesPath,
    $padding_final
);
// final packing, create rows of columns items
fileRangePack($generated_files, $columns, $cmd);

// define line regexes
$timestamp = '((\d{2}:){2}\d{2}\.\d{3})';
$subtitle = '^\s*<subtitle id="(\d+)"\s+start="' . $timestamp . '"\s+stop="' . $timestamp . '">$';
$image = '^\s*<image>(.+)<\/image>$';

$vttFile = $pathInfo['filename'] . '.vtt';
$vttHandle = fopen($vttFile, 'w');
// append vtt header file
fwrite($vttHandle, sprintf("WEBVTT - %s - %s\n", $pathInfo['filename'], $idx_screen_size));
// opening subp2png xml generated file
$xmlFile = implode(DIRECTORY_SEPARATOR, [$tmpFolderName, $pathInfo['filename'] . '.xml']);
$fp = fopen($xmlFile, 'r');

[$drift_y, $drift_x] = [0, 0];
$largest = 0;
$imageCounter = 0;
while (($line = fgets($fp)) !== false) {
    // search for subtitle line
    preg_match("/$subtitle/", $line, $matches);
    if ($matches) {
        fwrite($vttHandle, sprintf("\n%s\n%s --> %s\n", $matches[1], $matches[2], $matches[4]));
        continue;
    }

    // search for image line
    preg_match("/$image/", $line, $matches);
    $filename = sprintf(
        '%s.%0' . $padding_final . 'd.vobsub.png',
        $pathInfo['filename'],
        ceil((($imageCounter + 1) / $lines) / $columns)
    );
    $imagick = new Imagick($matches[1]);
    [$width, $height] = [$imagick->getImageWidth(), $imagick->getImageHeight()];
    $original = sprintf('%d:%d', $width, $height);
    $imagick->clear();
    // reset drift Y value and update drift X
    if (($imageCounter > 0) && ($imageCounter % $lines) == 0) {
        $drift_y = 0;
        $drift_x += $largest;
        $largest = 0;
    }
    // reset drift X value
    if (($imageCounter > 0) && ($imageCounter % ($lines * $columns) == 0)) {
        $drift_x = 0;
        $largest = 0;
    }
    // print current target filename, new cropped size and original size
    fwrite(
        $vttHandle,
        sprintf(
            "%s %d×%d:%d:%d org:%s\n",
            $filename,
            $width,
            $height,
            $drift_y,
            $drift_x,
            $original
        )
    );
    // update drift_y value all times
    $drift_y += $height;
    $imageCounter++;
    // save max width cropped image encountered on each image, for drift X later use
    if ($width > $largest) {
        $largest = $width;
    }
}
fclose($fp);
fclose($vttHandle);
// move generated vobsub files into current directory
$cmd = sprintf('mv %s*.vobsub.png .', $pngBaseFilesPath);
passthru($cmd);
// remove temporary directory and files
// test is completely useless but make me less anxious
if (str_starts_with($tmpFolderName, '/tmp/vobsub-')) {
    passthru(sprintf('rm -rf %s', $tmpFolderName));
}
