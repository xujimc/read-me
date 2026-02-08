// Server API communication utility

const SERVER_URL = 'http://localhost:8000';

export async function fetchQuestions(articleText) {
  const response = await fetch(`${SERVER_URL}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_text: articleText }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}

export async function fetchFeedback(articleText, answers) {
  const response = await fetch(`${SERVER_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_text: articleText, answers }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}
