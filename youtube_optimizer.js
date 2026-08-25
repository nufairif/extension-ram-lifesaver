// YouTube Background Video RAM/CPU Throttler (QA Verified v1.1.1)

(function() {
  let isThrottled = false;

  function handleVisibilityChange() {
    try {
      chrome.storage.local.get('settings', (res) => {
        if (chrome.runtime.lastError) return;

        const settings = (res && res.settings) || {};
        if (settings.throttleYoutube === false) return;

        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');

        if (document.hidden) {
          // Tab sedang di latar belakang
          if (player && typeof player.setPlaybackQualityRange === 'function') {
            try {
              player.setPlaybackQualityRange('tiny', 'tiny');
              isThrottled = true;
            } catch (e) {}
          }
        } else {
          // Tab dibuka kembali
          if (isThrottled && player && typeof player.setPlaybackQualityRange === 'function') {
            try {
              player.setPlaybackQualityRange('default', 'highres');
              isThrottled = false;
            } catch (e) {}
          }
        }
      });
    } catch (err) {}
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
})();
