# Mock-data seam — `@netri/dashboard/src/mock`

This directory is the **single seam** where dashboard mock data lives today and
where backend data will land later. During Phase 1 it intentionally contains
**no domain functionality** — only a thin, clearly-marked boundary.

## Rules

1. **No domain logic here.** The placeholder views in `src/App.tsx` are dumb
   presentation. They must not compute, transform, or deduplicate data.
2. **Every placeholder view reads from this seam only** (future backend).
3. **Never duplicate contract types or schemas.** Types come from
   `@netri/contracts`. Mock data is plain JSON objects conforming to those
   schemas.
4. **The seam is swappable without touching the UI.** When the backend lands,
   `src/mock` is replaced by a fetcher/hook in a future `src/data` module. The
   UI never imports from `src/mock` directly after the seam is moved.

## What belongs here (Phase 1, thin)

- `device.ts` — the one device the console displays (idle / operational).
- `README.md` — this file.
- any static JSON the placeholder views surface.

## What does NOT belong here yet (future phases)

- employees roster, devices inventory, responder roster,
- incident list, escalation/timeout state, live WebSocket stream,
- contact directory, family-notification payloads, SMS/email/WhatsApp/provider
  integrations, authentication.

All of the above are explicitly excluded from Phase 1 scope (see RULES.md
Phase-1 dashboard constraints).
