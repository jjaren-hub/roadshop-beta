const offline = document.getElementById('offline');
if ('serviceWorker' in navigator) {
  offline.textContent = 'Preparing offline access…';
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    offline.textContent = 'Ready for offline use on this device.';
  }).catch(() => { offline.textContent = 'Offline setup unavailable. Reopen while connected to try again.'; });
} else { offline.textContent = 'This browser requires an internet connection to open the app.'; }
