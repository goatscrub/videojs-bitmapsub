const options = {
    fluid: true,
    controls:true,
    controlBar: {pictureInPictureToggle:false},
    // muted: true,
    autoplay: true,
}

const videojsPlugin = videojs.getPlugin('plugin')

class VobSub extends videojsPlugin {

    subMenu
    startupSeek=(9*60)+25
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
                            label:tracks[i].label.split(':')[1],
                            language:tracks[i].language,
                            id:tracks[i].id,
                            default:tracks[i].default,
                        },
                })
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
                const image=chunks[0]
                const subtitle=chunks[1]
                ; const [subWidth, subHeight] = chunks[1].split(':')[0].split('×')
                ; const [subDriftY, subDriftX ]=chunks[1].split(':')[1].split('×')
                vobsub.style.width = `${subWidth}px`
                vobsub.style.height = `${subHeight}px`
                vobsub.style.backgroundPositionY = `-${subDriftY}px`
                vobsub.style.backgroundPositionX = `-${subDriftX}px`
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
            const scaleSize=(player.textTrackDisplay.dimension('width')/720).toFixed(2)
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
    // log(e.type)
    if (e.type == 'loadstart') {
        player.vobsub()
    }
})