const menuButton = videojs.getComponent('MenuButton')
const menuItem = videojs.getComponent('MenuItem')
const vjsComponent = videojs.getComponent('Component')

class vobsubMenuButton extends menuButton {
    createItems() {
        return this.options().vobsubItems.map(vi => {
            const item = new menuItem(this.player(), { label: vi.label })
            item.handleClick = () => { console.log(`here: ${vi.label}`) }
            return item
        })
    }

    buildCssClass() {
        return `vjs-chapters-button ${super.buildCssClass()}`
    }
}

class vobsubComponent extends vjsComponent {

    constructor(player, options) {
        super(player, options)
    }

    createEl() {
        const container = videojs.dom.createEl('div', { id: 'vobsub-container' })
        const vobsub = videojs.dom.createEl('div', { id: 'vobsub' })
        container.appendChild(vobsub)
        return container
    }
}

videojs.registerComponent('vobsubMenuButton', vobsubMenuButton)
videojs.registerComponent('vobsubComponent', vobsubComponent)

export { vobsubMenuButton, vobsubComponent }