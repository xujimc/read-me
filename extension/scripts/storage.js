// Storage utility for quiz data (uses chrome.storage.local)
// Keeps quiz data separate from article list (which uses sync)

const QUIZ_DATA_KEY = 'quizData';

export async function getQuizData(url) {
  const { quizData = {} } = await chrome.storage.local.get(QUIZ_DATA_KEY);
  return quizData[url] || { questions: [], answers: {}, feedback: {} };
}

export async function saveQuizData(url, data) {
  const { quizData = {} } = await chrome.storage.local.get(QUIZ_DATA_KEY);
  quizData[url] = { ...quizData[url], ...data };
  await chrome.storage.local.set({ [QUIZ_DATA_KEY]: quizData });
}

export async function clearQuizData() {
  await chrome.storage.local.remove(QUIZ_DATA_KEY);
}
