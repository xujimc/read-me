import { fetchQuestions, fetchFeedback } from '../api.js';
import { getQuizData, saveQuizData } from '../storage.js';

const debugHtml = `<div class="debug-btn" id="debug-clear">clear storage</div>`;

// In-memory cache (synced with chrome.storage.local)
const stateByUrl = new Map();

// Track loading state per URL (not persisted, just in-memory)
const loadingByUrl = new Map();

async function getState(url) {
  if (!stateByUrl.has(url)) {
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

  const url = tab.url;
  const state = await getState(url);

  // If already loading, show appropriate UI
  if (loadingByUrl.has(url)) {
    const loadingStatus = loadingByUrl.get(url);

    // If evaluating and we have questions, show quiz with disabled submit
    if (loadingStatus.includes('Evaluating') && state.questions.length > 0) {
      renderQuestions(contentEl, url, state);
      const submitBtn = document.getElementById('submit-answers');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Evaluating...';
      }
      return;
    }

    // Otherwise show spinner
    contentEl.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">${loadingStatus}</div>
      </div>
    ` + debugHtml;
    return;
  }

  // Show loading spinner
  contentEl.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">Preparing your quiz...</div>
    </div>
  ` + debugHtml;

  await loadQuiz(contentEl, tab);
}

async function loadQuiz(contentEl, tab) {
  const url = tab.url;
  const state = await getState(url);

  // If we already have questions, render them
  if (state.questions.length > 0) {
    if (Object.keys(state.feedback).length > 0) {
      renderCompletedQuiz(contentEl, url, state);
    } else {
      renderQuestions(contentEl, url, state);
    }
    return;
  }

  // Set loading state
  loadingByUrl.set(url, 'Reading article...');
  updateLoadingText(contentEl, 'Reading article...');

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
        loadingByUrl.delete(url);
        showError(contentEl, 'Please refresh the page and try again.');
        return;
      }
    }
  }
  state.articleText = response.text;

  if (!state.articleText || state.articleText.length < 100) {
    loadingByUrl.delete(url);
    showError(contentEl, 'Could not extract article text. Try refreshing the page.');
    return;
  }

  // Generate questions
  loadingByUrl.set(url, 'Generating questions...');
  updateLoadingText(contentEl, 'Generating questions...');

  try {
    const data = await fetchQuestions(state.articleText);
    state.questions = data.questions || [];
  } catch (error) {
    loadingByUrl.delete(url);
    showError(contentEl, error.message);
    return;
  }

  if (state.questions.length === 0) {
    loadingByUrl.delete(url);
    showError(contentEl, 'No questions generated. Try again later.');
    return;
  }

  loadingByUrl.delete(url);
  await persistState(url);
  renderQuestions(contentEl, url, state);
}

function updateLoadingText(contentEl, text) {
  const loadingText = contentEl.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = text;
}

function showError(contentEl, message) {
  contentEl.innerHTML = `
    <div class="quiz-container">
      <div class="error-message">${escapeHtml(message)}</div>
    </div>
  ` + debugHtml;
}

function renderQuestions(contentEl, url, state) {
  const answeredCount = Object.keys(state.answers).filter(q => state.answers[q]).length;
  const totalCount = state.questions.length;
  const progressPercent = (answeredCount / totalCount) * 100;

  const questionsHtml = state.questions.map((q, i) => `
    <div class="question-item" data-index="${i}">
      <div class="question-number">Question ${i + 1} of ${totalCount}</div>
      <div class="question-text">${escapeHtml(q)}</div>
      <div class="answer-wrapper">
        <textarea
          class="answer-input"
          data-question="${escapeHtml(q)}"
          data-index="${i}"
          placeholder="Type your answer..."
        >${escapeHtml(state.answers[q] || '')}</textarea>
        <span class="char-count" id="char-count-${i}">${(state.answers[q] || '').length} chars</span>
      </div>
      <div class="feedback-slot" id="feedback-${i}"></div>
    </div>
  `).join('');

  contentEl.innerHTML = `
    <div class="quiz-container" data-url="${escapeHtml(url)}">
      <div class="quiz-header">
        <div class="quiz-title">Comprehension Quiz</div>
        <div class="quiz-subtitle">Test your understanding of this article</div>
      </div>
      <div class="progress-container">
        <div class="progress-text">
          <span>${answeredCount} of ${totalCount} answered</span>
          <span>${Math.round(progressPercent)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
      <div class="questions-list">
        ${questionsHtml}
      </div>
      <button class="submit-btn" id="submit-answers">Submit Answers</button>
    </div>
  ` + debugHtml;

  // Update progress and char count as user types
  document.querySelectorAll('.answer-input').forEach(input => {
    input.addEventListener('input', () => {
      updateProgress(state);
      // Update char count
      const index = input.dataset.index;
      const charCount = document.getElementById(`char-count-${index}`);
      if (charCount) {
        charCount.textContent = `${input.value.length} chars`;
      }
    });
  });

  document.getElementById('submit-answers').addEventListener('click', () => submitAnswers(contentEl, url));
}

