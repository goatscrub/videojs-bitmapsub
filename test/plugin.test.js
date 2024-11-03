import document from 'global/document';
import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';
import BitmapSubtitle from '../src/plugin';
import packageJson from '../package.json';

const ALL_EVENTS = ['abort', 'addtrack', 'aftermodalfill', 'audiotrackchange', 'beforemodalclose', 'beforemodalempty', 'beforemodalfill', 'beforemodalopen', 'beforepluginsetup', 'beforepluginsetup:bitmapsub', 'canplay', 'canplaythrough', 'change', 'close', 'componentresize', 'controlsdisabled', 'controlsenabled', 'dispose', 'durationchange', 'emptied', 'ended', 'enterFullWindow', 'enterpictureinpicture', 'error', 'exitFullWindow', 'fullscreenchange', 'labelchange', 'languagechange', 'leavepictureinpicture', 'loadeddata', 'loadedmetadata', 'loadstart', 'modalclose', 'modalempty', 'modalfill', 'modalKeydown', 'modalopen', 'modechange', 'pause', 'play', 'playbackrateschange', 'playerresize', 'playing', 'pluginsetup', 'pluginsetup:bitmapsub', 'posterchange', 'progress', 'ratechange', 'ready', 'removetrack', 'resize', 'seeked', 'seeking', 'selectedchange', 'slideractive', 'sliderinactive', 'sourceset', 'stalled', 'statechanged', 'suspend', 'tap', 'textdata', 'texttrackchange', 'timeupdate', 'useractive', 'userinactive', 'usingcustomcontrols', 'usingnativecontrols', 'videotrackchange', 'volumechange', 'vttjsloaded', 'waiting'];
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
// QUnit.log((details) => console.log(`> ${details.module} >> ${details.name} : ${details.message}`));

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
    const plg = player.bitmapsub();

    plg.on('dispose', event => {
      assert.strictEqual(spy.callCount, 1, 'plugin dispose when player dispose method is called');
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
        assert.strictEqual(spy.callCount, 1, 'scaleSubtitle() called on video window readiness event');
        done();
      });
      plg.bmpsubVideoWindow.on('videowindowresize', evt => {
        assert.strictEqual(spy.callCount, 2, 'scaleSubtitle() called on video window resize event');
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
    this.testPropertiesCallCount = 0;
    /**
     * test inline style properties on target DOM element
     *
    * @param {DOM} target dom element
    * @param {Object} values object defining properties like {width="30px", height="50px"}
    * @param {string} reference reference all to help distinguish test
    */
    this.testProperties = (target, values = {}, nothing, reference = '') => {
      this.testPropertiesCallCount += 1;
      Object.keys(values).forEach(property => {
        assert.strictEqual(
          target.style.getPropertyValue(property),
          values[property],
          `${this.testPropertiesCallCount}${reference}|inlineStyle property ${property}="${values[property]}"`
        );
      });
    };

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

    source.setAttribute('src', '../../docs/samples/vobsub-sample.mp4');
    source.setAttribute('type', 'video/mp4');
    track += '<track default src="../../docs/samples/vobsub.fre.vtt" kind="metadata" label="vobsub:1920:Français" language="fre">';
    track += '<track src="../../docs/samples/vobsub.fre.vtt" kind="metadata" label="not handle" language="fre">';
    track += '<track src="../../docs/samples/pgssub.eng.vtt" kind="metadata" label="pgssub:1920:English" language="eng">';
    video.appendChild(source);
    video.innerHTML += track;

    this.fixture.appendChild(video);
    this.player = videojs('sample');
    this.plg = this.player.bitmapsub({ pathPrefix: '../../docs/samples' });

    /** forward clock tick by number of ticks
     *
     * @param {number} ticks - number of ticks to forward clock
     */
    /*
    const forward = (ticks) => {
      for (let i = 0; i < ticks; i++) {
        this.clock.tick(1);
      }
    };
    */
  });

  hooks.afterEach(function(assert) {
    if (this.player && !this.player.isDisposed()) {
      this.player.dispose();
    }
    this.testPropertiesCallCount = 0;
    this.clock.restore();
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
    this.clock.tick(10);
  });

  QUnit.test('plugin scaleSubtitle method against currentSubtitle', function(assert) {
    const done = assert.async();

    this.player.on('ready', () => {
      const spy = sinon.spy(this.plg.bmpsubContainer, 'scaleTo');

      this.plg.currentSubtitle.track = undefined;
      this.plg.scaleSubtitle();
      assert.strictEqual(spy.callCount, 0, 'scaleTo method was not called');

      this.plg.currentSubtitle.track = { bitmapsub: { width: 1920 } };
      this.plg.scaleSubtitle();
      assert.strictEqual(spy.callCount, 1, 'scaleTo method was called once');
      done();
      spy.restore();
    });
    this.clock.tick(10);
  });

  QUnit.test('updateBitmapMenu & item selection', function(assert) {
    assert.expect(15);
    const done = assert.async();
    const spy = sinon.spy(this.plg, 'updateBitmapMenu');

    assert.strictEqual(spy.callCount, 0, 'updateBitmapMenu not already called');

    this.player.on('loadeddata', e => {
      assert.strictEqual(this.plg.bitmapTracks.length, 2, 'number of bitmap tracks');
      assert.equal(this.plg.bitmapTracks[0].mode, 'hidden', 'default track has mode "hidden"');
      assert.equal(this.plg.bitmapTracks[1].mode, 'disabled', 'default track has mode "disabled"');
      assert.equal(this.plg.bitmapTracks[0].bitmapsub.width, '1920', 'bitmapsub width "1920"');
      assert.equal(this.plg.bitmapTracks[1].bitmapsub.width, '1920', 'bitmapsub width "1920"');

      assert.strictEqual(spy.callCount, 1, 'updateBitmapMenu called on plugin initialization');
      this.player.textTracks().trigger('addtrack');
      assert.strictEqual(spy.callCount, 2, 'updateBitmapMenu after addtrack event');
      this.player.textTracks().trigger('change');
      assert.strictEqual(spy.callCount, 2, 'updateBitmapMenu not called with change event');
      this.player.textTracks().trigger('removetrack');
      assert.strictEqual(spy.callCount, 3, 'updateBitmapMenu after removetrack event');

      assert.true(this.plg.bmpsubContainer.el().classList.contains('vobsub'), 'container className "vobsub" present');
      // Click on first menu item, first one is "bitmap-off"
      this.plg.bmpsubMenu.menu.children()[0].handleClick();
      assert.false(this.plg.bmpsubContainer.el().classList.contains('vobsub'), 'container className "vobsub" absent');
      assert.false(this.plg.bmpsubContainer.el().classList.contains('pgssub'), 'container className "pgssub" absent');
      // Click on second item, second one is "vobsub" metadata track
      this.plg.bmpsubMenu.menu.children()[1].handleClick();
      assert.true(this.plg.bmpsubContainer.el().classList.contains('vobsub'), 'container className "vobsub" present');
      // Click on third item, third one is "pgssub" metadata track
      this.plg.bmpsubMenu.menu.children()[2].handleClick();
      assert.true(this.plg.bmpsubContainer.el().classList.contains('pgssub'), 'container className "pgssub" present');
      done();
      spy.restore();
    });

    this.clock.tick(10);
  });

  QUnit.test('Video window size', function(assert) {
    const done = assert.async();
    const testProperties = this.testProperties;
    let expectedValues = {};

    this.clock.tick(50);

    this.player.on('canplay', e => {
      // player initial size
      expectedValues = {
        'width': '', 'height': '',
        'top': '', 'left': '',
        '--padding': '', '--adjustment': ''
      };
      const target = this.plg.bmpsubVideoWindow.el();

      testProperties(target, expectedValues, assert, '@initial');

      // Change video player size ; wide
      [this.player.el().style.width, this.player.el().style.height] = ['500px', '200px'];
      expectedValues = {
        'width': '356px',
        'height': '200px',
        'top': '0px',
        'left': '72px',
        '--padding': '6.25px',
        '--adjustment': '30px'
      };
      // trigger event to run corresponding plugin method
      this.player.trigger('playerresize');
      testProperties(target, expectedValues, assert, '@wide');

      // Change video player size ; tall
      [this.player.el().style.width, this.player.el().style.height] = ['300px', '250px'];
      expectedValues = {
        'width': '300px',
        'height': '169px',
        'top': '41px',
        'left': '0px',
        '--padding': '5.28125px',
        '--adjustment': '0px'
      };
      // trigger event to run corresponding plugin method
      this.player.trigger('playerresize');
      testProperties(target, expectedValues, assert, '@tall');

      // Change video player size ; tall with adjustment
      [this.player.el().style.width, this.player.el().style.height] = ['300px', '200px'];
      expectedValues = {
        'width': '300px',
        'height': '169px',
        'top': '16px',
        'left': '0px',
        '--padding': '5.28125px',
        '--adjustment': '14px'
      };
      // trigger event to run corresponding plugin method
      this.player.trigger('playerresize');
      testProperties(target, expectedValues, assert, '@tall+adjustment');

      // Change video player size to the video size
      [this.player.el().style.width, this.player.el().style.height] = [this.player.videoWidth() + 'px', this.player.videoHeight() + 'px'];
      expectedValues = {
        'width': '640px',
        'height': '360px',
        'top': '0px',
        'left': '0px',
        '--padding': '11.25px',
        '--adjustment': '30px'
      };
      this.player.trigger('playerresize');
      testProperties(target, expectedValues, assert, '@video size');
      done();
    });
  });

  QUnit.test('updateSubtitle', function(assert) {
    const [player, plg, clock, testProperties] = [this.player, this.plg, this.clock, this.testProperties];
    const done = assert.async(2);
    const spy = sinon.spy(plg, 'updateSubtitle');

    player.on('loadeddata', event => {
      // Default track is index 0 and a bitmap one
      const tt = player.textTracks()[0];
      let expectedValues = {};

      // Wait until cuechange events finished
      plg.currentSubtitle.track.on('cuechange', e => done());
      // Set player size
      player.el().style.width = '640px';
      player.el().style.height = '360px';
      // Trigger canplay to initialize bmpsubVideoWindow component size
      player.trigger('canplay');
      // Trigger playerresize to initialize bmpsubVideoWindow component size
      player.trigger('playerresize');
      plg.bmpsubVideoWindow.trigger('videowindowresize');
      clock.tick(10);
      assert.strictEqual(plg.bmpsubContainer.el().style.opacity, '', 'Container style property opacity not present');

      // fake first cue active at this time
      player.currentTime(2);
      tt.trigger('cuechange');
      // test CSS properties on subtitle container element
      expectedValues = { scale: '0.33', opacity: '1' };
      testProperties(plg.bmpsubContainer.el(), expectedValues, assert, '-container');
      // test CSS properties on subtitle element
      expectedValues = {
        'width': '619px', 'height': '54px',
        'background-image': 'url(\"../../docs/samples/sample1.01.vobsub.png\")',
        'background-position': '-1620px -290px'
      };
      testProperties(plg.subtitleElement, expectedValues, assert, '-subtitleElement');
      // Check component visibility
      assert.strictEqual(plg.bmpsubContainer.el().style.opacity, '1', 'Container style property opacity="1"');

      // fake cue become disable at this time
      player.currentTime(12.5);
      tt.trigger('cuechange');
      // test CSS properties on subtitle container element become hidden
      expectedValues = { scale: '0.33', opacity: '0' };
      testProperties(plg.bmpsubContainer.el(), expectedValues, assert, '-container');
      // test CSS properties on subtitle element, no changes against previous test
      expectedValues = {
        'width': '619px', 'height': '54px',
        'background-image': 'url(\"../../docs/samples/sample1.01.vobsub.png\")',
        'background-position': '-1620px -290px'
      };
      testProperties(plg.subtitleElement, expectedValues, assert, '-subtitleElement');
      // Check component visibility
      assert.strictEqual(plg.bmpsubContainer.el().style.opacity, '0', 'Container style property opacity="0"');

      // Check number of updateSubtitle() calls
      assert.strictEqual(spy.callCount, 2, 'updateSubtitle() called twice');
    });
    clock.tick(50);
  });
});
