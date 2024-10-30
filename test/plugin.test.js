import document from 'global/document';
import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';
import BitmapSubtitle from '../src/plugin';
import packageJson from '../package.json';

const Player = videojs.getComponent('Player');

/** listen eventName on target
 *
 * @param {DOM} target target
 * @param {string} eventName eventName
 * @param {Assert} assert assert
*/
function listenOn(target, eventName, assert) {
  const done = assert.async(10);

  target.on(eventName, () => {
    console.log(`EVENT: ${eventName}`);
    assert.ok(eventName, 'fake test');
    done();
  });
}
QUnit.log((details) => console.log(`> ${details.module} >> ${details.name} : ${details.message}`));

QUnit.module('basics', function(hooks) {
  QUnit.test('the environment is sane', function(assert) {
    assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
    assert.strictEqual(typeof sinon, 'object', 'sinon exists');
    assert.strictEqual(typeof videojs, 'function', 'videojs exists');
    assert.strictEqual(typeof BitmapSubtitle, 'function', 'plugin is a function');
  });

  QUnit.test('register itself with video.js', function(assert) {
    assert.strictEqual(
      typeof Player.prototype.bitmapsub,
      'function',
      'videojs-bitmapsub plugin was registered'
    );
  });
});

QUnit.module('videojs-bitmapsub simple', function(hooks) {
  hooks.beforeEach(function(assert) {
    this.clock = sinon.useFakeTimers();
    this.fixture = document.getElementById('qunit-fixture');
    const video = document.createElement('video');

    video.id = 'sample';
    video.className = 'video-js';
    this.fixture.appendChild(video);
  });
  hooks.afterEach(function(assert) {
    this.clock.restore();
  });

  QUnit.test('plugin version', function(assert) {
    const player = videojs('sample');
    const plg = player.bitmapsub();

    assert.equal(plg.version(), packageJson.version, `version is ${packageJson.version}`);
  });

  QUnit.test('default options', function(assert) {
    const player = videojs('sample');
    const plg = player.bitmapsub();

    assert.deepEqual(plg.options, { labelPrefix: '', labelSuffix: ' ⋅BMP', pathPrefix: '/bitmapsub/', name: 'bitmapsub' }, 'defaults options loaded');
    player.dispose();
  });

  QUnit.test('override default options', function(assert) {
    const options = { labelPrefix: 'override#0', labelSuffix: 'override#1', pathPrefix: 'override#2', name: 'override#3' };
    const player = videojs('sample');
    const plg = player.bitmapsub(options);

    assert.deepEqual(plg.options, options, 'override options loaded');
    player.dispose();
  });

  QUnit.test('plugin dispose when player dispose', function(assert) {
    const spy = sinon.spy(BitmapSubtitle.prototype, 'dispose');
    const done = assert.async();
    const player = videojs('sample');
    const plg = player.bitmapsub(player);

    plg.on('dispose', event => {
      assert.equal(spy.callCount, 1, 'plugin dispose when player dispose method is called');
      assert.ok(plg.isDisposed(), 'plugin can say is disposed');
      done();
    });
    player.dispose();
  });

  QUnit.test('plugin event listener for scaleSubtitle on playerresize', function(assert) {
    const player = videojs('sample');
    const plg = player.bitmapsub();
    const spy = sinon.spy(plg, 'scaleSubtitle');
    const done = assert.async(2);

    // plugin need to be ready before all
    plg.on('ready', event => {
      plg.bmpsubVideoWindow.on('ready', evt => {
        assert.equal(spy.callCount, 1, 'scaleSubtitle() called on video window readiness event');
        done();
      });
      plg.bmpsubVideoWindow.on('videowindowresize', evt => {
        assert.equal(spy.callCount, 2, 'scaleSubtitle() called on video window resize event');
        done();
        player.dispose();
      });
      plg.bmpsubVideoWindow.trigger('ready');
      plg.bmpsubVideoWindow.trigger('videowindowresize');
    });
    this.clock.tick(10);
  });
});

