# Snip

Snip is a tiny URL shortener: one backend API serves both the Angular web app
and the Node.js CLI. Links are held in memory and disappear when the backend
restarts.

## Repository layout

The `backend`, `frontend`, and `cli` directories are Git submodules tracking
their matching branches. Each component keeps its files at the root of its
branch. This `main` branch pins the exact component commits used together.

| Branch | Component | Stack |
| --- | --- | --- |
| `backend` | API and redirects | Bun, zero dependencies |
| `frontend` | Web client | Angular 19 |
| `cli` | Terminal client | Node.js, CommonJS |
| `main` | Superproject | Submodule pointers and build/release tooling |
| `bundle` | Generated release | Backend, built web UI, and CLI |

## API contract

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | `201` with `{ code, url, shortUrl, hits, createdAt }`; `400` for invalid JSON or a non-HTTP(S) URL |
| `GET` | `/api/links` | `200` with an array of link objects |
| `GET` | `/:code` | `302` to the original URL and increments `hits`; `404` for an unknown code |

## Clone and run

Clone with submodules initialized; a plain clone leaves those directories empty:

```sh
git clone --branch main --recurse-submodules https://github.com/aaranisk/snip-workshop-demo.git
cd snip-workshop-demo
```

In separate terminals:

```sh
cd backend && bun start
```

```sh
cd frontend && npm install && npx ng serve
```

```sh
cd cli && node cli.js ls
```

The backend listens on port `3000`; Angular serves on port `4200` and calls the
backend at `http://localhost:3000`. The CLI uses `SNIP_API`, defaulting to
`http://localhost:3000`.

## Updating a component

Commit and push changes from inside the component submodule, then update and
commit the pointer in the superproject:

```sh
cd backend
git add -A && git commit -m "Describe backend change" && git push
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Repeat with `frontend` or `cli` as appropriate. The `bundle` branch is generated
output; rebuild it with `node scripts/build-bundle.mjs` rather than editing it
by hand.
