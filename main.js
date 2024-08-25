import BitmapSub from './src/bitmap-subtitle.js';

const options = {
  fluid: true,
  controls: true,
  controlBar: { pictureInPictureToggle: false }
  // muted: true,
  // autoplay: true,
};

const player = videojs('sample', options);

player.on('ready', ev => {
  player.currentTime((60 * 72) + 25);
  player.bitmapsub({
    pathPrefix: '/tmp/',
    labelSuffix: ' ⋅BMP'
  });
  // player.hotkeys({ alwaysCaptureHotkeys: true })
});
