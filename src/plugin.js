import videojs from 'video.js';
import { version as VERSION } from '../package.json';
const VjsComponent = videojs.getComponent('Component');
const VjsPlugin = videojs.getPlugin('plugin');
const VjsMenuButton = videojs.getComponent('MenuButton');
const VjsMenuItem = videojs.getComponent('MenuItem');
const VjsTextTrackMenuItem = videojs.getComponent('TextTrackMenuItem');

/**
 * Bitmap Subtitle Menu Button
 */
class BitmapMenuButton extends VjsMenuButton {
  /**
   * Bitmap subtitle wrapper component
   *
   * @param  {Player} player - A Video.js Player instance.
   * @param  {Object} [options={}] - object of option names and values
   * @param  {string} [option.name='bitmapsub-menu-button'] - component name
   */
  constructor(player, options) {
    // Default components options
    const _defaultOptions = {
      name: 'bitmapsubMenuButton'
    };

    options = videojs.obj.merge(_defaultOptions, options);
    super(player, options);
    this.player = player;
    this.options = options;
    // Append subtitle icon
    this.addClass('vjs-subtitles-button');
  }

  /**
   * Bitmap Subtitle Menu Builder,
   * must return a array of menuItem.
   *
   * @return {menuItem[]} - menu items
   */
  createItems() {
    if (this.menuItems) {
      return this.menuItems;
    }
    const { bitmapTracks = [] } = this.options_;

    if (bitmapTracks) {
      return bitmapTracks;
    }
  }

  /**
   * Deselect menu item from bitmap menu
   */
  deselectItems() {
    this.menu.children()
      .forEach(item => item.removeClass('vjs-selected'));
  }

  /**
   * Select a menu item from bitmap menu
   *
   * @param {Object} item - item object bitmapTextTrackMenuItem
   */
  selectItem(item) {
    this.deselectItems();
    item.addClass('vjs-selected');
  }

  /**
   * Dispose component
   */
  dispose() {
    this.player = undefined;
    this.options = undefined;
    this.menuItems = undefined;

    super.dispose();
  }
}

/**
 * Bitmap subtitle container component
 */
class BitmapSubtitleContainer extends VjsComponent {
  /**
   * Bitmap subtitle wrapper component
   *
   * @param  {Player} player - A Video.js Player instance.
   * @param  {Object} [options={}] - object of option names and values
   * @param  {string} [option.name='bitmapsub-container'] - component name
   */
  constructor(player, options) {
    // Default components options
    const _defaultOptions = {
      name: 'bitmapsubSubtitleContainer'
    };

    options = videojs.obj.merge(_defaultOptions, options);
    super(player, options);
    this.player = player;
    this.options = options;
  }

  /**
   * Create bitmap subtitle container DOM parts
   *
   * @return {DOM} container - bitmap subtitle container
   */
  createEl() {
    const container = videojs.dom.createEl('div', { className: 'bitmapsub-container' });
    const subtitle = videojs.dom.createEl('div', { className: 'bitmap-subtitle' });

    container.appendChild(subtitle);
    return container;
  }

  /**
   * Adjust bitmap subtitle container size against
   * ${player.textTrackDisplay} on player resize event
   *
   * @param {number} value - scale value
   */
  scaleTo(value) {
    this.el().style.scale = `${value}`;
  }

  /**
   * Set bitmap subtitle container class name attribute,
   * against bitmap subtitle variation, pgssub or vobsub.
   *
   * @param {string} variation - "pgssub" or "vobsub"
   */
  setBitmapVariation(variation) {
    /* eslint indent: ["error", 2, {"SwitchCase":1}] */
    switch (variation) {
      case 'pgssub':
        this.removeClass('vobsub');
        this.addClass('pgssub');
        break;
      case 'vobsub':
        this.addClass('vobsub');
        this.removeClass('pgssub');
        break;
      case false:
        this.removeClass('pgssub');
        this.removeClass('vobsub');
        break;
    }
    /* eslint-enable indent */
  }

  /**
   * Dispose component.
   */
  dispose() {
    this.player.off('playerresize', this.scaleTo);
    this.player = undefined;
    this.options = undefined;
    super.dispose();
  }
}

/**
 * Bitmap subtitle wrapper component.
 *
 * This component try to follow video boundaries.
 * It helps to positionate bitmap subtitle.
 * Actually does not work with picture-in-picture mode.
 */
