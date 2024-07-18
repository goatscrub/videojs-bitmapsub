// const menuButton = videojs.getComponent('MenuButton')
// const menuItem = videojs.getComponent('MenuItem')
// class vobsubMenuButton extends menuButton {
//     createItems() {
//         return this.options().vobsubItems.map(vi => {
//             const item = new menuItem(this.player(), { label: vi.label })
//             item.handleClick = () => { console.log(`here: ${vi.label}`) }
//             return item
//         })
//     }

//     buildCssClass() {
//         return `vjs-chapters-button ${super.buildCssClass()}`
//     }
// }

const vjsComponent = videojs.getComponent('Component')
class BitmapSubComponent extends vjsComponent {

    constructor(player, options) {
        super(player, options)
    }

    createEl() {
        const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' })
        const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' })
        container.appendChild(subtitle)
        return container
    }
}

// videojs.registerComponent('vobsubMenuButton', vobsubMenuButton)
videojs.registerComponent('BitmapSubComponent', BitmapSubComponent)

export { BitmapSubComponent }