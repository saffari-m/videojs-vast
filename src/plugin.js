import { VASTClient, VASTParser, VASTTracker } from '@dailymotion/vast-client';
import window from 'global/window';
import videojs from 'video.js';
import 'videojs-contrib-ads';
import { version as VERSION } from '../package.json';
// import handleVPAID from "./vpaid-handler";

const Plugin = videojs.getPlugin('plugin');

// Default options for the plugin.
const defaults = {
  seekEnabled: false,
  controlsEnabled: false,
  wrapperLimit: 10,
  withCredentials: true,
  skip: 0,
  vpaid: {
    containerId: undefined,
    containerClass: 'vjs-vpaid-container',
    videoInstance: 'none'
  }
};

/**
 * Create Source Objects
 *
 * @param {Array} mediaFiles  Array of media files
 * @return {Array} Array of source objects
 */
function createSourceObjects(mediaFiles) {
  return mediaFiles.map((mediaFile) => ({
    type: mediaFile.mimeType,
    src: mediaFile.fileURL
  }));
}

/**
 * Determine if the VAST creative has a VPAID media file
 *
 * @param {Object} vastCreative
 * @return {boolean}
 */
// function hasVPAID(vastCreative) {
//   const mediaFiles = vastCreative.mediaFiles;

//   for (let i = 0; i < mediaFiles.length; i++) {
//     if (mediaFiles[i].apiFramework && mediaFiles[i].apiFramework === 'VPAID') {
//       return true;
//     }
//   }
//   return false;
// }

/**
 * An advanced Video.js plugin. For more information on the API
 *
 * See: https://blog.videojs.com/feature-spotlight-advanced-plugins/
 */
