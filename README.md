# SuperUser Proxy

A terminal-themed web proxy powered by [Scramjet](https://github.com/MercuryWorkshop/scramjet) + [Wisp](https://github.com/MercuryWorkshop/wisp-js).

## Stack

| Layer | Package |
|---|---|
| Proxy engine | `scramjet` v2.0.67 (bundled) |
| Transport | `epoxy-transport` (CDN) |
| Wisp server | `@mercuryworkshop/wisp-js` |
| HTTP server | Node.js built-in `http` + `express` |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
# or for auto-reload during dev:
npm run dev
```

Then open **http://localhost:8080** in your browser.

> ⚠️ Service workers require a secure context. Use `localhost` or set up HTTPS.

## Commands (type in the terminal bar)

| Command | Action |
|---|---|
| `sudo <url>` | Navigate to URL |
| `sudo google <query>` | Google search |
| `sudo yt <query>` | YouTube search |
| `sudo settings` | Open settings |
| `sudo` | Open the scrollable command menu |
| `sudo help` | Open the full commands reference |
| `sudo newtab` | New tab |
| `sudo clear` | Close all tabs |
| `sudo back / forward / reload` | Navigation |
| `sudo wisp <wss://url>` | Switch Wisp server |
| `sudo status` | Show connection info |
| `sudo home` | Go home |

Press **Enter** to submit a command, URL, or search. When `sudo` is typed, the
command menu opens with keyboard navigation using **Arrow keys** or **Tab**.
The URL bar accepts the same `sudo` commands while browsing. Settings, Help,
and Logs are available as separate in-app pages. Each internal tab keeps its
own loaded page when switching tabs; internal tabs do not have close buttons.
Closing the actual SuperUser browser tab uses the browser's native confirmation
dialog.

Additional client features include persisted tabs/settings, selectable search
providers, lightweight ad/tracker filtering, custom image/video backgrounds,
site userscript prompts from `extensions/scripts/index.json`, local shortcut
icons, and a Wisp selector with self-hosted, Homework, Official, public, and
custom endpoint options. The default transport is the local server.

## Production (with nginx + SSL)

```nginx
server {
    listen 443 ssl;
    server_name proxy.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Wisp server endpoint

The built-in Wisp server listens on the **same port** as the HTTP server at `/wisp/`.

```
ws://localhost:8080/wisp/
```

No separate process needed.

The Homework option uses
`wss://symbolic-jocelyne-jxo-prod-c0e42749.apps.mistral.run/`. The public
`wss://wisp.mercurywork.shop/` endpoint is also available, and custom
`ws://` or `wss://` endpoints can be entered in Settings. Each endpoint is
initialized through Epoxy and then verified by loading a proxied page.

## Builds

Run `python build_singlefile.py` to generate `singlefile/index.html`, or
`python build_js.py` to generate `singlefile/launcher.js`. The launcher defaults
to Mirror 2 and fetches the selected single-file build before opening it in a
new `about:blank` tab.
