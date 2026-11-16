# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS (ES modules, no build step), installable as a PWA (manifest + service worker). Hostable on any static host (GitHub Pages, Netlify).

## Users

One person (the owner), German-speaking, tracking a lifetime of watched TV series for themselves. Typical situation: on the couch or phone, remembering a show watched years ago and adding it in a few taps; occasionally looking at the totals out of curiosity.

## Product Purpose

A personal ledger of every series the owner has ever watched. Search a show, mark it watched at the level of the whole show, a season, or a single episode, optionally with a rewatch multiplier (e.g. Breaking Bad watched 3x). Because episode runtimes are known, the app computes time spent per show and in total, and counts shows watched. The owner rates shows 1–10 and sees a personal tier list (S/A/B/C/D).

Success: the owner can reconstruct "every show I've ever seen" quickly and is surprised/delighted by the totals ("120 series, 2,400 hours").

## Positioning

Not a social tracker, no feed, no account. It is retrospective and personal: lifetime totals, rewatch multipliers, and one's own tier ranking, all local.

## Operating Context

- Series data: TVmaze public API (api.tvmaze.com), no API key, CORS-enabled, rate-limited (~20 calls / 10 s). Show search, seasons, episodes with name, number, airdate, runtime, poster images.
- Licence: TVmaze data is CC BY-SA 4.0. The app must credit TVmaze with a link wherever data is shown (footer/about). Personal, non-commercial use.
- Episode titles are mostly English (TVmaze limitation).
- User data lives only on the device (localStorage/IndexedDB); backup and device change via JSON export/import.

## Capabilities and Constraints

- Search shows by name; show detail with seasons and episodes.
- Mark watched: whole show, per season, per episode; watch count multiplier per show (and implicitly per episode).
- Time spent per show and lifetime total; number of shows watched (fully or partly).
- Rating 1–10 per show; tier list derived from ratings (S ≥ 9.5? exact mapping is a product decision recorded in code).
- Works offline for already-added shows (cached show data).
- Undecided: cross-device sync (explicitly out of scope for now).

## Evidence on Hand

No user data yet. No brand assets beyond the in-app brand mark. Product name: Boxset (renamed from "Serienregal"; internal storage keys keep the `serienregal` prefix for data compatibility, intentionally).

## Product Principles

1. Adding a show must take seconds: search, one tap "ganze Serie gesehen".
2. Granularity on demand: show → season → episode, never forced.
3. Numbers are the reward: totals must be honest (computed from real runtimes) and front and centre.
4. Private by default: no account, no server, data exportable at any time.
5. Credit the data source properly.

## Accessibility & Inclusion

German UI. Usable one-handed on a phone; keyboard accessible on desktop.
