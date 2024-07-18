import BitmapSub from "./bitmap-subtitle.js"

const options = {
    fluid: true,
    controls: true,
    controlBar: { pictureInPictureToggle: false },
    muted: true,
    autoplay: true,
}

const player = videojs('sample', options)

player.on('ready', ev => {
    player.vobsub({
        pathPrefix: '/tmp/',
        // startupSeek: (16*60)+20,
        startupSeek: (13 * 60) + 20,
    })
})