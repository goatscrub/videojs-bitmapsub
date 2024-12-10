const videojsGenerateKarmaConfig = require('videojs-generate-karma-config');
const generate = require('videojs-generate-karma-config');

module.exports = function(config) {
  let options;
  // see https://github.com/videojs/videojs-generate-karma-config
  // for options
  // const options = {
  // browsers(aboutToRun) {
  // never test on Safari
  // return aboutToRun.filter(function(launcherName) {
  //   console.log(launcherName);
  //   return launcherName !== 'Firefox';
  // });
  // }

  if (process.env.GNUK_DEV_WATCH) {
    console.log(' - DEV MODE ENABLE - test only against Chrome');
    // test on Chrome only
    options = {
      browsers(aboutToRun) {
        return ['ChromeHeadless'];
      }
    };
  } else {
    options = {};
  }

  config = generate(config, options);
  config.hostname = 'karma.videojs-bitmapsub.test';
  config.listenAddress = '127.0.0.1';
  config.logLevel = config.LOG_WARN;

  // any other custom stuff not supported by options here!
};
