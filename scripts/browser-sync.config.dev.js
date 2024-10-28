/*
 | For up-to-date information about the options:
 |   http://www.browsersync.io/docs/options/
 */
const workflow = '/home/gnuk/workflow/';
const bitmapsub = `${workflow}videojs-bitmapsub/`;

module.exports = {
  files: [
    'dist/videojs-bitmapsub.js',
    'dist/videojs-bitmapsub.css',
    'index.html',
    `${bitmapsub}test/dist/coverage/index.html`
  ],
  serveStatic: [
    {
      route: '/favicons',
      dir: `${workflow}/common/favicons/`
    },
    {
      route: '/plugin',
      dir: `${bitmapsub}dist/`
    },
    {
      route: '/docs',
      dir: `${bitmapsub}docs/`
    },
    {
      route: '/samples',
      dir: `${bitmapsub}docs/samples/`
    },
    {
      route: '/source',
      dir: `${bitmapsub}source.github/dist/`
    },
    {
      route: '/nodeModules',
      dir: `${bitmapsub}node_modules/video.js/dist/`
    },
    { route: '/coverage', dir: `${bitmapsub}test/dist/coverage/` }
  ],
  watch: true,
  server: true,
  ui: false,
  open: false,
  notify: false,
  ghostMode: false,
  directory: false,
  listen: 'videojs-bitmapsub.test'
};
