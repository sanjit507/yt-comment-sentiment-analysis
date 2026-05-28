Chrome Extension
================

This folder contains a Manifest V3 extension that scans visible YouTube comments and sends them to the local Flask API at `http://127.0.0.1:5000/predict`.

Load it in Chrome
-----------------

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this `chrome-extension/` folder.

Usage
-----

1. Start the Flask app from the repo root.
2. Open a YouTube video page with comments loaded.
3. Click the extension icon.
4. Click Scan current tab, then Analyze pasted comments.

You can also paste comments manually into the popup if you want to test without a live YouTube page.
