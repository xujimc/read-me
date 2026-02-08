// Server API communication utility

const SERVER_URL = 'http://localhost:8000';

export async function fetchModel() {
  try {
    const response = await fetch(`${SERVER_URL}/model`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.model;
  } catch {
    return null;
  }
}

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

export async function fetchNarration(articleText) {
  const response = await fetch(`${SERVER_URL}/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_text: articleText }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}
