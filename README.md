# Snip backend

A zero-dependency Bun URL shortener API. Links are stored in memory and are cleared when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Configure `PORT` to change it, `BASE_URL` to set the origin used in returned short links, or `RAILWAY_PUBLIC_DOMAIN` as a fallback public hostname. Set `PUBLIC_DIR` to serve static files alongside the API.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a link.
- `GET /api/links` lists links.
- `GET /:code` redirects to the original URL and increments its hit count.
