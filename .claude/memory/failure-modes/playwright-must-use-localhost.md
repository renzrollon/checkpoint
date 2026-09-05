---
title: Playwright must open the app on localhost, not 127.0.0.1
date: 2026-09-05
change: build-checkpoint-reader
tags: [playwright, next, dev-server, redirect]
---
In `next dev`, `request.url` resolves to `http://localhost:<port>` whatever host the browser used, so the login route's 303 redirect (`new URL(next, request.url)`) points at localhost. A Playwright `baseURL` of `127.0.0.1` makes the login `fetch` follow a cross-origin redirect and fail, leaving the test on `/login`. Keep `baseURL` and `webServer.url` on `http://localhost:3100` in `playwright.config.ts`.
