# BSCP XSS – four local filter labs with a bot

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