QUnit.module('videojs-bitmapsub full', function(hooks) {
  hooks.beforeEach(function(assert) {
    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = sinon.useFakeTimers();
    this.fixture = document.getElementById('qunit-fixture');
    const video = document.createElement('video');

    video.id = 'sample';
    video.className = 'video-js';
    video.controls = true;
    const source = document.createElement('source');
    let track = '';

    source.setAttribute('src', '../../docs/samples/sample1.mp4');
    source.setAttribute('type', 'video/mp4');
    track += '<track default src="../../docs/samples/vobsub.fre.vtt" kind="metadata" label="vobsub:720:Français" language="fre">';
    track += '<track src="../../docs/samples/vobsub.fre.vtt" kind="metadata" label="not handle" language="fre">';
    track += '<track src="../../docs/samples/pgssub.eng.vtt" kind="metadata" label="pgssub:1920:English" language="eng">';
    video.appendChild(source);
    video.innerHTML += track;

    this.fixture.appendChild(video);
    // this.player = videojs('sample');
    // ['ready', 'loadeddata', 'loadstart'].forEach(eventName => listenOn(this.player, eventName));
    // this.plg = this.player.bitmapsub();
    // this.player = videojs('sample', { plugins: { bitmapsub: { pathPrefix: 'machin' } } });
    // this.clock.tick(1);
  });

  hooks.afterEach(function(assert) {
    if (this.player && !this.player.isDisposed()) {
      this.player.dispose();
    }
    this.clock.restore();
  });

  QUnit.test('player DOM children', function(assert) {
    const player = videojs('sample', { plugins: { bitmapsub: {} } });
    const done = assert.async();

    player.on('ready', (e) => {
      const videoWindow = player.el().querySelector('.bitmapsub-video-window');
      const container = videoWindow.querySelector('.bitmapsub-container');
      const subtitle = container.querySelector('.bitmap-subtitle');

      assert.ok(videoWindow, 'bitmapsub video window element exist');
      assert.ok(container, 'bitmapsub subtitle container element exist');
      assert.ok(subtitle, 'bitmapsub subtitle element exist');
      assert.ok(player.controlBar.getChild('bitmapsubMenuButton'), 'bitmap menu button exists');
      done();
    });
    this.clock.tick(10);
    player.dispose();
  });

  QUnit.test('plugin scaleSubtitle method against currentSubtitle', function(assert) {
    const done = assert.async();
    const player = videojs('sample');
    const plg = player.bitmapsub();

    player.on('ready', () => {
      const spy = sinon.spy(plg.bmpsubContainer, 'scaleTo');

      plg.currentSubtitle.track = undefined;
      plg.scaleSubtitle();
      assert.equal(spy.callCount, 0, 'scaleTo method was not called');

      plg.currentSubtitle.track = { bitmapsub: { width: 1920 } };
      plg.scaleSubtitle();
      assert.equal(spy.callCount, 1, 'scaleTo method was called once');
      done();
      spy.restore();
    });
    this.clock.tick(10);
  });

  QUnit.test('updateBitmapMenu', function(assert) {
    assert.expect(10);
    const done = assert.async();
    const player = videojs('sample');
    const plg = player.bitmapsub();
    const spy = sinon.spy(plg, 'updateBitmapMenu');

    assert.equal(spy.callCount, 0, 'updateBitmapMenu not already called');

    player.on('loadeddata', e => {
      assert.equal(plg.bitmapTracks.length, 2, 'number of bitmap tracks');
      assert.equal(plg.bitmapTracks[0].mode, 'hidden', 'default track has mode "hidden"');
      assert.equal(plg.bitmapTracks[1].mode, 'disabled', 'default track has mode "disabled"');
      assert.equal(plg.bitmapTracks[0].bitmapsub.width, '720', 'bitmapsub width "720"');
      assert.equal(plg.bitmapTracks[1].bitmapsub.width, '1920', 'bitmapsub width "1920"');

      assert.equal(spy.callCount, 1, 'updateBitmapMenu called on plugin initialization');
      player.textTracks().trigger('addtrack');
      assert.equal(spy.callCount, 2, 'updateBitmapMenu after addtrack event');
      player.textTracks().trigger('change');
      assert.equal(spy.callCount, 2, 'updateBitmapMenu not called with change event');
      player.textTracks().trigger('removetrack');
      assert.equal(spy.callCount, 3, 'updateBitmapMenu after removetrack event');
      done();
      spy.restore();
    });

    this.clock.tick(10);
  });
});
