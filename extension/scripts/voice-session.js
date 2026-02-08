// Voice session controller - orchestrates the voice-driven quiz experience

import { fetchTTS, fetchFeedback, fetchSTTToken } from './api.js';
import { startListening, stopListening, isSupported } from './voice.js';

// Audio context for beep sounds
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a short beep to indicate listening has started
 */
function playBeep() {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pleasant "ding" sound - higher frequency, short duration
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    // Quick fade in/out for smooth sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.log('Could not play beep:', e);
  }
}

// Session states
const State = {
  IDLE: 'idle',
  ASKING_QUESTION: 'asking_question',
  LISTENING_ANSWER: 'listening_answer',
  SUBMITTING: 'submitting',
  READING_FEEDBACK: 'reading_feedback',
  DONE: 'done',
  PAUSED: 'paused',
};

class VoiceSession {
  constructor() {
    this.state = State.IDLE;
    this.stateBeforePause = null;
    this.questions = [];
    this.questionAudios = [];
    this.answers = {};
    this.feedback = {};
    this.currentQuestionIndex = 0;
    this.articleText = '';
    this.audio = null;
    this.onStateChange = null;
    this.onTranscript = null;
  }

  /**
   * Start a voice session
   * @param {Object} params
   * @param {string[]} params.questions - Array of questions
   * @param {string[]} params.questionAudios - Pre-generated question audios (base64)
   * @param {string} params.articleText - Original article text (for feedback API)
   * @param {Function} params.onStateChange - Callback when state changes
   * @param {Function} params.onTranscript - Callback with (transcript, isInterim, questionIndex)
   */
  async start({ questions, questionAudios, articleText, onStateChange, onTranscript }) {
    if (!isSupported()) {
      throw new Error('Microphone access is not supported in this browser');
    }

    // Check microphone permission
    const hasPermission = await this.checkMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Microphone permission required. Please grant permission and try again.');
    }

    this.questions = questions;
    this.questionAudios = questionAudios || [];
    this.articleText = articleText;
    this.answers = {};
    this.feedback = {};
    this.currentQuestionIndex = 0;
    this.onStateChange = onStateChange;
    this.onTranscript = onTranscript;
    this.permissionError = false;  // Track if we hit a permission error

