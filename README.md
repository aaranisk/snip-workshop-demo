# Snip frontend

The Snip Angular 19 client shortens HTTP(S) URLs and lists links from the Snip API at `http://localhost:3000`.

## Run locally

Start the backend in another terminal, then run:

```sh
npm install
npx ng serve
```

Open [http://localhost:4200](http://localhost:4200). The page validates URLs before submission and shows the returned short link, API errors, and the links table with hit counts.

## Build

```sh
npx ng build
```

The production files are written to `dist/snip-frontend/browser`, which is consumed by the Snip bundle build.
