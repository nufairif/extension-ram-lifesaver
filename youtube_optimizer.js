// YouTube Background Video RAM/CPU Throttler

(function() {
  let isThrottled = false;

  function handleVisibilityChange() {
    chrome.storage.local.get('settings', (res) => {
      const settings = res.settings || {};
      if (settings.throttleYoutube === false) return;

      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      const video = document.querySelector('video');

      if (document.hidden) {
        // Tab sedang di latar belakang
        if (player && typeof player.setPlaybackQualityRange === 'function') {
          // Turunkan resolusi ke 144p agar hemat RAM & decoding beban GPU/CPU
          player.setPlaybackQualityRange('tiny', 'tiny');
          isThrottled = true;
          console.log('[RAM Lifesaver] Mode hemat RAM aktif pada YouTube latar belakang (144p).');
        }
      } else {
        // Tab dibuka kembali
        if (isThrottled && player && typeof player.setPlaybackQualityRange === 'function') {
          player.setPlaybackQualityRange('default', 'highres');
          isThrottled = false;
          console.log('[RAM Lifesaver] Kualitas YouTube dipulihkan ke normal.');
        }
      }
    });
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
})();
