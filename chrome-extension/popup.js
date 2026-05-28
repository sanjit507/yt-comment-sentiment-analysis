const tabStateNode = document.getElementById('tab-state');
const statusNode = document.getElementById('status');
const openMoreButton = document.getElementById('open-more');
const openMoreButtonSecondary = document.getElementById('open-more-2');
const scanButton = document.getElementById('scan');
const lastScanCountNode = document.getElementById('last-scan-count');
const lastScanSourceNode = document.getElementById('last-scan-source');
const statusStateNode = document.getElementById('status-state');
const previewListNode = document.getElementById('preview-list');
const previewMetaNode = document.getElementById('preview-meta');

function isYouTubeVideoUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '');
    const pathname = parsedUrl.pathname;

    return (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be'
    ) && (
      pathname.startsWith('/watch') ||
      pathname.startsWith('/shorts/') ||
      pathname.startsWith('/live/') ||
      host === 'youtu.be'
    );
  } catch {
    return false;
  }
}

function setStatus(message, state) {
  statusNode.textContent = message;
  statusNode.className = `status ${state}`;
  statusStateNode.textContent = message;
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
  const previewComments = comments.slice(0, 3);

  if (!previewComments.length) {
    previewMetaNode.textContent = 'No scan yet';
    previewListNode.className = 'preview-list empty';
    previewListNode.innerHTML = '<p>Scan a YouTube video to see the first comments here.</p>';
    return;
  }

  previewMetaNode.textContent = `${comments.length} comments captured`;
  previewListNode.className = 'preview-list';
  previewListNode.innerHTML = previewComments
    .map((comment) => `<div class="preview-item">${escapeHtml(comment)}</div>`)
    .join('');
}

function formatTabState(url) {
  if (!url) {
    return 'Unable to read active tab';
  }

  if (isYouTubeVideoUrl(url)) {
    return 'YouTube video detected';
  }

  return 'Open a YouTube video page to scan comments';
}

async function updateTabState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabStateNode.textContent = formatTabState(tab?.url || '');
  } catch {
    tabStateNode.textContent = 'Open a YouTube video page to scan comments';
  }
}

async function openMore() {
  chrome.tabs.create({ url: chrome.runtime.getURL('more.html') });
}

async function scanCurrentTab() {
  setStatus('Checking current tab...', 'loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    if (!isYouTubeVideoUrl(tab.url || '')) {
      throw new Error('Please open a YouTube video page and try again.');
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract_comments' });
    const comments = response?.comments || [];

    if (!comments.length) {
      throw new Error('No visible comments found on this tab');
    }

    chrome.storage.local.set({
      'yt-last-comments': comments,
      'yt-last-scan-count': comments.length,
      'yt-last-scan-source': tab.url || 'YouTube',
    });

    lastScanCountNode.textContent = String(comments.length);
    lastScanSourceNode.textContent = 'YouTube';
    renderPreview(comments);
    setStatus(`Captured ${comments.length} comments. Open More to analyze.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

openMoreButton.addEventListener('click', openMore);
openMoreButtonSecondary.addEventListener('click', openMore);
scanButton.addEventListener('click', scanCurrentTab);

chrome.storage.local.get(['yt-last-scan-count', 'yt-last-scan-source'], (result) => {
  lastScanCountNode.textContent = String(result['yt-last-scan-count'] || 0);
  lastScanSourceNode.textContent = result['yt-last-scan-source'] ? 'YouTube' : '-';
  statusStateNode.textContent = 'Ready';
});

chrome.storage.local.get(['yt-last-comments'], (result) => {
  renderPreview(Array.isArray(result['yt-last-comments']) ? result['yt-last-comments'] : []);
});

updateTabState();
