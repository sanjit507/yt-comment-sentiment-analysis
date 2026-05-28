const COMMENT_SELECTOR = '#content-text';
const MAX_SCROLL_STEPS = 40;
const STABLE_ROUNDS_LIMIT = 4;
const SCROLL_DELAY_MS = 900;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeComment(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectComments() {
  const comments = Array.from(document.querySelectorAll(COMMENT_SELECTOR))
    .map((element) => normalizeComment(element.textContent))
    .filter(Boolean);

  return Array.from(new Set(comments));
}

function getCommentAnchor() {
  return document.querySelector('ytd-comments#comments') || document.querySelector('#comments');
}

async function progressivelyLoadComments() {
  const seen = new Set();
  let stableRounds = 0;

  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    collectComments().forEach((comment) => seen.add(comment));

    const beforeCount = seen.size;
    const anchor = getCommentAnchor();

    if (anchor) {
      anchor.scrollIntoView({ block: 'end', behavior: 'instant' });
      anchor.scrollTop = anchor.scrollHeight;
    }

    window.scrollBy(0, Math.max(window.innerHeight * 0.85, 800));
    await wait(SCROLL_DELAY_MS);

    collectComments().forEach((comment) => seen.add(comment));

    if (seen.size === beforeCount) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }

    if (stableRounds >= STABLE_ROUNDS_LIMIT) {
      break;
    }
  }

  collectComments().forEach((comment) => seen.add(comment));
  return Array.from(seen);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== 'extract_comments') {
    return;
  }

  (async () => {
    try {
      const comments = await progressivelyLoadComments();
      sendResponse({ comments });
    } catch (error) {
      sendResponse({ comments: [], error: error.message || 'Failed to extract comments' });
    }
  })();

  return true;
});
