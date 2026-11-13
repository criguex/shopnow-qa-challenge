# Exploratory probes

Scripts the AI wrote during bug hunting and I ran against the app (`npm run dev` first).

```bash
node ai/probes/api-boundaries.mjs            # boundaries and mutants on every endpoint
node ai/probes/concurrency-and-sessions.mjs  # double submit, last-unit race, latency, sessions
```

`api-boundaries.mjs` sends the payloads that crash the server (BUG-03) near the end, so the app has to be restarted afterwards. They are exploration tools, not the evaluated suite (that is `tests/`).
