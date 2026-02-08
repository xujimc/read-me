import { fetchQuestions, fetchFeedback } from '../api.js';

const debugHtml = `<div class="debug-btn" id="debug-clear">clear storage</div>`;

// State per URL
const stateByUrl = new Map();

function getState(url) {
  if (!stateByUrl.has(url)) {
    stateByUrl.set(url, { articleText: '', questions: [], answers: {} });
  }
  return stateByUrl.get(url);
}

export function renderBlogView(contentEl, headerEl, tab, isTracked) {
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
      <div class="summary-text" id="quiz-status">Loading article content...</div>
    </div>
  ` + debugHtml;

  // Start the quiz flow
  loadQuiz(contentEl, tab);
}

async function loadQuiz(contentEl, tab) {
  const statusEl = document.getElementById('quiz-status');
  const url = tab.url;
  const state = getState(url);

  // If we already have questions for this URL, render them
  if (state.questions.length > 0) {
    renderQuestions(contentEl, url);
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
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
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
  const data = await fetchQuestions(state.articleText);
  state.questions = data.questions || [];

  if (state.questions.length === 0) {
    statusEl.textContent = 'No questions generated. Try again later.';
    return;
  }

  // Step 3: Render questions UI
  renderQuestions(contentEl, url);
}

function renderQuestions(contentEl, url) {
  const state = getState(url);
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

  // Add submit handler
  document.getElementById('submit-answers').addEventListener('click', () => submitAnswers(url));
}

async function submitAnswers(url) {
  const state = getState(url);
  const submitBtn = document.getElementById('submit-answers');
  const feedbackContainer = document.getElementById('feedback-container');

  // Collect answers and save to state
  const answers = {};
  document.querySelectorAll('.answer-input').forEach(input => {
    const question = input.dataset.question;
    const answer = input.value.trim();
    if (answer) {
      answers[question] = answer;
      state.answers[question] = answer; // Persist for tab switching
    }
  });

  if (Object.keys(answers).length === 0) {
    feedbackContainer.innerHTML = `<div class="error-message">Please answer at least one question.</div>`;
    return;
  }

  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Evaluating...';
  feedbackContainer.innerHTML = `<div class="loading-message">Analyzing your answers...</div>`;

  try {
    const data = await fetchFeedback(state.articleText, answers);
    renderFeedback(data.feedback, feedbackContainer);
    submitBtn.textContent = 'Submitted';
  } catch (error) {
    console.error('Feedback error:', error);
    feedbackContainer.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answers';
  }
}

function renderFeedback(feedback, container) {
  const feedbackHtml = Object.entries(feedback).map(([question, result]) => {
    // Parse the feedback result
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
