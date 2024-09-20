import { version } from '../package.json';
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

}
/**
 * bitmap subtitle container component
 */
class BitmapSubtitleContainer extends VjsComponent {

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
  constructor(player, options) {
    // Default options for the plugin.
    const _pluginDefaults = {
      pathPrefix: '/bitmapsub/',
      labelPrefix: '',
      labelSuffix: ' ⋅BMP',
      name: 'bitmapsub'
    };

    super(player, options);
    this.player = player;
    this.options = videojs.obj.merge(_pluginDefaults, options);
    this.buildDynamicStyle();

    const cssRules = [...document.styleSheets]
      .find(css => css.ownerNode.id === `css-bitmap-${this.player.id()}`).cssRules;

    this.bmpSubtitleContainerStyle = [...cssRules]
      .find(rule => rule.selectorText === `#${this.player.id()} .bitmapsub-container`).style;

    // handle only bitmap subtitle tracks
    this.bitmapTracks = [];
    // current subtitle track with associate event listener state
    this.currentSubtitle = { listener: false, track: false };

    this.player.on('loadeddata', e => {
      // Append extra components to videojs UI
      this.appendComponent();
      this.updateMenu();
      // At startup underlying this.currentSubtitle is not loaded yet
      this.scaleBmpSubtitleContainer();
    });
    // Append listener for video size changes
    this.player.on('fullscreenchange', this.adjustSubtitlePosition.bind(this));
    this.player.on('playerresize', this.scaleBmpSubtitleContainer.bind(this));
    this.player.one('play', e => {
      this.ctrlBarHeight = this.player.controlBar.height();
      this.bmpSubtitleContainerStyle.setProperty('--control-bar-height', `${this.ctrlBarHeight}px`);
    });
  }

  /**
   *  dynamic style for each instance distiguish by player.id
   *
   * @return {Object} - DOM style element
   *  */
  buildDynamicStyle() {
    const style = document.createElement('style');
    const id = this.player.id();

    style.id = `css-bitmap-${id}`;
    style.textContent = `#${id} .bitmapsub-container{}`;
    document.head.appendChild(style);
    return style;
  }

  /**
   * Append bitmap subtitle extra components to videojs UI
   */
  appendComponent() {
    // Instantiate Bitmap Subtitle Component
    this.bmpSubContainer = new BitmapSubtitleContainer(this.player, this.options);
    this.player.addChild(this.bmpSubContainer);
    this.subtitleElement = this.bmpSubContainer.el().querySelector(`#${this.player.id()} .bitmap-subtitle`);

    // Append bitmap menu into videojs controlbar
    this.bitmapMenu = new BitmapMenuButton(this.player, { name: 'bitmapMenuButton' });
    this.bitmapMenu.addClass('vjs-subtitles-button');

    const bitmapMenuButtonPlacement = this.player.controlBar.children()
      .indexOf(this.player.controlBar.getChild('SubsCapsButton')) + 1;

    // Place bitmapMenuButton after SubsCapsMenuButton
    this.player.controlBar.addChild(this.bitmapMenu, null, bitmapMenuButtonPlacement);
  }

  /**
   * Build bitmap subtitle menu
  */
  updateMenu() {
    this.bitmapTracks = this.getBitmapTracks();
    this.bitmapMenu.menuItems = this.buildTrackMenuItems();
    this.bitmapMenu.update();
  }

  /**
   * Returns a list of textTrack from all tracks filtered by kind
   * against 'metadata' type and label starting with 'bitmap:' prefix.
   *
   *  @return {textTracks[]} - list of textTracks filtered
   *
  */
  getBitmapTracks() {
    const allTracks = this.player.textTracks();
    const bitmapTracks = [];

    for (let i = 0; i < allTracks.length; i++) {
      if (allTracks[i].kind === 'metadata' && allTracks[i].label.match(/^(pgssub|vobsub):(\d+):/)) {
        bitmapTracks.push(allTracks[i]);
      }
    }
    return bitmapTracks;
  }

  /**
   * Extra controls items for bitmap subtitle menu: settings and off
   *
   * @return {MenuItem[]} - settings and off menu item
  */
  menuControlItems() {
    const offBitmapOptions = { label: 'Bitmap Off', name: 'bitmap-off', id: 'bitmap-off' };
    const offBitmap = new VjsMenuItem(this.player, offBitmapOptions);

    offBitmap.handleClick = () => {
      const menu = this.player.controlBar.getChild('BitmapMenuButton').menu;

      // Deselect all items from bitmap menu items
      menu.children().forEach(item => {
        item.removeClass('vjs-selected');
      });
      // Disable all tracks from this.bitmapTracks
      this.bitmapTracks.forEach(track => {
        track.mode = 'disabled';
      });
      // Select current items into bitmap menu
      offBitmap.addClass('vjs-selected');
      // Hide bitmap subtitle container
      this.bmpSubContainer.hide();
      // Remove handler on this.currentSubtitle.track
      this.listenCueChange(false);
    };
    return [offBitmap];
  }

  /**
   * Set bitmap subtitle container class name attribute,
   * against bitmap track variation, pgssub or vobsub.
   *
   * @param {string} bitmapVariation - "pgssub" or "vobsub"
   */
  setBmpSubContainerClass(bitmapVariation) {
    if (bitmapVariation === 'pgssub') {
      this.bmpSubContainer.removeClass('vobsub');
      this.bmpSubContainer.addClass('pgssub');
    } else {
      this.bmpSubContainer.addClass('vobsub');
      this.bmpSubContainer.removeClass('pgssub');
    }
  }