function updateProgress(state) {
  const inputs = document.querySelectorAll('.answer-input');
  let answered = 0;
  inputs.forEach(input => {
    if (input.value.trim()) answered++;
  });

  const total = inputs.length;
  const percent = (answered / total) * 100;

  const progressText = document.querySelector('.progress-text span:first-child');
  const progressFill = document.querySelector('.progress-fill');
  const progressPercent = document.querySelector('.progress-text span:last-child');

  if (progressText) progressText.textContent = `${answered} of ${total} answered`;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
}

function renderCompletedQuiz(contentEl, url, state) {
  // Calculate score
  let correct = 0, partial = 0, incorrect = 0;
  Object.values(state.feedback).forEach(fb => {
    const { correctness } = parseFeedback(fb);
    if (correctness.toLowerCase().includes('incorrect')) incorrect++;
    else if (correctness.toLowerCase().includes('partial')) partial++;
    else correct++;
  });
  const total = correct + partial + incorrect;
  const scoreText = `${correct}/${total}`;

  const questionsHtml = state.questions.map((q, i) => {
    const answer = state.answers[q] || '';
    const feedback = state.feedback[q];
    const { correctness, explanation, improvement } = feedback ? parseFeedback(feedback) : {};

    const statusClass = correctness?.toLowerCase().includes('incorrect') ? 'incorrect'
      : correctness?.toLowerCase().includes('partial') ? 'partial'
      : 'correct';

    const icon = statusClass === 'correct' ? '✓' : statusClass === 'partial' ? '~' : '✗';

    return `
      <div class="question-item">
        <div class="question-number">Question ${i + 1}</div>
        <div class="question-text">${escapeHtml(q)}</div>
        <div class="answer-display">${escapeHtml(answer) || '<em>No answer</em>'}</div>
        ${feedback ? `
          <div class="feedback-inline ${statusClass}">
            <div class="feedback-status">
              <span>${icon}</span>
              ${escapeHtml(correctness)}
            </div>
            <div class="feedback-explanation">${escapeHtml(explanation)}</div>
            ${improvement ? `<div class="feedback-improvement">${escapeHtml(improvement)}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  contentEl.innerHTML = `
    <div class="quiz-container" data-url="${escapeHtml(url)}">
      <div class="score-card">
        <div class="score-title">Your Score</div>
        <div class="score-value">${scoreText}</div>
        <div class="score-subtitle">${correct} correct, ${partial} partial, ${incorrect} incorrect</div>
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

async function submitAnswers(contentEl, url) {
  const state = await getState(url);
  const submitBtn = document.getElementById('submit-answers');

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
    // Highlight empty inputs briefly
    document.querySelectorAll('.answer-input').forEach(input => {
      if (!input.value.trim()) {
        input.style.borderColor = '#ea4335';
        setTimeout(() => input.style.borderColor = '', 2000);
      }
    });
    return;
  }

  await persistState(url);

  // Show loading state
  loadingByUrl.set(url, 'Evaluating your answers...');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Evaluating...';

  try {
    const data = await fetchFeedback(state.articleText, answers);
    state.feedback = data.feedback;
    loadingByUrl.delete(url);
    await persistState(url);

    // Render completed view with inline feedback
    renderCompletedQuiz(contentEl, url, state);
  } catch (error) {
    console.error('Feedback error:', error);
    loadingByUrl.delete(url);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answers';

    // Show error inline
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.marginTop = '16px';
    errorDiv.textContent = error.message;
    submitBtn.parentNode.appendChild(errorDiv);
  }
}

function parseFeedback(result) {
  if (!result) return { correctness: '', explanation: '', improvement: '' };

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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
