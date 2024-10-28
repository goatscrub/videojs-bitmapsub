/*
 | For up-to-date information about the options:
 |   http://www.browsersync.io/docs/options/
 */
const workflow = '/home/gnuk/workflow/';
const bitmapsub = `${workflow}videojs-bitmapsub/`;
const debugJs = '<script src="../dev/debug.js"></script>';
const debugCss = '<link rel="stylesheet" href="../dev/debug.css">';

module.exports = {
  files: [
    'dist/videojs-bitmapsub.js',
    'dist/videojs-bitmapsub.css',
    'docs/index.html'
  ],
  serveStatic: [{ route: '/videojs-bitmapsub', dir: 'docs/' }],
  watch: true,
  server: true,
  ui: false,
  open: false,
  notify: false,
  ghostMode: false,
  directory: false,
  listen: 'demo.videojs-bitmapsub.test',
  startPath: 'videojs-bitmapsub',
  snippetOptions: {
    // Provide a custom Regex for inserting the snippet.
    rule: {
      match: /<\/head>/i,
      fn(snippet, match) {
        return [debugJs, debugCss, snippet, match].join('\n');
      }
    }
  }
};