class Vast extends Plugin {
  /**
   * Create a Vast plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  constructor(player, options) {
    // the parent class will add player under this.player
    super(player);

    this.options = videojs.mergeOptions(defaults, options);

    // Could be initialized already by user
    if (typeof player.ads === 'function') {
      player.ads({ debug: false });
    }

    this.vastClient = new VASTClient();
    this.originalPlayerState = {};
    this.eventListeners = {};
    this.domElements = {};
    this.vastCreative = null;

    player.on('contentchanged', () => {
      // eslint-disable-next-line no-console
      console.log('Content changed');
    });

    player.on('readyforpreroll', () => {
      // eslint-disable-next-line no-console
      console.log('Trigger read for preroll');

      // if (hasVPAID(this.vastCreative)) {
      //   handleVPAID(player, this.vastCreative, options);
      // } else {
      // }
      this._doPreroll(this.vastCreative);
    });

    this._getVastContent()
      .then((res) => this._handleVast(res))
      .catch((err) => {
        this.player.trigger('adscanceled');
        // eslint-disable-next-line no-console
        console.log(`Ad cancelled: ${err.message}`);
      });

    this.player.ready(() => {
      this.player.addClass('vjs-vast');
    });
  }

  _handleVast(vast) {
    if (!vast.ads || vast.ads.length === 0) {
      this.player.trigger('adscanceled');
      return;
    }

    const linearFn = (creative) => creative.type === 'linear';
    const companionFn = (creative) => creative.type === 'companion';

    const adWithLinear = vast.ads.find((ad) => ad.creatives.some(linearFn));

    const linearCreative = adWithLinear.creatives.find(linearFn);

    const companionCreative = adWithLinear.creatives.find(companionFn);

    const options = this.options;

    if (options.companion && companionCreative) {
      const variation = companionCreative.variations.find((v) =>
        v.width === String(options.companion.maxWidth) &&
          v.height === String(options.companion.maxHeight));

      if (variation) {
        if (variation.staticResource) {
          if (variation.type.indexOf('image') === 0) {
            const clickThroughUrl = variation.companionClickThroughURLTemplate;

            const dest = window.document.getElementById(options.companion.elementId);

            let html;

            if (clickThroughUrl) {
              html = `<a href="${clickThroughUrl}" target="_blank"><img src="${variation.staticResource}"/></a>`;
            } else {
              html = `<img src="${variation.staticResource}"/>`;
            }
            dest.innerHTML = html;
          } else if (
            [
              'application/x-javascript',
              'text/javascript',
              'application/javascript'
            ].indexOf(variation.type) > -1
          ) {
            // handle script
          } else if (variation.type === 'application/x-shockwave-flash') {
            // handle flash
          }
        }
      }
    }

    this.tracker = new VASTTracker(
      this.vastClient,
      adWithLinear,
      linearCreative,
      companionCreative
    );

    this.vastCreative = linearCreative;

    if (linearCreative.mediaFiles.length) {
      // eslint-disable-next-line no-console
      console.log('Trigger ads ready');
      this.player.trigger('adsready');
    } else {
      this.player.trigger('adscanceled');
    }
  }
  /**
   * Get Vast Content
   *
   * @private
   */
  _getVastContent() {
    const { url, xml } = this.options;

    if (url) {
      return this.vastClient.get(url, {
        withCredentials: this.options.withCredentials,
        wrapperLimit: this.options.wrapperLimit
      });
    } else if (xml) {
      const vastParser = new VASTParser();

      let xmlDocument;

      if (xml.constructor === window.XMLDocument) {
        xmlDocument = xml;
      } else if (xml.constructor === String) {
        xmlDocument = new window.DOMParser().parseFromString(xml, 'text/xml');
      } else {
        throw new Error('xml config option must be a String or XMLDocument');
      }

      return vastParser.parseVAST(xmlDocument);
    }
    return Promise.reject(new Error('url or xml option not set'));
  }
  /**
   * Do Pre-roll
   *
   * @private
   */
  _doPreroll(vastCreative) {
    const player = this.player;
    const options = this.options;

    player.ads.startLinearAdMode();

    this.originalPlayerState.controlsEnabled = player.controls();
    player.controls(options.controlsEnabled);

    this.originalPlayerState.seekEnabled =
      player.controlBar.customProgressControl.enabled();
    if (options.seekEnabled) {
      player.controlBar.customProgressControl.enable();
    } else {
      player.controlBar.customProgressControl.disable();
    }

    player.src(createSourceObjects(vastCreative.mediaFiles));

    const blocker = window.document.createElement('div');

    blocker.className = 'vast-blocker';
    blocker.onclick = () => {
      if (player.paused()) {
        player.play();
        return false;
      }
      this.tracker.click();
    };

    this.tracker.on('clickthrough', (url) => {
      window.open(url, '_blank');
    });

    this.domElements.blocker = blocker;
    player.el().insertBefore(blocker, player.controlBar.el());

    const skipButton = window.document.createElement('div');

    skipButton.className = 'vast-skip-button';
    skipButton.style.display = 'none';
    this.domElements.skipButton = skipButton;
    player.el().appendChild(skipButton);

    const clickButton = window.document.createElement('div');

    clickButton.className = 'vast-click-button';
    clickButton.style.display = 'none';
    clickButton.innerText = this.player.localize('MoreInfo');
    // clickButton.onclick = () => {
    //   this.tracker.click();
    // }
    this.domElements.clickButton = clickButton;
    player.el().appendChild(clickButton);

    this.eventListeners.adtimeupdate = () => this._timeUpdate();
    player.one('adplay', () => {
      if (this.options.skip > 0 && player.duration() >= this.options.skip) {
        skipButton.style.display = 'block';
        // clickButton.style.display = 'block';
        player.on('adtimeupdate', this.eventListeners.adtimeupdate);
      }
      this.player.loadingSpinner.el().style.display = 'none';
    });

    this.eventListeners.teardown = () => this._tearDown();

    skipButton.onclick = (e) => {
      if ((' ' + skipButton.className + ' ').indexOf(' enabled ') >= 0) {
        this.tracker.skip();
        this.eventListeners.teardown();
      }
      if (window.Event.prototype.stopPropagation !== undefined) {
        e.stopPropagation();
      } else {
        return false;
      }
    };

    this._setupEvents();

    player.one('adended', this.eventListeners.teardown);
  }

