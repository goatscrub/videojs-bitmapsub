import { BitmapSubComponent } from './bitmap-subtitle.components.js'

const videojsPlugin = videojs.getPlugin('plugin')

class BitmapSub extends videojsPlugin {
    // TODO: passthrough subtitle
    // TODO: don't display subtitle if player won't play

    subtitleTracks = []
    subtitleLineHeightRatio = 16.5
    screenHeight = Math.floor(screen.height * window.devicePixelRatio)
    options = {
        pathPrefix: '/bitmapsub/',
        labelPrefix: '',
        labelSuffix: ' ⋅BMP',
        name: 'bitmapsub',
    }

    constructor(player, options) {
        super(player, options)
        this.player = player
        this.options = { ...this.options, ...options }
        this.init()
    }

    init() {
        // save tracks
        this.tracks = this.player.textTracks()
        // instantiate Bitmap Subtitle Component
        this.bmpComponent = new BitmapSubComponent(this.player, this.options)
        const vjsSubsCapsMenuItem = videojs.getComponent('SubsCapsMenuItem')
        // off subtitle button
        this.offSubtitle = this.player.controlBar.subsCapsButton.menu.children().find(
            c => c.constructor.name == 'OffTextTrackMenuItem'
        )
        let witnessFlag = 0
        // build menu tracks and associate clicks
        for (let i = 0; i < this.tracks.length; i++) {
            if (this.tracks[i].kind != 'metadata' && !this.tracks[i].label.startsWith('bitmap:')) return
            // build new menu item
            const item = new vjsSubsCapsMenuItem(this.player, {
                track: {
                    label: this.options.labelPrefix + this.tracks[i].label.split(':')[2] + this.options.labelSuffix,
                    language: this.tracks[i].language,
                    id: this.tracks[i].id,
                    default: this.tracks[i].default,
                },
            })
            // add native bitmap subtitle size
            this.tracks[i].bitmapsub = { width: this.tracks[i].label.split(':')[1] }
            if (this.tracks[i].default) {
                this.tracks[i].mode = 'hidden'
                this.currentSubtitle = this.tracks[i]
                this.selectItem(item)
            } else {
                this.tracks[i].mode = 'disabled'
            }
            item.handleClick = () => {
                this.selectItem(item)
                this.changeTrack(item.track.id)
            }
            // append item to subtitle menu
            this.player.controlBar.subsCapsButton.menu.addChild(item)
            witnessFlag += 1
        }

        if (!witnessFlag) return

        this.css = [...document.styleSheets]
            .find(css => css.ownerNode.id == 'css-bitmap-subtitle').cssRules
        this.activeContainerStyle = [...this.css].find(r => r.selectorText == '#bitmapsub-container').style
        this.offSubtitle.handleClick = () => {
            // on click disable all tracks
            for (let i = 0; i < this.tracks.length; i++) {
                this.tracks[i].mode = 'disabled'
            }
            this.disableSubtitle()
        }
        this.subtitle = this.bmpComponent.el().querySelector('#bitmap-subtitle')
        this.player.addChild(this.bmpComponent)
        // force displaying subtitle button into menu
        this.player.controlBar.subsCapsButton.show()

        // TODO move into handle function
        this.player.on('fullscreenchange', this.adjustSubtitleBottom.bind(this))

        this.player.on('playerresize', this.handlePlayerResize.bind(this))
        if (!this.currentSubtitle) return
        this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this))
    }

    handlePlayerResize() {
        if (!this.currentSubtitle) return
        const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.bitmapsub.width).toFixed(2)
        this.bmpComponent.el().style.scale = `${scaleSize}`
        this.adjustSubtitleBottom()
    }

    disableSubtitle() {
        this.player.controlBar.subsCapsButton.menu
            .children().forEach(
                e => e.removeClass('vjs-selected')
            )
        this.offSubtitle.addClass('vjs-selected')
        this.bmpComponent.hide()
    }

    selectItem(item) {
        this.disableSubtitle()
        this.bmpComponent.show()
        this.offSubtitle.removeClass('vjs-selected')
        item.addClass('vjs-selected')
    }

    handleBitmapSubtitle() {
        if (this.currentSubtitle.activeCues.length) {
            // active cues starts
            const chunks = this.currentSubtitle.activeCues[0].text.split(' ')
            const backgroundImage = [this.options.pathPrefix, chunks[0]].join('/')
            const [width, height, driftX, driftY] = chunks[1].split(':')
            this.subtitle.style.width = `${width}px`
            this.subtitle.style.height = `${height}px`
            this.subtitle.style.backgroundImage = `url(${backgroundImage})`
            this.subtitle.style.backgroundPositionY = `-${driftY}px`
            this.subtitle.style.backgroundPositionX = `-${driftX}px`
            this.bmpComponent.el().style.opacity = 1
        } else {
            // active cues ends
            this.bmpComponent.el().style.opacity = 0
        }
    }

    changeTrack(id) {
        for (let i = 0; i < this.tracks.length; i++) {
            if (this.tracks[i].id != id) {
                this.tracks[i].mode = 'disabled'
                continue
            }
            this.tracks[i].mode = 'hidden'
            try {
                this.currentSubtitle.removeEventListener('cuechange', this.handleBitmapSubtitle)
            } catch (TypeError) { }
            this.currentSubtitle = this.tracks[i]
            this.handlePlayerResize()
            this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this))
        }
    }

    adjustSubtitleBottom() {
        // adding extra bottom space based on arbitrary video height fraction
        const subtitleBottomMargin = (this.player.children()[0].getBoundingClientRect().height / 32) * window.devicePixelRatio
        const ctrlBarHeight = this.player.controlBar.height()
        let drift = subtitleBottomMargin
        if (this.player.isFullscreen()) {
            // bottom of video is computed against textTrackDisplay
            // dimensions, device aspect ration must be applied
            const videoBottomBlank = ((screen.height - this.player.textTrackDisplay.height()) / 2)
            videoBottomBlank >= ctrlBarHeight
                ? drift += videoBottomBlank
                : drift += ctrlBarHeight
        }
        this.activeContainerStyle.setProperty('--drift', `${drift}px`)
    }
}

BitmapSub.VERSION = '0.1.3'
videojs.registerPlugin('bitmapsub', BitmapSub)

export default BitmapSub
