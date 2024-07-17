import VobSub from "./vobsub.js"

const options = {
    fluid: true,
    controls: true,
    controlBar: { pictureInPictureToggle: false },
    muted: true,
    autoplay: true,
}

const player = videojs('sample', options)

//player.on(['canplay', 'ready', 'loadmetadata', 'loadedmetadata', 'loadstart'], e => {
//    if (e.type == 'loadstart') {
//        player.vobsub({
//            pathPrefix: '/tmp/',
//            // startupSeek: (16 * 60) + 20
//            startupSeek: 54
//        })
//    }
//})
player.on('ready', e => {
    // const track = player.addRemoteTextTrack({
    //     src: '/tmp/fake.vtt',
    //     kind: 'metadata',
    //     label: 'fake'
    // })
    // track.addEventListener('load', e => {
    //     console.log(e)
    //     player.textTracks()[0].mode = 'hidden'
    // })
    // const tracks = player.textTracks()
    // for (let i = 0; i < tracks.length; i++) {
    //     if (tracks[i].kind == 'metadata' && tracks[i].label == 'fake') {
    //         tracks[i].addEventListener('cuechange', e => { console.log(e) })
    //     }
    // }
    player.vobsub({
        pathPrefix: '/tmp/',
        // startupSeek: (16*60)+20,
        startupSeek: (33 * 60) + 20,
    })
})