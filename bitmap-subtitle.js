import { BitmapSubComponent } from './bitmap-subtitle.components.js'

const videojsPlugin = videojs.getPlugin('plugin')

class BitmapSub extends videojsPlugin {

    subMenu
    subtitleTracks = []
    currentSubtitle
    player
    options
    screenWidth = 0
    screenHeight = 0
    subtitleLineHeightRatio = 16.5
    container

    constructor(player, options) {
        super(player, options)
        this.player = player
        this.options = options

        this.init()
    }

    init() {
        this.screenWidth = Math.floor(window.devicePixelRatio * screen.width)
        this.screenHeight = Math.floor(window.devicePixelRatio * screen.height)
        if (this.options.startupSeek) this.player.currentTime(this.options.startupSeek)
        this.subMenu = this.player.controlBar.subsCapsButton.menu
        const vjsSubsCapsMenuItem = videojs.getComponent('SubsCapsMenuItem')
        const tracks = this.player.textTracks()
        this.container = new BitmapSubComponent(this.player, this.options)

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == 'metadata' && tracks[i].label.startsWith('bitmap:')) {
                this.subtitleTracks.push(tracks[i])
                const item = new vjsSubsCapsMenuItem(this.player, {
                    track: {
                        label: tracks[i].label.split(':')[2],
                        language: tracks[i].language,
                        id: tracks[i].id,
                        default: tracks[i].default,
                    },
                })
                // add native bitmap subtitle size
                tracks[i].bitmapsub = { width: tracks[i].label.split(':')[1] }
                if (tracks[i].default) {
                    tracks[i].mode = 'hidden'
                    this.currentSubtitle = tracks[i]
                    this.selectItem(item)
                } else {
                    tracks[i].mode = 'disabled'
                }
                item.handleClick = () => {
                    this.selectItem(item)
                    this.changeTrack(item.track.id)
                }
                this.subMenu.addChild(item)
            }
        }

        if (!this.subtitleTracks.length) return

        this.player.addChild(this.container)
        this.player.controlBar.subsCapsButton.show()
        this.currentSubtitle.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this))

        this.player.on('playerresize', e => {
            const scaleSize = (this.player.textTrackDisplay.dimension('width') / this.currentSubtitle.bitmapsub.width).toFixed(2)
            this.container.el().style.scale = `${scaleSize}`
            if (!this.player.isFullscreen()) return
            this.adjustSubtitleBottom()
        })

        this.player.on('fullscreenchange', e => {
            if (this.player.isFullscreen()) {
                this.adjustSubtitleBottom()
            } else {
                this.container.el().style.bottom = '0px'
            }
        })
    }

    selectItem(item) {
        this.player.controlBar.subsCapsButton.menu.children().forEach(
            e => e.removeClass('vjs-selected'))
        item.addClass('vjs-selected')
    }

    handleBitmapSubtitle(event) {
        if (this.currentSubtitle.activeCues.length) {
            // active cues starts
            const chunks = this.currentSubtitle.activeCues[0].text.split(' ')
            const backgroundImage = [this.options.pathPrefix, chunks[0]].join('/')
            const [width, height, driftX, driftY] = chunks[1].split(':')
            vobsub.style.width = `${width}px`
            vobsub.style.height = `${height}px`
            vobsub.style.backgroundPositionY = `-${driftY}px`
            vobsub.style.backgroundPositionX = `-${driftX}px`
            vobsub.style.backgroundImage = `url(${backgroundImage})`
            this.container.el().style.opacity = 1
        } else {
            // active cues ends
            this.container.el().style.opacity = 0
        }
    }

    changeTrack(id) {
        const tracks = this.player.textTracks()
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].id == id) {
                tracks[i].mode = 'hidden'
                try {
                    this.currentVobsub.removeEventListener('cuechange', this.handleBitmapSubtitle)
                } catch (TypeError) { }
                this.currentVobsub = tracks[i]
                this.currentVobsub.addEventListener('cuechange', this.handleBitmapSubtitle.bind(this))
                continue
            }
            tracks[i].mode = 'disabled'
        }
    }

    adjustSubtitleBottom() {
        const videoBottomEdge = (this.screenHeight - this.player.textTrackDisplay.dimension('height')) / 2
        this.container.el().style.bottom = `${videoBottomEdge + 64}px`
    }
}

VobSub.VERSION = '0.1.0'
videojs.registerPlugin('vobsub', VobSub)

export default VobSub