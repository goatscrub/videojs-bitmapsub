import videojs from 'video.js';
import {version as VERSION} from '../package.json';
import {window, screen, document} from 'global';

const VjsComponent = videojs.getComponent('Component');

/**
 * the description
 */
class BitmapSubComponent extends VjsComponent {

  /** constructor
   *
   * @param {videojs} player - main videojs player
   * @param {Object} options - bitmap subtitle options
   */
  constructor(player, options) {
    super(player, options);
  }

  /**
   * create bitmap subtitle DOM container
   *
   * @return {DOM} - dom representation of component
   */
  createEl() {
    const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' });
    const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' });

    container.appendChild(subtitle);
    return container;
  }
}

const Plugin = videojs.getPlugin('plugin');
// Default options for the plugin.
const defaults = {
  pathPrefix: '/bitmapsub/',
  labelPrefix: '',
  labelSuffix: ' ⋅BMP',
  name: 'bitmapsub'
};

/**
 * An advanced Video.js plugin. For more information on the API
 *
 * See: https://blog.videojs.com/feature-spotlight-advanced-plugins/
 */
class Bitmapsub extends Plugin {

  /**
   * TODO: passthrough subtitle
   * TODO: don't display subtitle if player won't play
   * Create a Bitmapsub plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  constructor(player, options) {
    // the parent class will add player under this.player
    super(player);
    this.options = videojs.obj.merge(defaults, options);
    this.player = player;
    this.init();
  }

  /**
     * Initialize plugin: search against track if plugin can handle one
     * append bitmap subtitle component
     * create corresponding menu subtitles entries and click handlers
     * handle default track if exists
     * append event listeners, on screen size change, fullscreen change, and cue change
     *
     */
  init() {
    // save tracks
    this.tracks = this.player.textTracks();
    // instantiate Bitmap Subtitle Component
    this.bmpComponent = new BitmapSubComponent(this.player, this.options);
    const VjsSubsCapsMenuItem = videojs.getComponent('SubsCapsMenuItem');
    // off subtitle button

    this.offSubtitle = this.player.controlBar.subsCapsButton.menu.children().find(c => c.constructor.name === 'OffTextTrackMenuItem');
    let hasBitmapSubtitle = 0;
    // build menu tracks and associate clicks

    for (let i = 0; i < this.tracks.length; i++) {
      if (this.tracks[i].kind !== 'metadata' && !this.tracks[i].label.startsWith('bitmap:')) {
        return;
      }
      // build new menu item
      const item = new VjsSubsCapsMenuItem(this.player, {
        track: {
          label: this.options.labelPrefix + this.tracks[i].label.split(':')[2] + this.options.labelSuffix,
          language: this.tracks[i].language,
          id: this.tracks[i].id,
          default: this.tracks[i].default
        }
      });
      // add native bitmap subtitle size

      this.tracks[i].bitmapsub = { width: this.tracks[i].label.split(':')[1] };
      if (this.tracks[i].default) {
        this.tracks[i].mode = 'hidden';
        this.currentSubtitle = this.tracks[i];
        this.selectItem(item);
      } else {
        this.tracks[i].mode = 'disabled';
      }
      item.handleClick = () => {
        this.selectItem(item);
        this.changeTrack(item.track.id);
      };
      // append item to subtitle menu
      this.player.controlBar.subsCapsButton.menu.addChild(item);
      hasBitmapSubtitle += 1;
    }

    if (!hasBitmapSubtitle) {
      // console.log('no bitmap subtitle on this player');
      return;
    }

    // console.log('here ?');
    this.css = [...document.styleSheets]
      .find(css => css.ownerNode.id === 'css-bitmap-subtitle').cssRules;
    this.activeContainerStyle = [...this.css].find(r => r.selectorText === '#bitmapsub-container').style;
    this.offSubtitle.handleClick = () => {
      // on click disable all bitmap subtitle metadata tracks
      for (let i = 0; i < this.tracks.length; i++) {
        this.tracks[i].mode = 'disabled';
      }
      this.disableSubtitle();
    };
    this.subtitle = this.bmpComponent.el().querySelector('#bitmap-subtitle');
    this.player.addChild(this.bmpComponent);
    // force displaying subtitle button into menu
    this.player.controlBar.subsCapsButton.show();

    // TODO move into handle function
    this.player.on('fullscreenchange', this.adjustSubtitleBottom.bind(this));

    this.player.on('playerresize', this.handlePlayerResize.bind(this));
    if (!this.currentSubtitle) {
      return;
    }
    this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
  }