class BitmapVideoWindow extends VjsComponent {
  /** Bitmap Video Window component constructor
  *
  * @param  {Player} player - A Video.js Player instance.
  * @param  {Object} [options={}] - object of option names and values
  * @param  {string} [option.name='bitmapsub-video-window'] - component name
  */
  constructor(player, options = {}) {
    const _defaultOptions = {
      name: 'bitmapsubVideoWindow'
    };

    options = videojs.obj.merge(_defaultOptions, options);
    super(player, options);

    this.options = options;
    this.player = player;
    this.videoSize = {};
    // video size available since "canplay" event
    this.player.on('canplay', this.loadVideoSize.bind(this));
    this.player.on('playerresize', this.setVideoWindowProperties.bind(this));
  }

  /**
  * Create bitmap subtitle container DOM parts
  *
  * @return {DOM} container - bitmap subtitle container
  */
  createEl() {
    this.videoWindow = videojs.dom.createEl('div', { className: 'bitmapsub-video-window' });
    return this.videoWindow;
  }

  /**
   * Save current video size into this.videoSize.
   * player.videoWidth and player.videoHeight available since "canplay" event
   * {width:int , height: int and ratio:int}
   */
  loadVideoSize() {
    this.videoSize = { width: this.player.videoWidth(), height: this.player.videoHeight() };
    this.videoSize.ratio = this.videoSize.width / this.videoSize.height;
  }

  /**
   * Set Video Window position and size on playerresize event.
   *
   * Compute extra bitmap subtitle bottom padding.
   * This padding is composed of an arbitrary value, and when
   * player is in fullscreen, additionnal black bars, depending
   * on screen and video aspect ratio.
   *
   * Also, at the end of this method, component is considered ready
   * and trigger corresponding event.
   */
  setVideoWindowProperties() {
    // Update player ratio
    const playerRatio = this.player.currentWidth() / this.player.currentHeight();

    let [videoWindowWidth, videoWindowHeight, videoWindowLeft, videoWindowTop, adjustment] = [0, 0, 0, 0, 0];

    // Test for black bars around video window
    if (this.videoSize.ratio > playerRatio) {
      // Horizontal black bars, player taller than video
      videoWindowWidth = this.player.currentWidth();
      videoWindowHeight = Math.round(videoWindowWidth / this.videoSize.ratio);
      videoWindowTop = Math.round((this.player.currentHeight() - videoWindowHeight) / 2);
      // Compute control bar adjustment.
      // Append adjustment if horizontal black bars height
      // are smaller than player[ControlBar] height
      if (videoWindowTop < this.player.controlBar.currentHeight()) {
        adjustment = this.player.controlBar.currentHeight() - videoWindowTop;
      }
    } else {
      // Vertical black bars, player is wider than video.
      // No adjustment needed in this context
      videoWindowHeight = this.player.currentHeight();
      videoWindowWidth = Math.round(videoWindowHeight * this.videoSize.ratio);
      videoWindowLeft = Math.round((this.player.currentWidth() - videoWindowWidth) / 2);
      adjustment = this.player.controlBar.currentHeight();
    }
    // Append extra arbitrary height to subtitle's padding
    const padding = videoWindowHeight / 32;

    Object.assign(this.el().style, {
      width: videoWindowWidth + 'px',
      height: videoWindowHeight + 'px',
      top: videoWindowTop + 'px',
      left: videoWindowLeft + 'px'
    });
    this.el().style.setProperty('--adjustment', adjustment + 'px');
    this.el().style.setProperty('--padding', padding + 'px');

    // After that, component is considered ready ; run only once.
    this.trigger('ready');
    this.off('ready');
    // after each size changes
    this.trigger('videowindowresize');
  }
}

/**
 * Bitmap Subtitle plugin
 */
class BitmapSubtitle extends VjsPlugin {
  /** Bitmap Subtitle Plugin constructor
  *
  * @param  {Player} player - A Video.js Player instance.
  * @param  {Object} [options={}] - object of option names and values
  * @param  {string} [option.pathPrefix='/bitmapsub'] - pathPrefix: where to find image subtitles tiled
  * @param  {string} [option.labelPrefix=''] - labelPrefix: menu item label prefix
  * @param  {string} [option.labelSuffix=' ⋅BMP'] - labelPrefix: menu item label suffix
  * @param  {string} [option.name='bitmapsub'] - component name
  */
  constructor(player, options = {}) {
    // Default options for the plugin
    const _pluginDefaults = {
      pathPrefix: '/bitmapsub/',
      labelPrefix: '',
      labelSuffix: ' ⋅BMP',
      name: 'bitmapsub'
    };

    options = videojs.obj.merge(_pluginDefaults, options);
    super(player, options);

    this.player = player;
    this.options = options;

    this._isDisposed = false;
    this.id = Math.round(Math.random() * 1e16);
    // Handle only bitmap subtitle tracks
    this.bitmapTracks = [];
    // Save current subtitle track with associated event listener state
    this.currentSubtitle = { listener: false, track: false };

    this.player.one('ready', this.appendComponent.bind(this));
    this.player.on('loadeddata', e => {
      this.updateBitmapMenu();
      this.player.textTracks().on(['addtrack', 'removetrack'], this.updateBitmapMenu.bind(this));
    });
  }

