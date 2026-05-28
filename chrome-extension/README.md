Chrome Extension
================

This folder contains a Manifest V3 extension that fetches YouTube comments via the backend API and sends them to the local sentiment API at `http://127.0.0.1:8000/predict`.

Load it in Chrome
-----------------

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this `chrome-extension/` folder.

Usage
-----

1. Start the FastAPI app from the repo root.
2. Open a YouTube video page with comments loaded.
3. Click the extension icon.
4. Click Scan current tab, then Analyze pasted comments.

You can also paste comments manually into the popup if you want to test without a live YouTube page.
