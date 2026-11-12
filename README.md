# Snip CLI

A zero-dependency Node.js client for the Snip URL shortener. Requires Node 20+
and a running Snip API (default: `http://localhost:3000`). Set `SNIP_API` to
use a different API base URL.

```sh
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
node cli.js help
```

The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward their arguments to
`cli.js` on macOS/Linux, Windows Command Prompt, and PowerShell respectively.
