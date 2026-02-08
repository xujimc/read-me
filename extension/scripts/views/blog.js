import { fetchQuestions, fetchFeedback } from '../api.js';
import { getQuizData, saveQuizData } from '../storage.js';

const debugHtml = `<div class="debug-btn" id="debug-clear">clear storage</div>`;

// In-memory cache (synced with chrome.storage.local)
const stateByUrl = new Map();

async function getState(url) {
  if (!stateByUrl.has(url)) {
    // Load from persistent storage
    const stored = await getQuizData(url);
    stateByUrl.set(url, {
      articleText: stored.articleText || '',
      questions: stored.questions || [],
      answers: stored.answers || {},
      feedback: stored.feedback || {},
    });
  }
  return stateByUrl.get(url);
}

async function persistState(url) {
  const state = stateByUrl.get(url);
  if (state) {
    await saveQuizData(url, state);
  }
}

export async function renderBlogView(contentEl, headerEl, tab, isTracked) {
  headerEl.textContent = 'Article View';
  contentEl.className = 'blog-view';

  if (!isTracked) {
    contentEl.innerHTML = `
      <div class="blog-title">${tab.title || 'Untitled'}</div>
      <div class="summary-card not-tracked">
        <div class="summary-label">Not Tracked</div>
        <div class="summary-text">This article is not in your feed. It may be older or from a different category.</div>
      </div>
    ` + debugHtml;
    return;
  }

  // Show loading state
  contentEl.innerHTML = `
    <div class="blog-title">${tab.title || 'Loading...'}</div>
    <div class="summary-card">
      <div class="summary-label">Quiz</div>
      <div class="summary-text" id="quiz-status">Loading...</div>
    </div>
  ` + debugHtml;

  // Start the quiz flow
  await loadQuiz(contentEl, tab);
}

async function loadQuiz(contentEl, tab) {
  const statusEl = document.getElementById('quiz-status');
  const url = tab.url;
  const state = await getState(url);

  // If we already have questions (from storage or memory), render them
  if (state.questions.length > 0) {
    // If we have feedback, show completed state
    if (Object.keys(state.feedback).length > 0) {
      renderQuestionsWithFeedback(contentEl, url, state);
    } else {
      renderQuestions(contentEl, url, state);
    }
    return;
  }

  // Step 1: Get article text from content script (with retry)
  statusEl.textContent = 'Extracting article text...';
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let response;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_ARTICLE_TEXT' });
      break;
    } catch (e) {
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, 500));
      } else {
        statusEl.textContent = 'Please refresh the page and try again.';
        return;
      }
    }
  }
  state.articleText = response.text;

  if (!state.articleText || state.articleText.length < 100) {
    statusEl.textContent = 'Could not extract article text. Try refreshing the page.';
    return;
  }

  // Step 2: Send to server and get questions
  statusEl.textContent = 'Generating questions...';
  try {
    const data = await fetchQuestions(state.articleText);
    state.questions = data.questions || [];
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    return;
  }

  if (state.questions.length === 0) {
    statusEl.textContent = 'No questions generated. Try again later.';
    return;
  }

  // Save questions to persistent storage
  await persistState(url);

  // Step 3: Render questions UI
  renderQuestions(contentEl, url, state);
}

function renderQuestions(contentEl, url, state) {
  const questionsHtml = state.questions.map((q, i) => `
    <div class="question-item">
      <div class="question-number">Question ${i + 1}</div>
      <div class="question-text">${escapeHtml(q)}</div>
      <textarea class="answer-input" data-question="${escapeHtml(q)}" placeholder="Type your answer...">${escapeHtml(state.answers[q] || '')}</textarea>
    </div>
  `).join('');

  contentEl.innerHTML = `
    <div class="quiz-container" data-url="${escapeHtml(url)}">
      <div class="quiz-header">
        <div class="quiz-title">Comprehension Quiz</div>
        <div class="quiz-subtitle">${state.questions.length} questions based on this article</div>
      </div>
      <div class="questions-list">
        ${questionsHtml}
      </div>
      <button class="submit-btn" id="submit-answers">Submit Answers</button>
      <div id="feedback-container"></div>
    </div>
  ` + debugHtml;

  document.getElementById('submit-answers').addEventListener('click', () => submitAnswers(url));
}

