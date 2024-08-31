<?php

$parser = xml_parser_create();
$xml_file = 'python.xml';

function filename() {
    return sprintf($filanem = '%s.%0' . $padding_final . 'd.vobsub.png');
    // $pathInfo['filename'], ceil((($imageCounter + 1) / $lines) / $columns);
}

function handleImage() {
    // search for image line
    $filename = filename($pathInfo['filename'], ceil((($imageCounter + 1) / $lines) / $columns));
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

function openTag($parser, $name, $attributes) {
    switch ($name) {
        case 'SUBTITLE':
            printf("\n%s\n%s --> %s\n", $attributes['ID'], $attributes['START'], $attributes['STOP']);
            break;
        case 'IMAGE':
            print_r($attributes);
            exit(3);
            handleImage();
            break;
        default:
            return;
    }
}

function closeTag($parser, $name) {
    echo $name . "\n";
}

xml_set_element_handler($parser, 'openTag', 'closeTag');
$fp = fopen($xml_file, 'r');
while ($data = fread($fp, 4046)) {
    xml_parse($parser, $data, feof($fp));
}
xml_parser_free($parser);
