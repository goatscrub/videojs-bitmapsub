import document from 'global/document';
import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';
import BitmapSubtitle from '../src/plugin';
import packageJson from '../package.json';

const Player = videojs.getComponent('Player');

/** */
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
  // QUnit.test('plugin dispose when player dispose', function(assert) {
  //   const spy = sinon.spy(BitmapSubtitle.prototype, 'dispose');
  //   const done = assert.async();
  //   const player = videojs('sample');
  //   const plg = player.bitmapsub(player);

  //   plg.on('dispose', event => {
  //     assert.equal(spy.callCount, 1, 'plugin dispose when player dispose method is called');
  //     assert.ok(plg.isDisposed(), 'plugin can say is disposed');
  //     done();
  //   });
  //   player.dispose();
  // });

  // QUnit.test.only('plugin event listener for scaleSubtitle on playerresize', function(assert) {
  //   // const spy = sinon.spy(this.plg, 'scaleSubtitle');
  //   // const done = assert.async();

  //   // this.player.on('playerresize', event => {
  //   //   assert.equal(spy.callCount, 1, 'scaleSubtitle() called once');
  //   //   done();
  //   // });
  //   // this.player.trigger('loadeddata');
  //   // this.player.trigger('playerresize');

  //   const spy = sinon.spy(BitmapSubtitle.prototype, 'scaleSubtitle');
  //   const done = assert.async();
  //   const player = videojs('sample', { plugins: { bitmapsub: {} } });

  //   this.clock.tick(1);
  //   player.on('playerresize', event => {
  //     assert.equal(spy.callCount, 1, 'plugin dispose when player dispose method is called');
  //     done();
  //   });
  //   player.trigger('loadeddata');
  //   this.clock.tick(1000);
  //   player.trigger('playerresize');
  //   this.clock.tick(1000);
  // });
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
    track += '<track src="../../docs/samples/pgssub.eng.vtt" kind="metadata" label="pgssub:1920:PGSSUB" language="eng">';
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

  QUnit.test.only('DEBUG TEST: range', function(assert) {
    const player = videojs('sample');

    ['ready', 'loadeddata', 'loadstart', 'pluginsetup',
      'timeupdate', 'pluginsetup:bitmapsub', 'resize',
      'playerresize', 'canplay', 'componentresize']
      .forEach(eventName => {
        listenOn(player, eventName, assert);
      });
    player.el().style.width = '600px';
    player.el().style.height = '600px';
    const plg = player.bitmapsub();
    // this.player = videojs('sample', { plugins: { bitmapsub: { pathPrefix: 'machin' } } });

    this.clock.tick(10);
  });

  QUnit.test('player DOM children', function(assert) {
    const done = assert.async();

    this.player.on('ready', (e) => {
      const videoWindow = this.player.el().querySelector('.bitmapsub-video-window');
      const container = videoWindow.querySelector('.bitmapsub-container');
      const subtitle = container.querySelector('.bitmap-subtitle');

      assert.ok(videoWindow, 'bitmapsub video window element exist');
      assert.ok(container, 'bitmapsub subtitle container element exist');
      assert.ok(subtitle, 'bitmapsub subtitle element exist');
      assert.ok(this.player.controlBar.getChild('bitmapsubMenuButton'), 'bitmap menu button exists');
      done();
    });
    this.clock.tick(1);
    this.player.trigger('loadeddata');
  });

  QUnit.test('plugin scaleSubtitle method against currentSubtitle', function(assert) {
    let spy;
    const done = assert.async();

    this.player.on('ready', () => {
      spy = sinon.spy(this.plg.bmpsubContainer, 'scaleTo');
      console.log(spy);
      assert.ok(true, 'fake test');
      done();
    });
    // this.player.trigger('ready');
    this.clock.tick(1);

    // this.plg.currentSubtitle.track = undefined;
    // this.plg.scaleSubtitle();
    // assert.equal(spy.callCount, 0, 'scaleTo method was not called');

    // this.plg.currentSubtitle.track = { bitmapsub: { width: 1920 } };
    // this.plg.scaleSubtitle();
    // assert.equal(spy.callCount, 1, 'scaleTo method was called once');
  });

  QUnit.test('plugin event listener for bitmapMenu', function(assert) {
    const spy = sinon.spy(this.plg, 'updateBitmapMenu');
    const done = assert.async();
    const nofTest = 5;

    assert.expect(nofTest);

    assert.equal(spy.callCount, 0, `updateBitmapMenu() not called yet (1/${nofTest})`);
    this.player.on('loadeddata', event => {
      assert.equal(spy.callCount, 1, `updateBitmapMenu() called once (2/${nofTest})`);
      done();
    });
    this.player.trigger('loadeddata');
    this.player.textTracks().trigger('addtrack');
    assert.equal(spy.callCount, 2, `updateBitmapMenu() called once again (3/${nofTest})`);
    this.player.textTracks().trigger('removetrack');
    assert.equal(spy.callCount, 3, `updateBitmapMenu() called once again (4/${nofTest})`);
    // callCount won't update with "change" event
    this.player.textTracks().trigger('change');
    assert.equal(spy.callCount, 3, `updateBitmapMenu() not called on textTracks change (5/${nofTest})`);
  });

  QUnit.test('loading tracks', function(assert) {
    const done = assert.async();

    this.player.on('loadeddata', e => {
      assert.equal(this.plg.bitmapTracks.length, 2, 'number of bitmap tracks');
      assert.equal(this.plg.bitmapTracks[0].mode, 'hidden', 'default track has mode "hidden"');
      assert.equal(this.plg.bitmapTracks[1].mode, 'disabled', 'default track has mode "disabled"');
      assert.equal(this.plg.bitmapTracks[0].bitmapsub.width, '720', 'bitmapsub width 720');
      assert.equal(this.plg.bitmapTracks[1].bitmapsub.width, '1920', 'bitmapsub width 1920');
      done();
    });
    this.clock.tick(10);
  });

  QUnit.test('loading tracks pgssub', function(assert) {

    const done = assert.async();

    this.player.on('loadeddata', e => {
      // for (let i = 0; i <= this.player.textTracks().length; i++) {
      //   console.log(this.player.textTracks()[i].id);
      // }
      this.plg.changeToTrack(this.player.textTracks()[1].id);
      this.player.textTracks()[0].mode = 'disabled';
      this.player.textTracks()[1].mode = 'disabled';
      this.player.textTracks()[2].mode = 'hidden';
      this.clock.tick(10);
      this.player.textTracks().trigger('change');
      this.clock.tick(10);
      console.log(this.plg.currentSubtitle.track.id, this.plg.currentSubtitle.track.label);
      assert.ok(true, 'fake test');
      done();
    });
    // this.player.trigger('loadeddata');
    this.clock.tick(10);
  });
});
