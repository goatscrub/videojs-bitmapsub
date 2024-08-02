<?php
//var_dump($_SERVER);
//exit();
//if ('//' . $_SERVER['SERVER_NAME'] . ':' . $_SERVER['SERVER_PORT'] != $HTTP_HOST) {
//    header('Location: http:' . $_SERVER['HTTP_HOST']);
//    exit();
//}
// send 206 code when mp4 extension request
$uri = $_SERVER['REQUEST_URI'];
if (preg_match('/\.mp4$/', $uri)) {
    $filepath = DIRECTORY_SEPARATOR . join([$_SERVER['DOCUMENT_ROOT'], $uri]);
    if (!file_exists($filepath)) {
        http_response_code(404);
        // add request log
        error_log(sprintf(
            '[33m%s:%d [%d]: %s %s - No such file or directory[0m',
            $_SERVER['REMOTE_ADDR'],
            $_SERVER['REMOTE_PORT'],
            http_response_code(),
            $_SERVER['REQUEST_METHOD'],
            $_SERVER['REQUEST_URI']
        ));
        return true;
    }
    $finfo = finfo_open(FILEINFO_MIME);
    $mime = finfo_file($finfo, $filepath);
    // send headers
    $size = filesize($filepath);
    header('HTTP/1.1 206 Partial Content');
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . $size);
    header('Content-Range: bytes 0-' . ($size - 1) . '/' . $size);
    header('Content-Type: ' . $mime);
    $fp = fopen($filepath, 'rb');
    fpassthru($fp);
    fclose($fp);
    // add request log
    error_log(sprintf(
        '[32m%s:%d [%d]: %s %s[0m',
        $_SERVER['REMOTE_ADDR'],
        $_SERVER['REMOTE_PORT'],
        http_response_code(),
        $_SERVER['REQUEST_METHOD'],
        $_SERVER['REQUEST_URI']
    ));
    return true;
} else {
    return false;
}
