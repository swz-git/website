# RLBot website

Website for [RLBot](https://github.com/RLBot), built with [Astro](https://astro.build).

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server at http://localhost:4321
npm run build     # build the static site into dist/
npm run preview   # serve the built site
```

## Environment

The "Upcoming Events" section fetches the public Google Calendar in the browser
via the Calendar API. To use a different key, copy `.env.example` to
`.env` and set `PUBLIC_GOOGLE_CALENDAR_API_KEY` (it is inlined at build time).
