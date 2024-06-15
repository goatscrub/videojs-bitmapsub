const options = {
    fluid: true,
    controls:true,
    controlBar: {pictureInPictureToggle:false},
    // muted: true,
    // autoplay: true,
}

const videojsPlugin = videojs.getPlugin('plugin')

class VobSub extends videojsPlugin {

    subMenu
    startupSeek=(50*60)+10
    vobsubTracks = []
    currentVobsub

    constructor(player, options) {
        super(player, options)

        this.init()
    }

    init() {
        if (this.startupSeek) player.currentTime(this.startupSeek)
        this.subMenu = player.controlBar.subsCapsButton.menu
        const vjsSubsCapsMenuItem=videojs.getComponent('SubsCapsMenuItem')

        const vobsubMenuItems=[]
        const tracks=player.textTracks()
        const vobsubContainer = new vobsubComponent(player, options)
        const vobsub=document.createElement('div')
        vobsub.id='vobsub'
        vobsubContainer.el().appendChild(vobsub)

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == 'metadata' && tracks[i].label.startsWith('vobsub:')) {
                this.vobsubTracks.push(tracks[i])
                const item=new vjsSubsCapsMenuItem(player, {
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
                    vobsubContainer.el().style.opacity=1
                }
                this.subMenu.addChild(item)
            }
        }
        if (this.vobsubTracks.length > 0) {
            // console.log(`🦄  init  vobsubTracks:`, this.vobsubTracks);
            player.addChild(vobsubContainer)
            player.controlBar.subsCapsButton.show()
        }

        this.currentVobsub.addEventListener('cuechange', function (e) {
            if (this.activeCues.length) {
                // active cues starts
                const chunks=this.activeCues[0].text.split(' ')
                const backgroundImage=chunks[0]
                ; const [width, height] = chunks[1].split(':')[0].split('×')
                ; const [driftY, driftX ]=chunks[1].split(':').slice(1)
                vobsub.style.width = `${width}px`
                vobsub.style.height = `${height}px`
                vobsub.style.backgroundPositionY = `-${driftY}px`
                vobsub.style.backgroundPositionX = `-${driftX}px`
                vobsub.style.backgroundImage=`url(${backgroundImage})`
                vobsubContainer.el().style.opacity = 1
            } else {
                // active cues ends
                vobsubContainer.el().style.opacity = 0
            }
        })

        //vobsubTrack.addEventListener('playerresize', e => {
        //    console.log(e)
        //})

        player.on('playerresize', e => {
            // const scaleSize=parseFloat(e.target.clientWidth/720).toFixed(2)
            const scaleSize=(player.textTrackDisplay.dimension('width')/this.currentVobsub.vobsub.width).toFixed(2)
            vobsubContainer.el().style.scale=`${scaleSize}`
        })
    }
}

VobSub.VERSION='0.0.3'
videojs.registerPlugin('vobsub', VobSub)

const player = videojs('sample', options)

// TEST HERE
const menuItem=videojs.getComponent('MenuItem')
const menuButton=videojs.getComponent('MenuButton')

class vobsubMenuButton extends menuButton {
    createItems() {
        return this.options().vobsubItems.map(vi => {
            const item=new menuItem(this.player(), {label: vi.label})
            item.handleClick = () => { console.log(`here: ${vi.label}`)}
            return item
        })
    }

    buildCssClass() {
        return `vjs-chapters-button ${super.buildCssClass()}`
    }
}

videojs.registerComponent('vobsubMenuButton', vobsubMenuButton)

const vjsComponent = videojs.getComponent('Component')
class vobsubComponent extends vjsComponent {

    constructor(player, options) {
        super(player, options)
    }

    createEl() {
        return videojs.dom.createEl('div', { id: 'vobsub-container' })
    }
}

videojs.registerComponent('vobsubComponent', vobsubComponent)

function log(things) {
    const time=new Date().toTimeString().split(' ').splice(0, 1)
    console.log(`${time}: ${things}`)
}

player.on(['canplay', 'ready', 'loadmetadata', 'loadedmetadata', 'loadstart'], e => {
    if (e.type == 'loadstart') {
        player.vobsub()
    }
})