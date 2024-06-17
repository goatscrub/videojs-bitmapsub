import VobSub from "./vobsub.js"

const options = {
    fluid: true,
    controls:true,
    controlBar: { pictureInPictureToggle: false },
    // muted: true,
    autoplay: true,
}

const player = videojs('sample', options)

player.on(['canplay', 'ready', 'loadmetadata', 'loadedmetadata', 'loadstart'], e => {
    if (e.type == 'loadstart') {
        player.vobsub({
            pathPrefix: '/tmp/',
            startupSeek: (36 * 60) + 20
        })
    }
})