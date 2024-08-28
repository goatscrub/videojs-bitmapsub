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
    if (this.myitems) {
      return this.myitems;
    }
    const {bitmapTracks = []} = this.options_;

    if (bitmapTracks) {
      return bitmapTracks;
    }
  }

}
/**
 * bitmap subtitle container component
*/
class BitmapSubContainer extends VjsComponent {

  /**
   * Create bitmap subtitle container DOM parts
   *
   * @return {DOM} container - bitmap subtitle container
   */
  createEl() {
    const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' });
    const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' });

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
  * @param  {Object} [options] - An optional options object.
  *
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
    // handle only bitmap subtitle tracks
    this.tracks = [];
    // current subtitle track with associate event listener state
    this.currentSubtitle = {listener: false, track: false};
    // instantiate Bitmap Subtitle Component
    this.bmpSubContainer = new BitmapSubContainer(this.player, this.options);
    this.player.addChild(this.bmpSubContainer);
    this.player.ready(e => {
      this.updateMenu();
      this.player.currentTime(60 * 53);
      this.css = [...document.styleSheets]
        .find(css => css.ownerNode.id === 'css-bitmap-subtitle').cssRules;
      this.activeContainerStyle = [...this.css].find(r => r.selectorText === '#bitmapsub-container').style;
      this.subtitle = this.bmpSubContainer.el().querySelector('#bitmap-subtitle');
      this.player.addChild(this.bmpSubContainer);

      // TODO move into handle function
      this.player.on('fullscreenchange', this.adjustSubtitleBottom.bind(this));
      this.player.on('playerresize', this.handlePlayerResize.bind(this));
    });
  }

  /**
   * Build bitmap subtitle menu
  */
  updateMenu() {
    this.bitmapMenu = new BitmapMenuButton(this.player, {name: 'bitmapMenuButton'});
    this.bitmapMenu.addClass('vjs-subtitles-button');
    // place bitmapMenuButton after SubsCapsMenuButton
    const placement = this.player.controlBar.children().indexOf(this.player.controlBar.getChild('SubsCapsButton')) + 1;

    this.player.controlBar.addChild(this.bitmapMenu, null, placement);
    this.bitmapTracks();
    this.bitmapMenu.myitems = this.buildTrackMenuItems();
    this.bitmapMenu.update();
  }

  /**
   * Define this.tracks, by filtering this.player.textTracks()
   * against metadata and label starting with 'bitmap:' string.
   *
   *  @return {textTracks[]} - list of textTracks filtered
   *
  */
  bitmapTracks() {
    const tracks = this.player.textTracks();

    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'metadata' && tracks[i].label.startsWith('bitmap:')) {
        this.tracks.push(tracks[i]);
      }
    }
    return this.tracks;
  }

  /**
   * Extra controls items for bitmap subtitle menu: settings and off
   *
   * @return {MenuItem[]} - settings and off menu item
  */
  controlItems() {
    const settingsOptions = { label: 'Settings', name: 'bitmap-settings', id: 'bitmap-settings' };
    const offBitmapOptions = { label: 'Bitmap Off', name: 'bitmap-off', id: 'bitmap-off' };
    const settings = new VjsMenuItem(this.player, settingsOptions);
    const offBitmap = new VjsMenuItem(this.player, offBitmapOptions);

    settings.handleClick = () => {
      // TODO: handleClick settings
      // console.log('bitmap settings');
    };
    offBitmap.handleClick = () => {
      const menu = this.player.controlBar.getChild('BitmapMenuButton').menu;

      // Deselect all items from bitmap menu items
      menu.children().forEach(item => {
        item.removeClass('vjs-selected');
      });
      // Disable all tracks from this.tracks
      this.tracks.forEach(track => {
        track.mode = 'disabled';
      });
      // Select current items into bitmap menu
      offBitmap.addClass('vjs-selected');
      // Hide bitmap subtitle container
      this.bmpSubContainer.hide();
      // Remove handler on this.currentSubtitle.track
      this.listenCueChange(false);
    };
    return [settings, offBitmap];
  }

  /**
   * Compute bitmap track menu items for bitmap subtitle menu
   *
   * @return {textTrackMenuItem[]} - list of textTrackMenuItem filtered
  */
  buildTrackMenuItems() {
    let items = [];

    this.tracks.map(track => {
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

      if (track.default) {
        track.mode = 'hidden';
        this.currentSubtitle.track = track;
        this.selectItem(item);
        this.listenCueChange();
      } else {
        track.mode = 'disabled';
      }
      item.handleClick = () => {
        this.selectItem(item);
        this.changeTrack(item.track.id);
      };
      // append item to subtitle menu
      items.push(item);
    });
    // If at least one item, append controls items,
    // because menu is hidden if contains 0 items.
    if (items) {
      items = [...this.controlItems(), ...items];
    }

    return items;
  }

  /**
   * Adjust bitmap subtitle container against player resize event
  */
  handlePlayerResize() {
    if (!this.currentSubtitle.track) {
      return;
    }
    const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.track.bitmapsub.width).toFixed(2);

    this.bmpSubContainer.el().style.scale = `${scaleSize}`;
    this.adjustSubtitleBottom();
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
      const chunks = this.currentSubtitle.track.activeCues[0].text.split(' ');
      const backgroundImage = [this.options.pathPrefix, chunks[0]].join('/');
      const [width, height, driftX, driftY] = chunks[1].split(':');
      let style;

      style = `width:${width}px;height:${height}px;background-image:url(${backgroundImage});`;
      style = `${style}background-position-x:-${driftX}px;background-position-y:-${driftY}px`;
      this.subtitle.style = style;
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
    this.tracks.forEach(track => {
      if (track.id !== id) {
        track.mode = 'disabled';
        return;
      }
      track.mode = 'hidden';
      this.listenCueChange(false);
      this.currentSubtitle.track = track;
      this.handlePlayerResize();
      this.listenCueChange(true);
    });
  }

  /**
   * Compute blank height, against video window,
   * to adjust subtitle container height.
  */
  adjustSubtitleBottom() {
    // adding extra bottom space based on arbitrary video height fraction
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
BitmapSubtitle.VERSION = '2.3.4';
videojs.registerComponent('bitmapSubContainer', BitmapSubContainer);
videojs.registerComponent('bitmapMenuButton', BitmapMenuButton);
videojs.registerPlugin('bitmapSubtitle', BitmapSubtitle);

export default BitmapSubtitle;