    // Start directly with questions
    await this.askNextQuestion();
  }

  async askNextQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      // All questions answered, submit
      await this.submitAnswers();
      return;
    }

    const question = this.questions[this.currentQuestionIndex];
    const questionNum = this.currentQuestionIndex + 1;
    const totalQuestions = this.questions.length;

    this.setState(State.ASKING_QUESTION, {
      questionNum,
      totalQuestions,
      question,
      questionIndex: this.currentQuestionIndex,
    });

    // Play pre-generated question audio, or generate on the fly
    const questionAudio = this.questionAudios[this.currentQuestionIndex];
    if (questionAudio) {
      await this.playAudio(questionAudio);
    } else {
      // Fallback: generate on the fly
      const questionPrompt = `Question ${questionNum} of ${totalQuestions}. ${question}`;
      await this.speak(questionPrompt);
    }

    // Play beep to indicate listening has started, then listen for the answer
    if (this.state !== State.PAUSED) {
      playBeep();
      await this.listenForAnswer();
    }
  }

  async listenForAnswer() {
    const questionIndex = this.currentQuestionIndex;

    this.setState(State.LISTENING_ANSWER, {
      questionNum: questionIndex + 1,
      question: this.questions[questionIndex],
      questionIndex,
    });

    // Get a fresh STT token for this question
    let token;
    try {
      console.log(`[VoiceSession] Fetching STT token for question ${questionIndex + 1}...`);
      const tokenData = await fetchSTTToken();
      token = tokenData.token;
      console.log(`[VoiceSession] Got STT token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('[VoiceSession] Failed to get STT token:', error);
      // Move to next question with empty answer
      this.answers[this.questions[questionIndex]] = '';
      this.currentQuestionIndex++;
      return this.askNextQuestion();
    }

    return new Promise((resolve) => {
      let currentTranscript = '';

      startListening({
        token,
        silenceThreshold: 2, // 2 seconds of silence = done speaking

        onTranscript: ({ partial, committed, isFinal }) => {
          if (partial) {
            // Show interim results
            this.onTranscript?.(partial, true, questionIndex);
            currentTranscript = partial;
          }
          if (committed) {
            // Final committed transcript
            currentTranscript = committed;
            this.onTranscript?.(committed, false, questionIndex);
          }
        },

        onEnd: (finalTranscript) => {
          // VAD detected end of speech - store answer and move on
          const answer = finalTranscript || currentTranscript;
          this.answers[this.questions[questionIndex]] = answer.trim();

          console.log(`[Q${questionIndex + 1}] Answer: "${answer.trim()}"`);

          // Move to next question
          this.currentQuestionIndex++;
          this.askNextQuestion().then(resolve);
        },

        onError: (error) => {
          console.error('[VoiceSession] STT error:', error);

          // If permission error, stop the entire session
          if (error.includes('Permission') || error.includes('NotAllowed')) {
            console.error('[VoiceSession] Permission error - stopping session');
            this.setState(State.DONE, {
              error: 'Microphone permission denied. Please allow microphone access and try again.',
              answers: this.answers,
              feedback: {},
            });
            resolve();
            return;
          }

          // For other errors, store whatever we have and move on
          this.answers[this.questions[questionIndex]] = currentTranscript.trim();
          this.currentQuestionIndex++;
          this.askNextQuestion().then(resolve);
        },
      });
    });
  }

  async submitAnswers() {
    this.setState(State.SUBMITTING);

    try {
      const data = await fetchFeedback(this.articleText, this.answers);
      this.feedback = data.feedback;
      await this.readFeedback();
    } catch (error) {
      console.error('Failed to get feedback:', error);
      this.setState(State.DONE, {
        error: error.message,
        answers: this.answers,
        feedback: {},
      });
    }
  }

  async readFeedback() {
    this.setState(State.READING_FEEDBACK);

    // Calculate score
    let correct = 0, partial = 0, incorrect = 0;
    Object.values(this.feedback).forEach(fb => {
      const lower = fb.toLowerCase();
      if (lower.includes('correct') && !lower.includes('incorrect')) correct++;
      else if (lower.includes('partial')) partial++;
      else incorrect++;  // Default to incorrect
    });

    const total = correct + partial + incorrect;
    const scoreText = `You got ${correct} out of ${total} questions correct.`;

    // Build feedback narration
    let feedbackNarration = `${scoreText} `;

    if (correct === total) {
      feedbackNarration += 'Excellent work! ';
    } else if (correct >= total / 2) {
      feedbackNarration += 'Good job! ';
    } else {
      feedbackNarration += "Let's review your answers. ";
    }

    // Add individual feedback
    this.questions.forEach((q, i) => {
      const fb = this.feedback[q];
      if (fb) {
        const lines = fb.split('\n');
        const correctness = lines.find(l => l.startsWith('Correctness:'))?.replace('Correctness:', '').trim() || '';
        const explanation = lines.find(l => l.startsWith('Explanation:'))?.replace('Explanation:', '').trim() || '';

        feedbackNarration += `For question ${i + 1}: ${correctness}. ${explanation} `;
      }
    });

    // Generate feedback audio on the fly
    await this.speak(feedbackNarration);

    this.setState(State.DONE, {
      score: { correct, partial, incorrect, total },
      answers: this.answers,
      feedback: this.feedback,
    });
  }

  /**
   * Convert text to speech and play it (fallback for non-pre-generated audio)
   */
  async speak(text) {
    if (this.state === State.PAUSED) return;

    try {
      const { audio: base64Audio } = await fetchTTS(text);
      await this.playAudio(base64Audio);
    } catch (error) {
      console.error('TTS error:', error);
      // Continue without audio
    }
  }

  /**
   * Play base64 encoded audio
   */
  playAudio(base64Audio) {
    return new Promise((resolve) => {
      if (!base64Audio) {
        resolve();
        return;
      }

      const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);

      this.audio = new Audio(audioUrl);

      this.audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.audio = null;
        resolve();
      };

      this.audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        this.audio = null;
        resolve();
      };

      if (this.state !== State.PAUSED) {
        this.audio.play();
      } else {
        resolve();
      }
    });
  }

  base64ToBlob(base64, mimeType) {
    const bytes = atob(base64);
    const buffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      view[i] = bytes.charCodeAt(i);
    }
    return new Blob([buffer], { type: mimeType });
  }

  pause() {
    if (this.state === State.PAUSED) return;

    this.stateBeforePause = this.state;
    this.setState(State.PAUSED, { questionIndex: this.currentQuestionIndex });

    if (this.audio) {
      this.audio.pause();
    }
    stopListening();
  }

  resume() {
    if (this.state !== State.PAUSED) return;

    const previousState = this.stateBeforePause;
    this.setState(previousState, { questionIndex: this.currentQuestionIndex });

    if (this.audio) {
      this.audio.play();
    }

    // Resume the appropriate activity based on previous state
    if (previousState === State.LISTENING_ANSWER) {
      this.listenForAnswer();
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    stopListening();
    this.setState(State.IDLE);
  }

  setState(newState, data = {}) {
    this.state = newState;
    this.onStateChange?.(newState, data);
  }

  getState() {
    return this.state;
  }

  getAnswers() {
    return this.answers;
  }

  getFeedback() {
    return this.feedback;
  }

  /**
   * Check if microphone permission is granted.
   * If not, opens a permission page in a new tab.
   */
  async checkMicrophonePermission() {
    // First, try to check permission status via Permissions API
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      console.log('[VoiceSession] Microphone permission status:', result.state);

      if (result.state === 'granted') {
        return true;
      }

      if (result.state === 'denied') {
        console.log('[VoiceSession] Permission denied - user must manually allow');
        return false;
      }

      // State is 'prompt' - need to request permission
      // Open permission page in a new tab (side panel permission prompts don't work)
      console.log('[VoiceSession] Opening permission page...');
      const permissionUrl = chrome.runtime.getURL('permission.html');
      window.open(permissionUrl, '_blank', 'width=400,height=400');

      // Wait for permission to be granted
      return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const newResult = await navigator.permissions.query({ name: 'microphone' });
          if (newResult.state === 'granted') {
            clearInterval(checkInterval);
            console.log('[VoiceSession] Permission granted!');
            resolve(true);
          } else if (newResult.state === 'denied') {
            clearInterval(checkInterval);
            console.log('[VoiceSession] Permission denied');
            resolve(false);
          }
        }, 500);

        // Timeout after 60 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 60000);
      });
    } catch (error) {
      console.error('[VoiceSession] Permission check error:', error);
      // Permissions API not supported, try direct request
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (e) {
        return false;
      }
    }
  }
}

// Export a singleton instance
export const voiceSession = new VoiceSession();
export { State };
