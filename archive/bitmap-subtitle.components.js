const VjsComponent = videojs.getComponent('Component')

class BitmapSubComponent extends VjsComponent {

    constructor(player, options) {
        super(player)
    }

    createEl() {
        const container = videojs.dom.createEl('div', { id: 'bitmapsub-container' })
        const subtitle = videojs.dom.createEl('div', { id: 'bitmap-subtitle' })
        container.appendChild(subtitle)
        return container
    }
}

videojs.registerComponent('BitmapSubComponent', BitmapSubComponent)

export default BitmapSubComponent;
