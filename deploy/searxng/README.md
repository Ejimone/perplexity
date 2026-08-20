---
title: Simplicity Search
emoji: 🔍
colorFrom: gray
colorTo: blue
sdk: docker
app_port: 8080
pinned: false
---

# SearXNG for Simplicity

A private metasearch instance for a hosted Simplicity deployment. Simplicity
answers questions from real web results, so it needs a search engine it can
query — this is that engine.

## Why this exists rather than using a public instance

SearXNG ships with its JSON API switched off, and every public instance leaves
it that way to stop people scripting against it. Simplicity asks for
`format=json`, so a public instance returns an HTML page (or a 403) and every
question fails. `settings.yml` here turns JSON on, which is the whole point of
running your own.

## Deploying to Hugging Face Spaces (free)

1. Create a new Space, choose **Docker → Blank**.
2. Upload `Dockerfile`, `settings.yml` and this `README.md`.
3. In **Settings → Variables and secrets**, add a secret named
   `SEARXNG_SECRET` with any random value, for example the output of
   `openssl rand -hex 32`. The container substitutes it at start-up, which is
   why no real secret is stored in `settings.yml`.
4. Wait for the build, then note the Space URL:
   `https://<your-name>-<space-name>.hf.space`

## Pointing Simplicity at it

Set `SEARXNG_API_URL` to that URL — **with no trailing slash**, because the app
builds `${SEARXNG_API_URL}/search?format=json`.

- Hosted (Vercel): add it as an environment variable and redeploy.
- Desktop: Settings → Search → SearXNG URL. The desktop app normally runs its
  own local instance and needs none of this.

## Running it locally

```bash
docker build -t simplicity-searxng .
docker run -d -p 8888:8080 -e SEARXNG_SECRET="$(openssl rand -hex 32)" simplicity-searxng
curl "http://127.0.0.1:8888/search?q=test&format=json"
```

The last command should return JSON with a populated `results` array. If it
returns HTML, `formats: json` is not being picked up.

## A note on access

`limiter` is off, because the rate limiter blocks exactly the programmatic
requests this instance exists to serve. Keep the URL to yourself — anyone who
has it can run searches through it.
