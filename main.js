import BitmapSub from "./bitmap-subtitle.js"

const options = {
    fluid: true,
    controls: true,
    controlBar: { pictureInPictureToggle: false },
    // muted: true,
    autoplay: true,
}

const player = videojs('sample', options)

player.on('ready', ev => {
    player.currentTime((60 * 72) + 25)
    player.bitmapsub({
        name: 'bitmapsub',
        pathPrefix: '/tmp/',
    })
// player.hotkeys({ alwaysCaptureHotkeys: true })
})
