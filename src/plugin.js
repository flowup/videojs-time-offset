/* global document */
import videojs from 'video.js';

// Default options for the plugin.
const defaults = {
  start: 0,
  end: 0,
  page: 1,
  perPageInMinutes: 0
};

/**
 * for fixing buffer status overflow issue
 */
const addStyle = () => {
  /**
   * Style already included, only include once
   */
  if (document.getElementById('vjs-time-offset-style')) {
    return false;
  }

  const css = `
    .vjs-time-offset .vjs-load-progress {
       overflow: hidden;
    };
  `;
  const head = document.head || document.getElementsByTagName('head')[0];
  const style = document.createElement('style');

  style.id = 'vjs-time-offset-style';
  style.type = 'text/css';
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }

  head.appendChild(style);
};

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 * @param    {Object} [options={}]
 */
const onPlayerReady = (player, options) => {
  let offsetStart;
  let offsetEnd;
  let computedDuration;

  // trigger ended event only once
  let isEndedTriggered = false;

  /**
   * calc offsetStart and offsetEnd based on options
   * if page params is setted use page values, Otherwise use defaults
   * default perPageInMinutes based on minutes, convert to seconds
   */
  options.perPageInMinutes = options.perPageInMinutes * 60;

  // page is natural number convert it to integer
  options.page = options.page - 1;

  if (options.start > 0) {
    offsetStart = options.start;
  } else {
    offsetStart = options.page * options.perPageInMinutes;
  }

  if (options.end > 0) {
    offsetEnd = options.end;
  } else {
    offsetEnd = (options.page + 1) * options.perPageInMinutes;
  }

  computedDuration = offsetEnd - offsetStart;

  /**
   * For monkey patching take references of original methods
   * We will override original methods
   */
  const __monkey__ = {
    currentTime: player.currentTime,
    remainingTime: player.remainingTime,
    duration: player.duration,
    buffered: player.buffered
  };

  player.addClass('vjs-time-offset');

  addStyle();

  player.remainingTime = () => {
    return player.duration() - player.currentTime();
  };

  player.duration = (...args) => {
    if (offsetEnd > 0) {
      __monkey__.duration.apply(player, args);
      return computedDuration;
    }

    return __monkey__.duration.apply(player, args) - offsetStart;
  };

  player.originalDuration = (...args) => {
    return __monkey__.duration.apply(player, args);
  };

  player.buffered = function () {
    var buffered = __monkey__.buffered.call(player);
    return {
        buffered: buffered,
        length: buffered.length,
        start: function(i) {
          var buf = buffered.start(i) - offsetStart;

          if (buf < 0)                buf = 0;
          if (buf > computedDuration) buf = computedDuration;

          return buf;
        },

        end: function(i) {
          var buf = buffered.end(i) - offsetStart;

          if (buf < 0)                buf = 0;
          if (buf > computedDuration) buf = computedDuration;

          return buf;
        }
    };
  };

  player.currentTime = (seconds) => {
    if (typeof seconds !== 'undefined') {
      seconds = seconds + offsetStart;

      return __monkey__.currentTime.call(player, seconds);
    }

    var current = __monkey__.currentTime.call(player) - offsetStart;

    if (current < -0.1) {
      player.currentTime(0);
      return 0;
    }

    if (current > computedDuration) {
      player.currentTime(computedDuration);
      current = computedDuration;

      // player.pause();
      if (!isEndedTriggered) {
        player.trigger('endedoffset');
        isEndedTriggered = true;
      }
    }

    return current;
  };

  /**
   * When user clicks play button after partition finished
   * start from beginning of partition
   */
  player.on('play', () => {
    const remaining = player.remainingTime();

    if (remaining <= 0) {
      player.currentTime(0);
      player.play();
    }
  });

  player.on('loadedmetadata', () => {
    const current = player.currentTime();
    const originalDuration = player.originalDuration();

    player.pageCount = Math.ceil(originalDuration / options.perPageInMinutes);

    isEndedTriggered = false;
    // if setted end value isn't correct, Fix IT
    // it shouldn't be bigger than video length
    if (offsetEnd > originalDuration) {
      computedDuration = originalDuration - offsetStart;
    }

    // if setted start value isn't correct, Fix IT
    // it shouldn't be bigger than video length
    if (offsetStart > originalDuration) {
      offsetStart = 0;
      computedDuration = originalDuration;
    }

    if (current < 0) {
      player.currentTime(0);
    }
  });

  player.on('timeupdate', () => {
    const remaining = player.remainingTime();

    if (remaining <= 0) {
      player.pause();

      if (!isEndedTriggered) {
        player.trigger('endedoffset');
        player.on('adEnded', function() {
          isEndedTriggered = true;
        });
      }
    }
  });
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function time-offset
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
const timeOffset = function(options) {
  this.ready(() => {
    onPlayerReady(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
videojs.plugin('timeOffset', timeOffset);

// Include the version number.
timeOffset.VERSION = '0.0.1';

export default timeOffset;
