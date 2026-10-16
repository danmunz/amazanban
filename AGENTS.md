# Notes for coding agents

- The loadable extension is `extension/`. Everything else (tests, scripts, CI) stays outside it so it never ships in the zip.
- No build step or dependencies. Content scripts are plain scripts that share state through `globalThis.Amazanban`; keep it that way unless there's a real need for a bundler.
- Amazon order pages are encrypted server-side and decrypted in the page. Don't switch page loading to `fetch()`; it returns ciphertext. See "How it reads your orders" in README.md.
- Any change to status handling in `extension/src/classify.js` gets a case in `test/classify.test.js`, using the exact wording Amazon shows.
- To test against a real orders page, inject `classify.js`, `parse.js`, and `board.js` into the tab with a small `chrome.runtime` / `chrome.storage` shim, or load the extension unpacked.
- Keep `version` in `extension/manifest.json` and `package.json` in sync; `npm run build` fails otherwise.
