
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
own loaded page when switching tabs and can be closed from the sidebar.
Closing the actual SuperUser browser tab uses the browser's native confirmation
dialog.

Additional client features include persisted tabs/settings, icon-based search
provider selection, removable and custom home shortcuts, the `su://games`
provider hub, lightweight ad/tracker filtering, custom image/video backgrounds,
site userscript prompts from `extensions/scripts/index.json`, and a Wisp
selector with Official, self-hosted, public, and custom endpoint options.
Settings are grouped into Proxy, Extensions, Personalization, and General pages.
The Official Wisp endpoint is the default and recommended transport.

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

The Official option uses
`wss://symbolic-jocelyne-jxo-prod-c0e42749.apps.mistral.run/` and is selected
by default. The public
`wss://wisp.mercurywork.shop/` endpoint is also available, and custom
`ws://` or `wss://` endpoints can be entered in Settings. Endpoint selection is
verified with an actual proxied HTTPS request, not just a WebSocket open.
Self-hosted uses Wisp v2; Official and MercuryWorkshop use Wisp v1 by default.
Settings also exposes an explicit protocol override.

## Builds

Run `npm run build` to generate `singlefile/index.html`, the service-worker and
Scramjet runtime assets, the game hub and learning mockup assets, the Netlify
CORS headers, and `singlefile/launcher.js`. The launcher opens an `about:blank` tab immediately,
checks the selected mirror, and tries the other mirror if the selected one is
unavailable. When a mirror works, it navigates that tab to the mirror so the
page keeps the real HTTPS origin required by the service worker.

The generated HTML inlines the application scripts; runtime files, shortcut
icons, and game hub assets are deployed beside it. On the first successful
visit, the service worker caches the app shell and Scramjet runtime for use if
the mirror later goes offline. Browser security does not allow an
`about:blank`, `blob:`, or standalone `file:` page to register the same-origin
service worker this proxy requires, so no browser-only launcher can make a
first-ever launch work when every mirror is offline. When both mirrors are
unreachable, use a reachable custom server URL in the launcher.
