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
  serveStatic: [
    {
      route: '/fonts',
      dir: '/home/gnuk/workflow/common/fonts/'
    },
    {
      route: '/favicons',
      dir: '/home/gnuk/workflow/common/favicons/'
    }
  ],
  listen: 'videojs-bitmapsub.test',
  cwd: 'examples/',
  ui: false,
  open: false,
  notify: false,
  ghostMode: false
};