  /**
  * Append bitmap subtitle extra plugin components to video.js UI
  */
  appendComponent() {
    // Instantiate Bitmap Subtitle Components
    // First: global video window element
    this.bmpsubVideoWindow = new BitmapVideoWindow(this.player);
    // Second: bitmap subtitle wrapper element
    this.bmpsubContainer = new BitmapSubtitleContainer(this.player);
    // get reference of bitmap subtitle element
    this.subtitleElement = this.bmpsubContainer.el().querySelector('.bitmap-subtitle');
    this.bmpsubVideoWindow.addChild(this.bmpsubContainer);
    this.player.addChild(this.bmpsubVideoWindow);
    // Initialize bitmap subtitle video window size when component completely ready.
    this.bmpsubVideoWindow.one('ready', this.scaleSubtitle.bind(this));
    // Append listener for video size changes
    this.bmpsubVideoWindow.on('videowindowresize', this.scaleSubtitle.bind(this));

    // Third: append bitmap menu into video.js controlbar
    this.bmpsubMenu = new BitmapMenuButton(this.player);

    // if player have controls enabled
    if (this.player.controls()) {
      // Place bmpsubMenuButton after SubsCapsMenuButton
      const bitmapMenuButtonPlacement = this.player.controlBar.children()
        .indexOf(this.player.controlBar.subsCapsButton) + 1;

      this.player.controlBar.addChild(this.bmpsubMenu, null, bitmapMenuButtonPlacement);
    }
    this.trigger('ready');
  }

  /**
  * Populate bitmap subtitle menu with track items if any
  */
  updateBitmapMenu() {
    this.bitmapTracks = this.getBitmapTracks();
    this.bmpsubMenu.menuItems = this.buildTrackMenuItems();
    this.bmpsubMenu.update();
  }

  /**
  * Returns a list of textTrack from all tracks filtered by kind
  * 'metadata' type and label starting with 'pgssub' or 'vobsub'
  * prefix.
  *
  * @return {textTracks[]} - list of filtered textTracks
  */
  getBitmapTracks() {
    const allTracks = this.player.textTracks();
    const bitmapTracks = [];

    for (let i = 0; i < allTracks.length; i++) {
      if (allTracks[i].kind === 'metadata' && allTracks[i].label.match(/^(pgs|vob)sub:(\d+):/)) {
        bitmapTracks.push(allTracks[i]);
      }
    }
    return bitmapTracks;
  }

  /**
  * Extra controls items for bitmap subtitle menu:
  *  - settings panel
  *  - off bitmap subtitle
  *
  * @return {MenuItem[]} - settings and off menu items
  */
  menuControlItems() {
    const offBitmapOptions = { label: 'Bitmap Off', name: 'bitmap-off', id: 'bitmap-off' };
    const offBitmap = new VjsMenuItem(this.player, offBitmapOptions);

    offBitmap.handleClick = () => {
      this.bmpsubMenu.deselectItems();
      // Disable all tracks from this.bitmapTracks
      this.bitmapTracks.forEach(track => {
        track.mode = 'disabled';
      });
      // Select current items into bitmap menu
      offBitmap.addClass('vjs-selected');
      // Hide bitmap subtitle container
      this.bmpsubContainer.hide();
      // Remove container bitmap variation class
      this.bmpsubContainer.setBitmapVariation(false);
      // Remove handler on this.currentSubtitle.track
      this.listenCueChange(false);
    };
    return [offBitmap];
  }

