const defaultEndpoint = 'http://127.0.0.1:5000/predict';

const endpointInput = document.getElementById('endpoint');
const commentsInput = document.getElementById('comments');
const analyzeButton = document.getElementById('analyze');
const clearButton = document.getElementById('clear');
const statusNode = document.getElementById('status');
const resultsNode = document.getElementById('results');
const positiveCountNode = document.getElementById('positive-count');
const neutralCountNode = document.getElementById('neutral-count');
const negativeCountNode = document.getElementById('negative-count');

const sentimentLabels = {
  '1': 'Positive',
  '0': 'Neutral',
  '-1': 'Negative',
};

const sentimentClass = {
  '1': 'positive',
  '0': 'neutral',
  '-1': 'negative',
};

endpointInput.value = localStorage.getItem('yt-sentiment-endpoint') || defaultEndpoint;

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    commentsInput.value = chip.dataset.sample;
    commentsInput.focus();
  });
});

clearButton.addEventListener('click', () => {
  commentsInput.value = '';
  resultsNode.className = 'results empty';
  resultsNode.innerHTML = '<p>Run an analysis to see each comment classified here.</p>';
  updateCounts(0, 0, 0);
  setStatus('Waiting for input', 'idle');
});

analyzeButton.addEventListener('click', analyzeComments);
endpointInput.addEventListener('change', () => {
  localStorage.setItem('yt-sentiment-endpoint', endpointInput.value.trim());
});

function setStatus(message, state) {
  statusNode.textContent = message;
  statusNode.className = `status ${state}`;
}

function updateCounts(positive, neutral, negative) {
  positiveCountNode.textContent = positive;
  neutralCountNode.textContent = neutral;
  negativeCountNode.textContent = negative;
}

function splitComments(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return trimmed
    .split(/\r?\n+/)
    .map((comment) => comment.trim())
    .filter(Boolean);
}

async function analyzeComments() {
  const comments = splitComments(commentsInput.value);

  if (!comments.length) {
    setStatus('Add at least one comment first', 'error');
    return;
  }

  const endpoint = endpointInput.value.trim();
  setStatus('Analyzing comments...', 'loading');
  analyzeButton.disabled = true;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comments }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || `Request failed with status ${response.status}`);
    }

    renderResults(payload);
    localStorage.setItem('yt-sentiment-endpoint', endpoint);
    setStatus(`Analyzed ${payload.length} comments`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    resultsNode.className = 'results empty';
    resultsNode.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    updateCounts(0, 0, 0);
  } finally {
    analyzeButton.disabled = false;
  }
}

function renderResults(items) {
  const counts = { '1': 0, '0': 0, '-1': 0 };

  const cards = items.map((item) => {
    counts[item.sentiment] = (counts[item.sentiment] || 0) + 1;
    const label = sentimentLabels[item.sentiment] || item.sentiment;
    const tone = sentimentClass[item.sentiment] || 'neutral';

    return `
      <article class="result-item">
        <div class="result-top">
          <span class="sentiment-badge ${tone}">${label}</span>
          <span class="index">${item.sentiment}</span>
        </div>
        <p>${escapeHtml(item.comment)}</p>
      </article>
    `;
  });

  updateCounts(counts['1'], counts['0'], counts['-1']);
  resultsNode.className = 'results';
  resultsNode.innerHTML = cards.join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
