const generate = require('videojs-generate-rollup-config');

// see https://github.com/videojs/videojs-generate-rollup-config
// for options
const options = {
  externals(defaults) {
    return {
      browser: defaults.browser.concat([
        '@dailymotion/vast-client',
        'vpaid-html5-client'
      ]),
      module: defaults.module.concat([
        '@dailymotion/vast-client',
        'vpaid-html5-client'
      ]),
      test: defaults.test.concat([
        '@dailymotion/vast-client',
        'vpaid-html5-client'
      ])
    };
  }
};
const config = generate(options);

// Add additonal builds/customization here!

// export the builds to rollup
export default Object.values(config.builds);