  /**
  * Compute bitmap track menu items and its corresponding
  * click handler for bitmap subtitle menu
  *
  * @return {textTrackMenuItem[]} - list of textTrackMenuItem filtered
  */
  buildTrackMenuItems() {
    let items = [];

    this.bitmapTracks.map(track => {
      const [bitmapVariation, videoSize, labelName] = track.label.split(':');
      const label = this.options.labelPrefix + labelName + this.options.labelSuffix;
      const item = new VjsTextTrackMenuItem(this.player, {
        label,
        track: {
          label,
          language: track.language,
          id: track.id,
          default: track.default
        }
      });

      // Append native bitmap subtitle video size property
      track.bitmapsub = { width: videoSize };

      if (track.default) {
        track.mode = 'hidden';
        this.currentSubtitle.track = track;
        this.bmpsubMenu.selectItem(item);
        this.listenCueChange();
        this.bmpsubContainer.setBitmapVariation(bitmapVariation);
      } else {
        track.mode = 'disabled';
      }
      item.handleClick = () => {
        this.bmpsubMenu.selectItem(item);
        this.changeToTrack(item.track.id);
        this.bmpsubContainer.setBitmapVariation(bitmapVariation);
      };
      // Append item to subtitle menu
      items.push(item);
    });
    // If at least one item, append controls items,
    // because, by default, menu is hidden if contains 0 items.
    if (items.length) {
      items = [...this.menuControlItems(), ...items];
    }

    return items;
  }

  /**
  * From a large image of tiled bitmap subtitle, pick up one
  * of them by creating a mask window around it.
  * Subtitle container visibility is related to current track.activeCue.
  *
  * Metadata track current cue define window size and position as
  * following format: bitmap_image.png:width:height:driftX:driftY
  */
  updateSubtitle() {
    if (this.currentSubtitle.track.activeCues.length) {
      // Bitmap subtitle become visible
      const [image, width, height, driftX, driftY] = this.currentSubtitle.track.activeCues[0].text.split(':');
      const backgroundImage = [this.options.pathPrefix, image].join('/');
      let style;

      style = `width:${width}px;height:${height}px;background-image:url(${backgroundImage});`;
      style += `background-position-x:-${driftX}px;background-position-y:-${driftY}px`;
      this.subtitleElement.style = style;
      this.bmpsubContainer.el().style.opacity = 1;
    } else {
      // Hide bitmap subtitle
      this.bmpsubContainer.el().style.opacity = 0;
    }
  }

  /**
  * Append or remove 'cuechange' event listener on current track
  *
  * @param {boolean} [state=true] - true: append, false: remove if this.currentSubtitle.listener
  */
  listenCueChange(state = true) {
    if (state) {
      this.currentSubtitle.track.addEventListener('cuechange', this.updateSubtitle.bind(this));
      this.currentSubtitle.listener = true;
    } else if (this.currentSubtitle.listener) {
      this.currentSubtitle.track.removeEventListener('cuechange', this.updateSubtitle.bind(this));
      this.currentSubtitle.listener = false;
    }
  }

  /**
  * Change bitmap subtitle to track with id ${id}
  *
  * @param {string} id - track id
  */
  changeToTrack(id) {
    this.bitmapTracks.forEach(track => {
      if (track.id !== id) {
        track.mode = 'disabled';
        return;
      }
      track.mode = 'hidden';
      // Show bitmap subtitle container, because it can be previously hidden
      this.bmpsubContainer.show();
      this.listenCueChange(false);
      this.currentSubtitle.track = track;
      this.listenCueChange();
    });
  }

  /**
  * Scale subtitle container against current displayed video witdh
  */
  scaleSubtitle() {
    if (!this.currentSubtitle.track) {
      return;
    }
    const scaleSize = (this.bmpsubVideoWindow.currentWidth() / this.currentSubtitle.track.bitmapsub.width).toFixed(2);

    this.bmpsubContainer.scaleTo(scaleSize);
  }

  /**
  * Listeners cleanup on dispose event.
  * Remove textTracks listener to avoid videojs player error on dipose event.
  */
  dispose() {
    ['addtrack', 'removetrack']
      .forEach(eventName => this.player.textTracks().off(eventName));
    this._isDisposed = true;
    super.dispose();
  }

  /**
  * Tell if plugin is disposed or not.
  *
  * @return {boolean} disposed or not
  */
  isDisposed() {
    return this._isDisposed;
  }
}

BitmapSubtitle.VERSION = VERSION;
videojs.registerComponent('bitmapsubVideoWindow', BitmapVideoWindow);
videojs.registerComponent('bitmapsubSubtitleContainer', BitmapSubtitleContainer);
videojs.registerComponent('bitmapsubMenuButton', BitmapMenuButton);
videojs.registerPlugin('bitmapsub', BitmapSubtitle);

export default BitmapSubtitle;
