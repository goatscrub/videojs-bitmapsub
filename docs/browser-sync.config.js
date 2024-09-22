/*
 | For up-to-date information about the options:
 |   http://www.browsersync.io/docs/options/
 */
module.exports = {
  files: [
    'dist/videojs-bitmapsub.js',
    'dist/videojs-bitmapsub.css',
    'index.html'
  ],
  watch: true,
  server: true,
  listen: 'videojs-bitmapsub.test',
  ui: false,
  open: false,
  notify: false,
  ghostMode: false
};