function renderQuestionsWithFeedback(contentEl, url, state) {
  const questionsHtml = state.questions.map((q, i) => {
    const answer = state.answers[q] || '';
    const feedback = state.feedback[q];

    let feedbackHtml = '';
    if (feedback) {
      const { correctness, explanation, improvement } = parseFeedback(feedback);
      const statusClass = correctness.toLowerCase().includes('incorrect') ? 'incorrect'
        : correctness.toLowerCase().includes('partial') ? 'partial'
        : 'correct';

      feedbackHtml = `
        <div class="feedback-inline ${statusClass}">
          <div class="feedback-status">${escapeHtml(correctness)}</div>
          <div class="feedback-explanation">${escapeHtml(explanation)}</div>
          ${improvement ? `<div class="feedback-improvement"><strong>Tip:</strong> ${escapeHtml(improvement)}</div>` : ''}
        </div>
      `;
    }

    return `
      <div class="question-item">
        <div class="question-number">Question ${i + 1}</div>
        <div class="question-text">${escapeHtml(q)}</div>
        <div class="answer-display">${escapeHtml(answer) || '<em>No answer provided</em>'}</div>
        ${feedbackHtml}
      </div>
    `;
  }).join('');

  contentEl.innerHTML = `
    <div class="quiz-container" data-url="${escapeHtml(url)}">
      <div class="quiz-header">
        <div class="quiz-title">Quiz Completed</div>
        <div class="quiz-subtitle">Your answers and feedback</div>
      </div>
      <div class="questions-list">
        ${questionsHtml}
      </div>
      <button class="submit-btn" id="retake-quiz">Retake Quiz</button>
    </div>
  ` + debugHtml;

  document.getElementById('retake-quiz').addEventListener('click', async () => {
    state.answers = {};
    state.feedback = {};
    await persistState(url);
    renderQuestions(contentEl, url, state);
  });
}

async function submitAnswers(url) {
  const state = await getState(url);
  const submitBtn = document.getElementById('submit-answers');
  const feedbackContainer = document.getElementById('feedback-container');

  // Collect answers
  const answers = {};
  document.querySelectorAll('.answer-input').forEach(input => {
    const question = input.dataset.question;
    const answer = input.value.trim();
    if (answer) {
      answers[question] = answer;
      state.answers[question] = answer;
    }
  });

  if (Object.keys(answers).length === 0) {
    feedbackContainer.innerHTML = `<div class="error-message">Please answer at least one question.</div>`;
    return;
  }

  // Save answers immediately
  await persistState(url);

  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Evaluating...';
  feedbackContainer.innerHTML = `<div class="loading-message">Analyzing your answers...</div>`;

  try {
    const data = await fetchFeedback(state.articleText, answers);

    // Store feedback in state
    state.feedback = data.feedback;
    await persistState(url);

    renderFeedback(data.feedback, feedbackContainer);
    submitBtn.textContent = 'Submitted';
  } catch (error) {
    console.error('Feedback error:', error);
    feedbackContainer.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answers';
  }
}

function parseFeedback(result) {
  const lines = result.split('\n');
  let correctness = '';
  let explanation = '';
  let improvement = '';

  lines.forEach(line => {
    if (line.startsWith('Correctness:')) {
      correctness = line.replace('Correctness:', '').trim();
    } else if (line.startsWith('Explanation:')) {
      explanation = line.replace('Explanation:', '').trim();
    } else if (line.startsWith('Improvement:')) {
      improvement = line.replace('Improvement:', '').trim();
    }
  });

  return { correctness, explanation, improvement };
}

function renderFeedback(feedback, container) {
  const feedbackHtml = Object.entries(feedback).map(([question, result]) => {
    const { correctness, explanation, improvement } = parseFeedback(result);
    const statusClass = correctness.toLowerCase().includes('incorrect') ? 'incorrect'
      : correctness.toLowerCase().includes('partial') ? 'partial'
      : 'correct';

    return `
      <div class="feedback-item ${statusClass}">
        <div class="feedback-question">${escapeHtml(question)}</div>
        <div class="feedback-status">${escapeHtml(correctness)}</div>
        <div class="feedback-explanation">${escapeHtml(explanation)}</div>
        ${improvement ? `<div class="feedback-improvement"><strong>Tip:</strong> ${escapeHtml(improvement)}</div>` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="feedback-header">Your Results</div>
    ${feedbackHtml}
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
