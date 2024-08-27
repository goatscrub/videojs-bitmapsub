const VjsComponent = videojs.getComponent('Component');
const VjsPlugin = videojs.getPlugin('plugin');
const VjsMenuButton = videojs.getComponent('MenuButton');
const VjsMenuItem = videojs.getComponent('MenuItem');
const VjsTextTrackMenuItem = videojs.getComponent('TextTrackMenuItem');

// Default options for the plugin.
const pluginDefaults = {
  pathPrefix: '/bitmapsub/',
  labelPrefix: '',
  labelSuffix: ' ⋅BMP',
  name: 'bitmapsub'
};

// const ctrlBar = player.controlBar;
// const placement = ctrlBar.children().indexOf(ctrlBar.getChild('SubsCapsButton')) + 1;
// ctrlBar.addChild('bitmapMenuButton', {pathPrefix: '/tmp/'}, placement);

/** */
class BitmapMenuButton extends VjsMenuButton {
  /**
   * must return a array of menuItem
   * returns: menuItem[]
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

  /** */
  createEl() {
    const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' });
    const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' });

    container.appendChild(subtitle);
    return container;
  }
}

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
class BitmapSubtitle extends VjsPlugin {
  /** */
  constructor(player, options) {
    super(player, options);
    this.player = player;
    this.options = videojs.obj.merge(pluginDefaults, options);
    // handle only bitmap subtitle tracks
    this.tracks = [];
    this.currentSubtitle = {listener: false};
    // instantiate Bitmap Subtitle Component
    this.bmpSubContainer = new BitmapSubContainer(this.player, this.options);
    this.player.addChild(this.bmpSubContainer);
    this.player.ready(e => {
      this.updateMenu();
      this.player.currentTime(60 * 53);
      this.bordel();
    });
    // off subtitle button
    // this.offSubtitle = this.player.controlBar.subsCapsButton.menu.children().find(
    // c => c.constructor.name == 'OffTextTrackMenuItem'
    // )
  }

  /** */
  updateMenu() {
    this.bitmapMenu = new BitmapMenuButton(this.player, {name: 'bitmapMenuButton'});
    this.bitmapMenu.addClass('vjs-subtitles-button');
    // place bitmapMenuButton after SubsCapsMenuButton
    const placement = this.player.controlBar.children().indexOf(this.player.controlBar.getChild('SubsCapsButton')) + 1;

    this.player.controlBar.addChild(this.bitmapMenu, null, placement);
    this.bitmapTracks();
    this.bitmapMenu.myitems = this.loadTracks();
    // const bitmapTracks = this.loadTracks();
    // console.log(tracks);

    this.bitmapMenu.update();
  }

  /** */
  bitmapTracks() {
    const tracks = this.player.textTracks();

    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'metadata' && tracks[i].label.startsWith('bitmap:')) {
        this.tracks.push(tracks[i]);
      }
    }
    return this.tracks;
  }

  /** */
  loadTracks() {
    const items = [];

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

    return items;
  }

  /**
   *
   */
  bordel() {
    this.css = [...document.styleSheets]
      .find(css => css.ownerNode.id === 'css-bitmap-subtitle').cssRules;
    this.activeContainerStyle = [...this.css].find(r => r.selectorText === '#bitmapsub-container').style;
    // this.offSubtitle.handleClick = () => {
    //     // on click disable all tracks
    //     for (let i = 0; i < this.tracks.length; i++) {
    //         this.tracks[i].mode = 'disabled'
    //     }
    //     this.disableSubtitle()
    // }
    this.subtitle = this.bmpSubContainer.el().querySelector('#bitmap-subtitle');
    this.player.addChild(this.bmpSubContainer);
    // force displaying subtitle button into menu
    // this.player.controlBar.subsCapsButton.show();

    // TODO move into handle function
    this.player.on('fullscreenchange', this.adjustSubtitleBottom.bind(this));

    this.player.on('playerresize', this.handlePlayerResize.bind(this));
    if (this.currentSubtitle.track) {
      this.currentSubtitle.track.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
      this.currentSubtitle.listener = true;
    }
  }

  /** */
  handlePlayerResize() {
    if (!this.currentSubtitle.track) {
      return;
    }
    const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.track.bitmapsub.width).toFixed(2);

    this.bmpSubContainer.el().style.scale = `${scaleSize}`;
    this.adjustSubtitleBottom();
  }

  /** */
  disableSubtitle() {
    this.player.controlBar.getChild('bitmapMenuButton').menu
      .children().forEach(e => e.removeClass('vjs-selected'));
    // this.offSubtitle.addClass('vjs-selected')
    this.bmpSubContainer.hide();
  }

  /** */
  selectItem(item) {
    this.disableSubtitle();
    this.bmpSubContainer.show();
    // this.offSubtitle.removeClass('vjs-selected')
    item.addClass('vjs-selected');
  }

  /** */
  handleBitmapSubtitle() {
    if (this.currentSubtitle.track.activeCues.length) {
      // active cues starts
      const chunks = this.currentSubtitle.track.activeCues[0].text.split(' ');
      const backgroundImage = [this.options.pathPrefix, chunks[0]].join('/');
      const [width, height, driftX, driftY] = chunks[1].split(':');

      this.subtitle.style.width = `${width}px`;
      this.subtitle.style.height = `${height}px`;
      this.subtitle.style.backgroundImage = `url(${backgroundImage})`;
      this.subtitle.style.backgroundPositionY = `-${driftY}px`;
      this.subtitle.style.backgroundPositionX = `-${driftX}px`;
      this.bmpSubContainer.el().style.opacity = 1;
    } else {
      // active cues ends
      this.bmpSubContainer.el().style.opacity = 0;
    }
  }

  /** */
  changeTrack(id) {
    // const tracks = this.player.textTracks();
    this.tracks.map(track => {
      if (track.id !== id) {
        track.mode = 'disabled';
        return;
      }
      track.mode = 'hidden';
      // try {
      //   this.currentSubtitle.removeEventListener('cuechange', this.handleBitmapSubtitle);
      // } catch (TypeError) { }
      if (this.currentSubtitle.listener) {
        this.currentSubtitle.track.removeEventListener('cuechange', this.handleBitmapSubtitle);
        this.currentSubtitle.listener = false;
      }
      this.currentSubtitle.track = track;
      this.handlePlayerResize();
      this.currentSubtitle.track.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
      this.currentSubtitle.listener = true;
    });
  }

  /** */
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

videojs.registerComponent('bitmapSubContainer', BitmapSubContainer);
videojs.registerComponent('bitmapMenuButton', BitmapMenuButton);
videojs.registerPlugin('bitmapSubtitle', BitmapSubtitle);