  /**
   * Time Update
   *
   * @private
   */
  _timeUpdate() {
    const player = this.player;

    player.loadingSpinner.el().style.display = 'none';

    const timeLeft = Math.ceil(this.options.skip - player.currentTime());

    if (timeLeft > 0) {
      this.domElements.skipButton.innerHTML =
        timeLeft + ' ' + this.player.localize('SkipSeconds');
    } else if (
      (' ' + this.domElements.skipButton.className + ' ').indexOf(' enabled ') === -1
    ) {
      this.domElements.skipButton.className += ' enabled ';
      this.domElements.skipButton.innerHTML = this.player.localize('SkipAds');
    }
  }

  /**
   * Tear Down
   *
   * @private
   */
  _tearDown() {
    Object.values(this.domElements).forEach((el) =>
      el.parentNode.removeChild(el));
    const player = this.player;

    player.off('adtimeupdate', this.eventListeners.adtimeupdate);

    player.ads.endLinearAdMode();

    player.controls(this.originalPlayerState.controlsEnabled);

    if (this.originalPlayerState.seekEnabled) {
      player.controlBar.customProgressControl.enable();
    } else {
      player.controlBar.customProgressControl.disable();
    }

    player.trigger('vast-done');
  }

  /**
   * Setup Events
   *
   * @private
   */
  _setupEvents() {
    const player = this.player;
    const tracker = this.tracker;

    let errorOccurred = false;

    const canplayFn = function() {
      tracker.trackImpression();
    };

    const timeupdateFn = function() {
      if (isNaN(tracker.assetDuration)) {
        tracker.assetDuration = player.duration();
      }
      tracker.setProgress(player.currentTime());
    };

    const pauseFn = function() {
      tracker.setPaused(true);
      player.one('adplay', function() {
        tracker.setPaused(false);
      });
    };

    const errorFn = function() {
      const MEDIAFILE_PLAYBACK_ERROR = '405';

      tracker.errorWithCode(MEDIAFILE_PLAYBACK_ERROR);
      errorOccurred = true;
      // Do not want to show VAST related errors to the user
      player.error(null);
      player.trigger('adended');
    };

    const fullScreenFn = function() {
      // for 'fullscreen' & 'exitfullscreen'
      tracker.setFullscreen(player.isFullscreen());
    };

    const muteFn = (function() {
      let previousMuted = player.muted();
      let previousVolume = player.volume();

      return function() {
        const volumeNow = player.volume();
        const mutedNow = player.muted();

        if (previousMuted !== mutedNow) {
          tracker.setMuted(mutedNow);
          previousMuted = mutedNow;
        } else if (previousVolume !== volumeNow) {
          if (previousVolume > 0 && volumeNow === 0) {
            tracker.setMuted(true);
          } else if (previousVolume === 0 && volumeNow > 0) {
            tracker.setMuted(false);
          }

          previousVolume = volumeNow;
        }
      };
    })();

    player.on('adcanplay', canplayFn);
    player.on('adtimeupdate', timeupdateFn);
    player.on('adpause', pauseFn);
    player.on('aderror', errorFn);
    player.on('advolumechange', muteFn);
    player.on('fullscreenchange', fullScreenFn);

    player.one('vast-done', function() {
      player.off('adcanplay', canplayFn);
      player.off('adtimeupdate', timeupdateFn);
      player.off('adpause', pauseFn);
      player.off('aderror', errorFn);
      player.off('advolumechange', muteFn);
      player.off('fullscreenchange', fullScreenFn);

      if (!errorOccurred) {
        tracker.complete();
      }
    });
  }
}

// Define default values for the plugin's `state` object here.
Vast.defaultState = {};

// Include the version number.
Vast.VERSION = VERSION;

// Register the plugin with video.js.
videojs.registerPlugin('vast', Vast);

export default Vast;
