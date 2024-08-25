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
    return [{label: 'machin'}, {label: 'chose'}].map(e => new VjsMenuItem(this.player_, e));
    // return this.options_;
  }
}
/**
 * bitmap subtitle container component
*/
class BitmapSubComponent extends VjsComponent {

  /** */
  createEl() {
    const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' });
    const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' });

    container.appendChild(subtitle);
    return container;
  }
}

/**
 * Plugain Plugin
 */
class BitmapSubtitle extends VjsPlugin {
  /** */
  constructor(player, options) {
    super(player);
    this.player = player;
    this.options = pluginDefaults;
    this.player.ready(e => {
      this.updateMenu();
    });
    // instantiate Bitmap Subtitle Component
    this.bmpComponent = new BitmapSubComponent(this.player, this.options);
    // off subtitle button
    // this.offSubtitle = this.player.controlBar.subsCapsButton.menu.children().find(
    // c => c.constructor.name == 'OffTextTrackMenuItem'
    // )
  }

  /** */
  updateMenu() {
    const bitmapTracks = this.loadTracks();
    const bitmapMenu = new BitmapMenuButton(this.player, bitmapTracks);
    const placement = this.player.controlBar.children().indexOf(this.player.controlBar.getChild('SubsCapsButton')) + 1;

    bitmapMenu.addClass('vjs-subtitles-button');
    this.player.controlBar.addChild(bitmapMenu, null, placement);
  }

  /** */
  loadTracks() {
    const tracks = this.player.textTracks();
    const items = [];

    for (let i = 0; i < tracks.length; i++) {
      if (!(tracks[i].kind === 'metadata' && tracks[i].label.startsWith('bitmap:'))) {
        continue;
      }
      const item = new VjsTextTrackMenuItem(this.player, {
        label: this.options.labelPrefix + tracks[i].label.split(':')[2] + this.options.labelSuffix,
        track: {
          label: this.options.labelPrefix + tracks[i].label.split(':')[2] + this.options.labelSuffix,
          language: tracks[i].language,
          id: tracks[i].id,
          default: tracks[i].default
        }
      });

      // add native bitmap subtitle size
      tracks[i].bitmapsub = { width: tracks[i].label.split(':')[1] };
      if (tracks[i].default) {
        tracks[i].mode = 'hidden';
        this.currentSubtitle = tracks[i];
        this.selectItem(item);
      } else {
        tracks[i].mode = 'disabled';
      }
      item.handleClick = () => {
        this.selectItem(item);
        this.changeTrack(item.track.id);
      };
      // append item to subtitle menu
      items.push(item);
    }

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

  /** */
  handlePlayerResize() {
    if (!this.currentSubtitle) {
      return;
    }
    const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.bitmapsub.width).toFixed(2);

    this.bmpComponent.el().style.scale = `${scaleSize}`;
    this.adjustSubtitleBottom();
  }

  /** */
  disableSubtitle() {
    this.player.controlBar.subsCapsButton.menu
      .children().forEach(e => e.removeClass('vjs-selected'));
    // this.offSubtitle.addClass('vjs-selected')
    this.bmpComponent.hide();
  }

  /** */
  selectItem(item) {
    this.disableSubtitle();
    this.bmpComponent.show();
    // this.offSubtitle.removeClass('vjs-selected')
    item.addClass('vjs-selected');
  }

  /** */
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

  /** */
  changeTrack(id) {
    const tracks = this.player.textTracks();

    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].id !== id) {
        tracks[i].mode = 'disabled';
        continue;
      }
      tracks[i].mode = 'hidden';
      try {
        this.currentSubtitle.removeEventListener('cuechange', this.handleBitmapSubtitle);
      } catch (TypeError) { }
      this.currentSubtitle = tracks[i];
      this.handlePlayerResize();
      this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this));
    }
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

videojs.registerComponent('bitmapSubComponent', BitmapSubComponent);
videojs.registerComponent('bitmapMenuButton', BitmapMenuButton);
videojs.registerPlugin('bitmapSubtitle', BitmapSubtitle);
