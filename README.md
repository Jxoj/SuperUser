
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
provider selection, removable and custom home shortcuts (including Soundboard
and `su://extensions`), the `su://games` provider hub, lightweight ad/tracker
filtering, site userscript prompts from `extensions/scripts/index.json`, and a
current Wisp endpoint display with automatic discovery and an optional custom
endpoint.
Scramjet proxy URLs use the `/eduapi/` route. Settings are grouped into Proxy,
Extensions, Personalization, and General pages; General includes a factory reset
that clears SuperUser data from local storage. The Official Wisp endpoint is the
default and recommended transport.

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
Discovery checks each server for Wisp v1 and v2 support, prefers v2 when
available, and displays the protocols each endpoint supports. Self-hosted Wisp
supports v2; older endpoints can fall back to v1.

## Builds

Run `npm run build` to generate `singlefile/index.html` and
`singlefile/launcher.js`. The HTML build inlines the CSS, application JavaScript,
Scramjet runtime, controller scripts, extension catalog and scripts, shortcut
icons, internal pages, and learning mockup. The remaining requirements are a
browser environment and network access to the Wisp transport.

The generated HTML is designed to be moved or opened independently, but proxy
service-worker behavior still requires a secure context (`https://` or
`localhost`). Browser security does not allow `file:` or `about:blank` to
register the proxy service worker by themselves.