  /**
   * Compute bitmap track menu items for bitmap subtitle menu
   *
   * @return {textTrackMenuItem[]} - list of textTrackMenuItem filtered
  */
  buildTrackMenuItems() {
    let items = [];

    this.bitmapTracks.map(track => {
      const item = new VjsTextTrackMenuItem(this.player, {
        label: this.options.labelPrefix + track.label.split(':')[2] + this.options.labelSuffix,
        track: {
          label: this.options.labelPrefix + track.label.split(':')[2] + this.options.labelSuffix,
          language: track.language,
          id: track.id,
          default: track.default
        }
      });

      // add native bitmap subtitle size
      track.bitmapsub = { width: track.label.split(':')[1] };
      const bitmapVariation = track.label.split(':')[0];

      if (track.default) {
        track.mode = 'hidden';
        this.currentSubtitle.track = track;
        this.selectItem(item);
        this.listenCueChange();
        this.setBmpSubContainerClass(bitmapVariation);
      } else {
        track.mode = 'disabled';
      }
      item.handleClick = () => {
        this.selectItem(item);
        this.changeTrack(item.track.id);
        this.setBmpSubContainerClass(bitmapVariation);
      };
      // append item to subtitle menu
      items.push(item);
    });
    // If at least one item, append controls items,
    // because menu is hidden if contains 0 items.
    if (items.length) {
      items = [...this.menuControlItems(), ...items];
    }

    return items;
  }

  /**
   * Adjust bitmap subtitle container against player resize event
  */
  scaleBmpSubtitleContainer() {
    if (!this.currentSubtitle.track) {
      return;
    }
    const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.track.bitmapsub.width).toFixed(2);

    this.bmpSubContainer.el().style.scale = `${scaleSize}`;
    this.adjustSubtitlePosition();
  }

  /**
   * Deselect track item from bitmap menu
   */
  deselectItem() {
    this.player.controlBar.getChild('bitmapMenuButton').menu
      .children().forEach(e => e.removeClass('vjs-selected'));
    this.bmpSubContainer.hide();
  }

  /**
   * Select a track item from bitmap menu
   *
   * @param {Object} item - item object bitmapTextTrackMenuItem
  */
  selectItem(item) {
    this.deselectItem();
    this.bmpSubContainer.show();
    item.addClass('vjs-selected');
  }

  /**
   * From a big image with subtitles tiled, pick up one
   * of them by creating a window around it.
   * Toggling subtitle container opacity against begining or
   * ending of the subtitle.
   *
   * Current cue, from metadata track, define window size and position.
   * cue format: relative_bitmap_pathname width:height:driftX:driftY
   */
  handleBitmapSubtitle() {
    if (this.currentSubtitle.track.activeCues.length) {
      // active cues starts
      const [image, width, height, driftX, driftY] = this.currentSubtitle.track.activeCues[0].text.split(':');
      const backgroundImage = [this.options.pathPrefix, image].join('/');
      let style;

      style = `width:${width}px;height:${height}px;background-image:url(${backgroundImage});`;
      style = `${style}background-position-x:-${driftX}px;background-position-y:-${driftY}px`;
      this.subtitleElement.style = style;
      this.bmpSubContainer.el().style.opacity = 1;
    } else {
      // active cues ends
      this.bmpSubContainer.el().style.opacity = 0;
    }
  }

  /**
   * Append or remove event listener (cuechange) on current track
   *
   * @param {boolean} [state=true] - true: append, false: remove if this.currentSubtitle.listener
   */
  listenCueChange(state = true) {
    if (state) {
      this.currentSubtitle.track.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
      this.currentSubtitle.listener = true;
    } else if (this.currentSubtitle.listener) {
      this.currentSubtitle.track.removeEventListener('cuechange', this.handleBitmapSubtitle);
      this.currentSubtitle.listener = false;
    }
  }

  /**
   * Change bitmap subtitle track
   *
   * @param {string} id - track id
   */
  changeTrack(id) {
    this.bitmapTracks.forEach(track => {
      if (track.id !== id) {
        track.mode = 'disabled';
        return;
      }
      track.mode = 'hidden';
      this.listenCueChange(false);
      this.currentSubtitle.track = track;
      this.listenCueChange();
    });
  }

  /**
   * Compute blank height against video window,
   * to adjust subtitle container height.
  */
  adjustSubtitlePosition() {
    // Adding extra bottom space based on arbitrary video height fraction
    const subtitleBottomMargin = this.player.textTrackDisplay.height() / 32;
    let drift = subtitleBottomMargin;

    if (this.player.isFullscreen()) {
      const textTrackDisplayY = Math.round(this.player.textTrackDisplay.getPositions().boundingClientRect.y);

      if (textTrackDisplayY < this.ctrlBarHeight) {
        drift += (this.ctrlBarHeight - textTrackDisplayY);
      } else {
        drift += textTrackDisplayY;
      }
    }
    // Device aspect ration must be applied
    drift = drift * window.devicePixelRatio;
    this.bmpSubtitleContainerStyle.setProperty('--drift', `${drift}px`);
  }
}
BitmapSubtitle.VERSION = version;
videojs.registerComponent('bitmapSubtitleContainer', BitmapSubtitleContainer);
videojs.registerComponent('bitmapMenuButton', BitmapMenuButton);
videojs.registerPlugin('bitmapSubtitle', BitmapSubtitle);

export default BitmapSubtitle;
