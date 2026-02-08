// ElevenLabs Real-time Speech-to-Text WebSocket wrapper

const ELEVENLABS_STT_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';

let websocket = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let isListening = false;

/**
 * Check if STT is supported (needs microphone access)
 */
export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start listening for speech using ElevenLabs real-time STT.
 * @param {Object} options
 * @param {string} options.token - Single-use token from server
 * @param {Function} options.onTranscript - Called with { partial, committed } transcripts
 * @param {Function} options.onEnd - Called when listening ends (VAD detected silence)
 * @param {Function} options.onError - Called on error
 * @param {number} options.silenceThreshold - Seconds of silence before commit (default: 2)
 */
export async function startListening(options = {}) {
  if (!options.token) {
    options.onError?.('Token is required');
    return false;
  }

  if (isListening) {
    await stopListening();
  }

  try {
    // Get microphone access
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    // Build WebSocket URL with parameters
    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      audio_format: 'pcm_16000',
      language_code: 'en',
      commit_strategy: 'vad',
      vad_silence_threshold_secs: String(options.silenceThreshold || 2),
      vad_threshold: '0.5',
    });

    const wsUrl = `${ELEVENLABS_STT_URL}?${params}&token=${options.token}`;
    console.log('[ElevenLabs STT] Connecting to WebSocket...');
    console.log('[ElevenLabs STT] URL params:', Object.fromEntries(params));
    websocket = new WebSocket(wsUrl);

    let committed = false;

    websocket.onopen = () => {
      console.log('[ElevenLabs STT] WebSocket connected, starting audio capture...');
      isListening = true;
      startAudioCapture(options);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[ElevenLabs STT] Message:', data.message_type, data);

      switch (data.message_type) {
        case 'session_started':
          console.log('[ElevenLabs STT] Session started successfully');
          break;

        case 'partial_transcript':
          console.log('[ElevenLabs STT] Partial:', data.text);
          options.onTranscript?.({
            partial: data.text,
            committed: null,
            isFinal: false,
          });
          break;

        case 'committed_transcript':
        case 'committed_transcript_with_timestamps':
          console.log('[ElevenLabs STT] Committed:', data.text);
          committed = true;
          options.onTranscript?.({
            partial: null,
            committed: data.text,
            isFinal: true,
          });
          // VAD detected end of speech - stop listening
          stopListening().then(() => {
            options.onEnd?.(data.text);
          });
          break;

        case 'error':
          console.error('[ElevenLabs STT] Server error:', data);
          options.onError?.(data.error || data.message || 'Unknown error');
          break;

        default:
          console.log('[ElevenLabs STT] Unknown message type:', data.message_type);
      }
    };

    websocket.onerror = (error) => {
      console.error('[ElevenLabs STT] WebSocket error:', error);
      options.onError?.('WebSocket connection error');
    };

    websocket.onclose = (event) => {
      console.log('[ElevenLabs STT] WebSocket closed - code:', event.code, 'reason:', event.reason, 'committed:', committed);
      isListening = false;
      cleanupAudio();
      // Only call onEnd if we didn't already commit
      if (!committed) {
        console.log('[ElevenLabs STT] No committed transcript, calling onEnd with empty string');
        options.onEnd?.('');
      }
    };

    return true;
  } catch (error) {
    console.error('[ElevenLabs STT] Setup error:', error);
    options.onError?.(error.message);
    return false;
  }
}

/**
 * Start capturing audio from microphone and sending to WebSocket
 */
function startAudioCapture(options) {
  console.log('[ElevenLabs STT] Starting audio capture...');
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(mediaStream);

  // Use ScriptProcessorNode for audio processing
  // (AudioWorklet would be cleaner but requires more setup)
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  let chunkCount = 0;

  processor.onaudioprocess = (event) => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    const inputData = event.inputBuffer.getChannelData(0);

    // Convert Float32 to Int16 PCM
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Convert to base64
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

    // Send to ElevenLabs
    websocket.send(JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: base64Audio,
    }));

    chunkCount++;
    if (chunkCount === 1) {
      console.log('[ElevenLabs STT] First audio chunk sent');
    } else if (chunkCount % 50 === 0) {
      console.log(`[ElevenLabs STT] Sent ${chunkCount} audio chunks`);
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  console.log('[ElevenLabs STT] Audio capture started');
}

/**
 * Stop listening and clean up resources
 */
export async function stopListening() {
  isListening = false;

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    // Send end of stream signal
    websocket.send(JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: '',
      commit: true,
    }));
    websocket.close();
  }
  websocket = null;

  cleanupAudio();
}

/**
 * Clean up audio resources
 */
function cleanupAudio() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

/**
 * Check if currently listening
 */
export function getIsListening() {
  return isListening;
}
