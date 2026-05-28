const endpointInput = document.getElementById('more-endpoint');
const saveButton = document.getElementById('save-settings');
const resetButton = document.getElementById('reset-settings');
const saveStatus = document.getElementById('save-status');
const commentsEndpointInput = document.getElementById('comments-endpoint');
const commentsInput = document.getElementById('more-comments');
const analyzeButton = document.getElementById('analyze-comments');
const loadLastButton = document.getElementById('load-last');
const clearButton = document.getElementById('clear-comments');
const resultsNode = document.getElementById('results');
const previewNode = document.getElementById('preview');
const positiveNode = document.getElementById('positive');
const neutralNode = document.getElementById('neutral');
const negativeNode = document.getElementById('negative');
const statusNode = document.getElementById('status');

const defaultEndpoint = 'http://127.0.0.1:8000/predict';
const defaultCommentsEndpoint = 'http://127.0.0.1:8000/youtube/comments';

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

function setStatus(message, state) {
  statusNode.textContent = message;
  statusNode.className = `status ${state}`;
}

function updateCounts(positive, neutral, negative) {
  positiveNode.textContent = positive;
  neutralNode.textContent = neutral;
  negativeNode.textContent = negative;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPreview(comments) {
  if (!comments.length) {
    previewNode.className = 'preview empty';
    previewNode.innerHTML = '<p>No comments loaded yet.</p>';
    return;
  }

  previewNode.className = 'preview';
  previewNode.innerHTML = comments
    .map((comment) => `<div class="preview-item">${escapeHtml(comment)}</div>`)
    .join('');
}

function renderResults(items) {
  const counts = { '1': 0, '0': 0, '-1': 0 };

  resultsNode.className = 'results';
  resultsNode.innerHTML = items.map((item) => {
    counts[item.sentiment] = (counts[item.sentiment] || 0) + 1;
    const tone = sentimentClass[item.sentiment] || 'neutral';
    const label = sentimentLabels[item.sentiment] || item.sentiment;

    return `
      <article class="result-item">
        <div class="result-top">
          <span class="sentiment-badge ${tone}">${label}</span>
          <span class="index">${item.sentiment}</span>
        </div>
        <p>${escapeHtml(item.comment)}</p>
      </article>
    `;
  }).join('');

  updateCounts(counts['1'], counts['0'], counts['-1']);
}

chrome.storage.local.get(['yt-sentiment-endpoint', 'yt-comments-endpoint'], (result) => {
  endpointInput.value = result['yt-sentiment-endpoint'] || defaultEndpoint;
  commentsEndpointInput.value = result['yt-comments-endpoint'] || defaultCommentsEndpoint;
});

chrome.storage.local.get(['yt-last-comments'], (result) => {
  const comments = Array.isArray(result['yt-last-comments']) ? result['yt-last-comments'] : [];
  if (comments.length) {
    commentsInput.value = comments.join('\n');
  }
  renderPreview(comments);
});

saveButton.addEventListener('click', () => {
  const endpoint = endpointInput.value.trim() || defaultEndpoint;
  const commentsEndpoint = commentsEndpointInput.value.trim() || defaultCommentsEndpoint;
  chrome.storage.local.set({
    'yt-sentiment-endpoint': endpoint,
    'yt-comments-endpoint': commentsEndpoint,
  }, () => {
    saveStatus.textContent = 'Settings saved locally in the browser.';
  });
});

resetButton.addEventListener('click', () => {
  endpointInput.value = defaultEndpoint;
  commentsEndpointInput.value = defaultCommentsEndpoint;
  chrome.storage.local.set({
    'yt-sentiment-endpoint': defaultEndpoint,
    'yt-comments-endpoint': defaultCommentsEndpoint,
  }, () => {
    saveStatus.textContent = 'Settings reset to the local API.';
  });
});

loadLastButton.addEventListener('click', () => {
  chrome.storage.local.get(['yt-last-comments'], (result) => {
    const comments = Array.isArray(result['yt-last-comments']) ? result['yt-last-comments'] : [];
    commentsInput.value = comments.join('\n');
    renderPreview(comments);
    setStatus(comments.length ? `Loaded ${comments.length} scanned comments` : 'No scanned comments found yet', comments.length ? 'success' : 'error');
  });
});

clearButton.addEventListener('click', () => {
  commentsInput.value = '';
  resultsNode.className = 'results empty';
  resultsNode.innerHTML = '<p>No results yet.</p>';
  renderPreview([]);
  updateCounts(0, 0, 0);
  setStatus('Cleared comments', 'idle');
});

analyzeButton.addEventListener('click', async () => {
  const comments = splitComments(commentsInput.value);

  if (!comments.length) {
    setStatus('Add or load comments first', 'error');
    return;
  }

  analyzeButton.disabled = true;
  setStatus('Analyzing comments...', 'loading');

  try {
    const response = await fetch(endpointInput.value.trim() || defaultEndpoint, {
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
    renderPreview(comments);
    setStatus(`Analyzed ${payload.length} comments`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    resultsNode.className = 'results empty';
    resultsNode.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    updateCounts(0, 0, 0);
  } finally {
    analyzeButton.disabled = false;
  }
});
