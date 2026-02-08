// Permission request page script

const btn = document.getElementById('request-btn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  try {
    status.textContent = 'Requesting permission...';
    status.className = 'status';

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    status.textContent = 'Permission granted! You can close this tab.';
    status.className = 'status success';
    btn.textContent = 'Done';
    btn.disabled = true;

    // Notify the extension
    if (chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'MICROPHONE_PERMISSION_GRANTED' });
    }

    // Auto-close after 2 seconds
    setTimeout(() => window.close(), 2000);
  } catch (error) {
    console.error('Permission error:', error);
    if (error.name === 'NotAllowedError') {
      status.textContent = 'Permission denied. Please click Allow when prompted.';
    } else {
      status.textContent = `Error: ${error.message}`;
    }
    status.className = 'status error';
  }
});
