# BSCP XSS – four local filter labs with a bot

A local teaching app with a step-by-step BSCP XSS guide, Burp Repeater **Scan insertion point** guidance, two DOM XSS labs, one server-reflected XSS lab, one stored XSS lab, and a headless Chromium bot. Each lab has a hint and a collapsible **Reveal answer**. The app also includes a separate **XSS Notes** reference page. The bot uses a fake, JavaScript-readable cookie and can visit only the local training app; successful payloads send that test cookie to the local receiver.

## Run with Docker

Requires Docker Engine and the Docker Compose plugin. The container includes the matching Playwright Chromium runtime.

```bash
docker compose up --build
```

Open <http://127.0.0.1:3000>. The Compose configuration publishes the app on the host loopback interface only. Stop it with `Ctrl+C`; use `docker compose down` to remove the container.

## Run with Node.js

Requires Node.js 18 or newer and an internet connection the first time Playwright and Chromium are installed.

```bash
npm install
npx playwright install chromium
npm start
```

Open <http://127.0.0.1:3000>. Stop the server with `Ctrl+C`.

Place `main.png`, `1.png`, and `2.png` beside `server.js`. The overview loads these files for the hero image and the two screenshots under **Find the context**. Missing images simply show as unavailable until you add them.

## Testing workflow

1. Follow the overview guide: submit a unique marker, locate it in Burp history/Repeater and inspect the response and live DOM.
2. Open an exercise in its own window. Use the search field in Labs 1–3; in Lab 4, submit a comment and inspect how it is rendered. Visit `/notes` for the XSS reference notes.
3. Try a harmless proof of execution. Use the hint, then **Reveal answer**, if needed.
4. Return to the overview and choose the matching lab. Paste the verified payload and build its link; for Lab 4, post the payload first and build a link to the comments page.
5. Send the generated link to the local bot and look for the fake cookie in the receiver log.

## Labs

1. DOM XSS through `document.write` inside a `select`; context breakout and a case-sensitive script filter.
2. DOM XSS in a JavaScript string; backslash bypass of apostrophe escaping.
3. Reflected XSS in the server response; common tags are blocked while a custom element and `onfocus` survive (the bot focuses `#x`).
4. Stored XSS in comments; a first-angle-bracket cleanup bypass leaves an image `onerror` handler executable.

## Isolation

- The Node.js default binds to `127.0.0.1:3000`. In Docker, the process listens on the container interface while Compose publishes it only on host `127.0.0.1:3000`.
- The bot API accepts only the four `/challenge/1`–`/challenge/4` pages on `http://127.0.0.1:3000`.
- The bot blocks HTTP and WebSocket requests to other origins.
- The cookie is random `DEMO_ONLY_...` data. Never use real session values.
- The app is intentionally vulnerable and for local teaching only. The comment store is in memory and is cleared when the server restarts. Use PortSwigger's own exploit server for PortSwigger labs.

## Repository contents

`Dockerfile` and `compose.yaml` provide the local container setup. `.gitignore` and `.dockerignore` exclude local dependencies and generated archives. Add `main.png`, `1.png`, and `2.png` if you want the overview screenshots included in your repository.
