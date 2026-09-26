---
title: Limits and caching
description: Upload limits, rate limits, processing times and cache behaviour.
---

# Limits and caching

## Uploads and processing

| Limit | Value |
| --- | --- |
| File size (library uploads) | 20 MB per file |
| Files per upload | 60 |
| Accepted formats | TTF, OTF, WOFF, WOFF2, ZIP (font collections `.ttc` are not supported) |
| Processing time limit | 300 seconds per job |

A typical 4-weight static family processes in under 10 seconds; a single variable font in a few seconds. Jobs that stop mid-way can be retried from the **Jobs** page; a job stuck for more than 10 minutes can be retried too.

## Free converter

| Limit | Value |
| --- | --- |
| Files per conversion | 12 |
| Size per file | 15 MB |
| Total per conversion | 40 MB |
| Conversions | 30 per hour per network |
| File inspections | 120 per hour per network |

## Caching

| Resource | Browser | CDN | Notes |
| --- | --- | --- | --- |
| CSS API | 10 minutes | 5 minutes, then stale-while-revalidate for 1 day | Publishes propagate within about 5 minutes |
| Font files | 1 year, immutable | 1 year | Content-hashed names; a new version gets new URLs |
| Token stylesheet | 5 minutes | 1 minute, stale-while-revalidate | |
| Kits | | | Cached per version and options in storage |

## Monitoring

**Monitoring** shows CSS API requests per day, latency percentiles, error rate and the most requested families, plus pipeline success rate, durations and failure reasons.

CSS API numbers count requests that reached the app. Requests answered by the CDN cache never reach it, so these are cache misses and refreshes.