  /**
     * handle bitmap subtitle component size on player resize
     */
  handlePlayerResize() {
    if (!this.currentSubtitle) {
      return;
    }
    const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.bitmapsub.width).toFixed(2);

    this.bmpComponent.el().style.scale = `${scaleSize}`;
    this.adjustSubtitleBottom();
  }

  /**
     * unselected all bitmap subtitle entries
     * select 'subtitle off' in menu
     * TODO: test if other subtitle available
    */
  disableSubtitle() {
    this.player.controlBar.subsCapsButton.menu
      .children().forEach(e => e.removeClass('vjs-selected'));
    this.offSubtitle.addClass('vjs-selected');
    this.bmpComponent.hide();
  }

  /**
   * select a bitmap subtitle into the menu
   *
   * @param {int} item - need to be completed todo
   */
  selectItem(item) {
    this.disableSubtitle();
    this.bmpComponent.show();
    this.offSubtitle.removeClass('vjs-selected');
    item.addClass('vjs-selected');
  }

  /**
     * display bitmap subtitle by creating a window arround on a big tile image of subtitles
    */
  handleBitmapSubtitle() {
    if (this.currentSubtitle.activeCues.length) {
      // active cues starts
      const chunks = this.currentSubtitle.activeCues[0].text.split(' ');
      const backgroundImage = [this.options.pathPrefix, chunks[0]].join('/');
      const [width, height, driftX, driftY] = chunks[1].split(':');

      this.subtitle.style.width = `${width}px`;
      this.subtitle.style.height = `${height}px`;
      this.subtitle.style.backgroundImage = `url(${backgroundImage})`;
      this.subtitle.style.backgroundPositionY = `-${driftY}px`;
      this.subtitle.style.backgroundPositionX = `-${driftX}px`;
      this.bmpComponent.el().style.opacity = 1;
    } else {
      // active cues ends
      this.bmpComponent.el().style.opacity = 0;
    }
  }

  /**
   * change track to track id
   *
   * @param {int} id - vjstrack id
  */
  changeTrack(id) {
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.tracks[i].id !== id) {
        this.tracks[i].mode = 'disabled';
        continue;
      }
      this.tracks[i].mode = 'hidden';
      try {
        this.currentSubtitle.removeEventListener('cuechange', this.handleBitmapSubtitle);
      } catch (e) {
        [] = [];
      }
      this.currentSubtitle = this.tracks[i];
      this.handlePlayerResize();
      this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
    }
  }

  /**
     * adding extra bottom space based on arbitrary video height fraction
     */
  adjustSubtitleBottom() {
    const subtitleBottomMargin = (this.player.children()[0].getBoundingClientRect().height / 32) * window.devicePixelRatio;
    const ctrlBarHeight = this.player.controlBar.height();
    let drift = subtitleBottomMargin;

    if (this.player.isFullscreen()) {
      // bottom of video is computed against textTrackDisplay
      // dimensions, device aspect ration must be applied
      const videoBottomBlank = ((screen.height - this.player.textTrackDisplay.height()) / 2);

      if (videoBottomBlank >= ctrlBarHeight) {
        drift += videoBottomBlank;
      } else {
        drift += ctrlBarHeight;
      }
    }
    this.activeContainerStyle.setProperty('--drift', `${drift}px`);
  }
}

// Define default values for the plugin's `state` object here.
Bitmapsub.defaultState = {};

// Include the version number.
Bitmapsub.VERSION = VERSION;

// Register bitmap subtitle component into video.js.
videojs.registerComponent('BitmapSubComponent', BitmapSubComponent);
// Register the plugin with video.js.
videojs.registerPlugin('bitmapsub', Bitmapsub);

export default Bitmapsub;
