import { vobsubComponent } from './vobsub.components.js'

const videojsPlugin = videojs.getPlugin('plugin')

class VobSub extends videojsPlugin {

    subMenu
    vobsubTracks = []
    currentVobsub
    player
    options
    screenWidth = 0
    screenHeight = 0
    subtitleLineHeightRatio=16.5
    container

    constructor(player, options) {
        super(player, options)
        this.player=player
        this.options=options

        this.init()
    }

    init() {
        this.screenWidth=Math.floor(window.devicePixelRatio*screen.width)
        this.screenHeight=Math.floor(window.devicePixelRatio*screen.height)
        if (this.options.startupSeek) this.player.currentTime(this.options.startupSeek)
        this.subMenu = this.player.controlBar.subsCapsButton.menu
        const vjsSubsCapsMenuItem=videojs.getComponent('SubsCapsMenuItem')

        const tracks=this.player.textTracks()
        const container = new vobsubComponent(this.player, this.options)
        this.container=container
        const vobsub=document.createElement('div')
        vobsub.id='vobsub'
        this.container.el().appendChild(vobsub)

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == 'metadata' && tracks[i].label.startsWith('vobsub:')) {
                this.vobsubTracks.push(tracks[i])
                const item=new vjsSubsCapsMenuItem(this.player, {
                        track: {
                            label:tracks[i].label.split(':')[2],
                            language:tracks[i].language,
                            id:tracks[i].id,
                            default:tracks[i].default,
                        },
                })
                // add native vobsubtitle size
                tracks[i].vobsub = {width:tracks[i].label.split(':')[1]}
                if (tracks[i].default) {
                    tracks[i].mode = 'hidden'
                    this.currentVobsub=tracks[i]
                } else {
                    tracks[i].mode= 'disabled'
                }
                item.handleClick = function () {
                    this.container.el().style.opacity=1
                }
                this.subMenu.addChild(item)
            }
        }
        if (this.vobsubTracks.length > 0) {
            this.player.addChild(this.container)
            this.player.controlBar.subsCapsButton.show()
        }

        this.currentVobsub.addEventListener('cuechange', e => {
            if (this.currentVobsub.activeCues.length) {
                // active cues starts
                const chunks=this.currentVobsub.activeCues[0].text.split(' ')
                const backgroundImage=[this.options.pathPrefix, chunks[0]].join('/')
                ; const [width, height] = chunks[1].split(':')[0].split('×')
                ; const [driftY, driftX ]=chunks[1].split(':').slice(1)
                vobsub.style.width = `${width}px`
                vobsub.style.height = `${height}px`
                vobsub.style.backgroundPositionY = `-${driftY}px`
                vobsub.style.backgroundPositionX = `-${driftX}px`
                vobsub.style.backgroundImage=`url(${backgroundImage})`
                this.container.el().style.opacity = 1
            } else {
                // active cues ends
                this.container.el().style.opacity = 0
            }
        })

        this.player.on('playerresize', e => {
            const scaleSize=(this.player.textTrackDisplay.dimension('width')/this.currentVobsub.vobsub.width).toFixed(2)
            this.container.el().style.scale = `${scaleSize}`
            // console.log(videoBottomEdge)
            if (!this.player.isFullscreen()) return
            this.adjustSubtitleBottom()
        })

        this.player.on('fullscreenchange', e => {
            if (this.player.isFullscreen()) {
                this.adjustSubtitleBottom()
            } else {
                this.container.el().style.bottom='0px'
            }
        })
    }

    adjustSubtitleBottom() {
        const videoBottomEdge=(this.screenHeight-this.player.textTrackDisplay.dimension('height'))/2
        this.container.el().style.bottom=`${videoBottomEdge+64}px`
    }
}

VobSub.VERSION='0.0.3'
videojs.registerPlugin('vobsub', VobSub)

export default VobSub