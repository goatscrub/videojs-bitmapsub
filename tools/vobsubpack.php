#!/usr/bin/env php
<?php
// TODO: append debug option
define('VERSION', '0.9.2');
$prog = basename($argv[0]);
$options = getopt('c:dhi:r:o:v');
$format = " -%s    %s\n";
if (isset($options['h']) && $options['h'] === false) {
    echo $prog . "\n\n";
    $help_lines = [
        'c' => 'Number of columns, default 4.',
        // 'd' => "Debug mode, don't remove generated files.",
        'h' => 'This help description.',
        'i' => 'Input vobsub file, .sub or .idx extension',
        'r' => 'Number of rows, default 64.',
        'o' => 'Output directory',
        'v' => 'Print program version.',
    ];
    foreach ($help_lines as $opt => $description) {
        printf($format, $opt, $description);
    }
    echo "\n";
    exit(0);
}
if (isset($options['v'])) {
    echo VERSION . "\n";
    exit(0);
}
if (isset($options['i'])) {
    $opt_input = $options['i'];
} else {
    echo "Input file name missing, abort.\n";
    exit(1);
}
if (isset($options['o']) && is_dir($options['o'])) {
    $opt_output = $options['o'];
} else {
    echo "Output directory does not exists, abort.\n";
    exit(1);
}
// default column size
$columns = 4;
if (isset($options['c'])) {
    $columns = intval($options['c']);
    if ($columns <= 0) {
        echo "Column option must be an integer and greater than 0, abort.\n";
        exit(1);
    }
}
// default number of rows
$rows = 64;
if (isset($options['r'])) {
    $rows = intval($options['r']);
    if ($rows <= 0) {
        echo "Line option must be an integer and greater than 0, abort.\n";
        exit(1);
    }
}

function shellExec($cmd) {
    if (passthru($cmd . ' 1>/dev/null') != NULL) {
        echo $cmd . "\n";
        echo "Command execution failed, abort.\n";
        exit(1);
    }
}

class NameGenerator {

    private $times = 0;
    public $step = 1;
    public $loop = 0;
    public $baseFilename = '';
    public $filenameExtension = '';

    public function __construct(int $step = 1, string $baseFilename = 'file-', $extension = '') {
        $this->step = $step;
        $this->baseFilename = $baseFilename;
        $this->filenameExtension = $extension;
    }

    public function current() {
        return sprintf('%s%d%s', $this->baseFilename, $this->loop + 1, $this->filenameExtension);
    }

    public function next() {
        $this->times++;
        if ($this->times >= $this->step) {
            $this->loop++;
            $this->times = 0;
        }
        return $this->current();
    }

    public function totalTimes() {
        return ($this->loop * $this->step) + $this->times;
    }

    public function driftReset() {
        return $this->times ? false : true;
    }

    public function times() {
        return $this->times;
    }

    public function currentPass() {
        return sprintf('%02d', $this->loop);
    }

    public function previousPass() {
        return sprintf('%02d', $this->loop - 1);
    }

    public function currentRange() {
        return sprintf('%02d-%02d', $this->loop * $this->step,  $this->totalTimes());
    }

    public function previousRange() {
        return sprintf('%02d-%02d', $this->previousPass() * $this->step,  $this->totalTimes() - 1);
    }
}

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
$subp2pngCmd = sprintf('subp2png -n %s -o %s', $baseFilenamePath, $pngBaseFilesPath);
// generate vobsub images
echo "Generate vobsub images…\n";
shellExec($subp2pngCmd);

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
        shellExec(sprintf($cmd, (($n_loop - 1) * $packBy) + 1, $n_loop * $packBy, $n_loop));
        $n_loop++;
    }
    // check if extra pack needed with the rest of totalItems
    $rest = $totalItems % $packBy;
    if ($rest > 0) {
        shellExec(sprintf($cmd, $totalItems - $rest + 1, $totalItems, $n_loop));
        $n_loop++;
    }
    return $n_loop - 1;
}

$idxMeta = idxMetadata();
[$n_of_subs, $idx_screen_size] = [$idxMeta[0], $idxMeta[1]];
// filter images
echo "Filter images…\n";
for ($n = 1; $n <= $n_of_subs; $n++) {
    shellExec(sprintf("mogrify -transparent 'rgb(255,255,255)' -trim %s%04d.png", $pngBaseFilesPath, $n));
}

// temporary packing, create columns of items
// compute zero leading pad
echo "Pack columns…\n";
$padding_generated = strlen(ceil($n_of_subs / $rows));
$cmd = sprintf(
    "/bin/bash -c \"convert %s{%%04d..%%04d}.png -append %s.%%0%dd.tmp.png\"",
    $pngBaseFilesPath,
    $pngBaseFilesPath,
    $padding_generated
);
// return number of files generated
$generated_files = fileRangePack($n_of_subs, $rows, $cmd);
// compute zero leading pad for final stage files
echo "Pack final file…\n";
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
fwrite($vttHandle, sprintf("NOTE Cue format: bitmap-file.png:width:height:driftX:driftY\n"));

echo "Process XML file…\n";
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
        ceil((($imageCounter + 1) / $rows) / $columns)
    );
    $imagick = new Imagick((string)$subtitle->image);
    [$width, $height] = [$imagick->getImageWidth(), $imagick->getImageHeight()];
    $imagick->clear();
    // each image file contains max_rows*max_columns
    // current column finished (reset y), add new column (update x with the previous largest one)
    // reset drift Y value and update drift X
    if (($imageCounter > 0) && ($imageCounter % $rows) == 0) {
        $drift_y = 0;
        $drift_x += $largest;
        $largest = 0;
    }
    // changing file because n of image = max_columns*max_rows
    // reset drift X value
    if (($imageCounter > 0) && ($imageCounter % ($rows * $columns) == 0)) {
        $drift_x = 0;
        $largest = 0;
    }
    // print current target filename, new cropped size
    fwrite(
        $vttHandle,
        sprintf(
            "%s:%d:%d:%d:%d\n",
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
shellExec($cmd);
// remove temporary directory and files
// test is completely useless but make me less anxious
echo "Cleaning up temporary files…\n";
if (str_starts_with($tmpFolderName, '/tmp/' . $prog . '-')) {
    shellExec(sprintf('rm -rf %s', $tmpFolderName));
}
