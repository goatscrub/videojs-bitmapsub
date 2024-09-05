#!/usr/bin/env php
<?php
// TODO: append debug, version, lines, column options
$prog = basename($argv[0]);
$options = getopt('dhi:o:v');
if (isset($options['h']) && $options['h'] === false) {
  echo $prog . PHP_EOL . PHP_EOL;
  echo ' -i    Input vobsub file, .sub or .idx extension' . PHP_EOL;
  echo ' -o    Output directory' . PHP_EOL;
  echo ' -d    Debug mode, don\'t remove generated files.' . PHP_EOL;
  echo ' -h    This help description.' . PHP_EOL;
  echo ' -v    Print program version.' . PHP_EOL;
  echo '' . PHP_EOL;
}
if (isset($options['i'])) {
  $opt_input = $options['i'];
} else {
  echo 'Input file name missing, abort.' . PHP_EOL;
  exit(1);
}
if (isset($options['o']) && is_dir($options['o'])) {
  $opt_output = $options['o'];
} else {
  echo 'Output directory does not exists, abort.' . PHP_EOL;
}

// TODO: skip NOTE line
$lines = 64;
$columns = 4;
require 'name-generator.php';

// search for corresponding .vob or .idx files
$pathInfo = pathinfo($opt_input);
$baseFilenamePath = implode(DIRECTORY_SEPARATOR, [$pathInfo['dirname'], $pathInfo['filename']]);
if (!file_exists($baseFilenamePath . '.vob') && !file_exists($baseFilenamePath . '.idx')) {
  printf("One of these files is missing: %s.vob or %s.idx, abort\n", $baseFilenamePath, $baseFilenamePath);
  exit(1);
}

$tmpFolderName = tempnam(sys_get_temp_dir(), $prog . '-');
if (file_exists($tmpFolderName)) {
  unlink($tmpFolderName);
  mkdir($tmpFolderName, 0700);
}

// generate png files from .vob and .idx files
$pngBaseFilesPath = implode(DIRECTORY_SEPARATOR, [$tmpFolderName, $pathInfo['filename']]);
$pngBaseFilesPath = str_replace(DIRECTORY_SEPARATOR . DIRECTORY_SEPARATOR, DIRECTORY_SEPARATOR, $pngBaseFilesPath);
$subp2pngCmd = sprintf('subp2png -n %s -o %s 1>/dev/null', $baseFilenamePath, $pngBaseFilesPath);
// generate vobsub images
echo "Generate vobsub images…\n";
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
      $screen_size = trim(explode(' ', $line)[1]);
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
echo 'Filter images…' . PHP_EOL;
for ($n = 1; $n <= $n_of_subs; $n++) {
  passthru(sprintf("mogrify -transparent 'rgb(255,255,255)' -trim %s%04d.png", $pngBaseFilesPath, $n));
}

// temporary packing, create columns of items
// compute zero leading pad
echo 'Pack columns…' . PHP_EOL;
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
echo 'Pack final file…' . PHP_EOL;
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

$vttFile = implode(DIRECTORY_SEPARATOR, [$opt_output, $pathInfo['filename'] . '.vtt']);
$vttHandle = fopen($vttFile, 'w');
// append vtt header file
fwrite($vttHandle, sprintf("WEBVTT - %s\n\n", $pathInfo['basename']));
fwrite($vttHandle, sprintf("NOTE Video size: %s\n", $idx_screen_size));
fwrite($vttHandle, sprintf("NOTE File generated with %s %s\n", $prog, date('Y-m-d H:m:s')));
fwrite($vttHandle, sprintf("NOTE Cue format: bitmap-file.png width:height:driftX:driftY\n"));

echo 'Process XML file…' . PHP_EOL;
// opening subp2png xml generated file
$xmlFile = implode(DIRECTORY_SEPARATOR, [$tmpFolderName, $pathInfo['filename'] . '.xml']);
[$drift_y, $drift_x] = [0, 0];
$largest = 0;
$imageCounter = 0;

$subtitles = simplexml_load_file($xmlFile);

foreach ($subtitles as $subtitle) {
  fwrite($vttHandle, sprintf(
    "\n%s\n%s --> %s\n",
    $subtitle['id'],
    $subtitle['start'],
    $subtitle['stop']
  ));
  // search for image line
  $filename = sprintf(
    '%s.%0' . $padding_final . 'd.vobsub.png',
    $pathInfo['filename'],
    ceil((($imageCounter + 1) / $lines) / $columns)
  );
  $imagick = new Imagick((string)$subtitle->image);
  [$width, $height] = [$imagick->getImageWidth(), $imagick->getImageHeight()];
  $imagick->clear();
  // each image file contains max_rows*max_columns
  // current column finished (reset y), add new column (update x with the previous largest one)
  // reset drift Y value and update drift X
  if (($imageCounter > 0) && ($imageCounter % $lines) == 0) {
    $drift_y = 0;
    $drift_x += $largest;
    $largest = 0;
  }
  // changing file because n of image = max_columns*max_rows
  // reset drift X value
  if (($imageCounter > 0) && ($imageCounter % ($lines * $columns) == 0)) {
    $drift_x = 0;
    $largest = 0;
  }
  // print current target filename, new cropped size
  fwrite(
    $vttHandle,
    sprintf(
      "%s %d:%d:%d:%d\n",
      $filename,
      $width,
      $height,
      $drift_x,
      $drift_y,
    )
  );
  // update drift_y value all times (rows)
  $drift_y += $height;
  $imageCounter++;
  // save max width cropped image encountered on each image, for drift X later use when changing column
  if ($width > $largest) $largest = $width;
}
fclose($vttHandle);
// move generated vobsub files into current directory
$cmd = sprintf('mv %s*.vobsub.png %s', $pngBaseFilesPath, $opt_output);
passthru($cmd);
// remove temporary directory and files
// test is completely useless but make me less anxious
echo "Cleaning up temporary files…\n";
if (str_starts_with($tmpFolderName, '/tmp/' . $prog . '-')) {
  passthru(sprintf('rm -rf %s', $tmpFolderName));
}
