# Analytics And Search Console Launch Notes

Purpose: define the safe launch policy for Google Search Console, sitemap
submission, robots/noindex behavior, canonical URLs, hreflang, and analytics for
the first public `manga-cms.com` release.

This is an operations document. It does not change the API contract, content
schema, Viewer routes, CMS behavior, or canonical `contents/` data.

## Search Console

Use a Google Search Console Domain property for `manga-cms.com` as the primary
property. A Domain property covers the apex domain and all subdomains, including
`read.manga-cms.com`, which is useful because the official site and Reader can
ship as separate public hosts.

Optional URL-prefix properties can be added later for host-specific debugging:

- `https://manga-cms.com/`
- `https://read.manga-cms.com/`

### Cloudflare DNS Verification

1. In Search Console, add a Domain property for `manga-cms.com`.
2. Copy the Google TXT verification value, for example
   `google-site-verification=...`.
3. In Cloudflare DNS for `manga-cms.com`, add a TXT record:
   - Type: `TXT`
   - Name: `@` or `manga-cms.com`
   - Content: the exact Google verification value
   - TTL: Auto
4. Save the record and wait for DNS propagation.
5. Return to Search Console and click verify.
6. Keep the TXT record in DNS after verification so ownership remains stable.

Do not use a temporary HTML file verification method as the primary launch
method. It is easier to break during Viewer deploys than DNS verification.

## Initial Sitemap Policy

Initial sitemaps should include only public, canonical, crawl-worthy URLs.

For `manga-cms.com`, include official project pages such as:

- `/`
- `/license`
- future official docs, roadmap, architecture, demo, showcase, and creator
  collaboration pages only after those pages are public-ready

For `read.manga-cms.com`, include canonical public Reader URLs:

- `/works`
- `/works/{seriesId}` for serial works where the detail page is intended to be
  indexed
- `/works/{seriesId}/episodes/{episodeId}` for public Reader pages

For `publicationType: "oneshot"` works, prefer the Reader URL over the generic
work detail URL when the public UI redirects the detail page to the Episode.

Exclude from the initial sitemap:

- `/s/...` Share facade URLs
- `/og/...` image routes
- `?lang=en` URLs until English release quality criteria are met
- API routes
- admin/CMS routes
- staging URLs
- draft, hidden, archived, gated, rights-uncleared, local-only, or test content

Share facades may still be opened directly and inspected with Search Console
URL Inspection when needed. They are intentionally not part of the initial
search-discovery strategy.

## Robots And Noindex

`robots.txt` should point each public host to that host's sitemap:

```text
User-agent: *
Disallow: /og/

Sitemap: https://manga-cms.com/sitemap.xml
```

Use the matching origin for `read.manga-cms.com`:

```text
Sitemap: https://read.manga-cms.com/sitemap.xml
```

Do not use `robots.txt` as a privacy or publication-control mechanism. Content
that must not appear publicly should be blocked by publication gates,
authentication, or `noindex`, not merely hidden from crawlers.

English Reader and Share URLs using `?lang=en` should remain user-visible but
`noindex,follow` until English metadata, translated page images, text quality,
rights checks, and support operations are ready. Keep those URLs out of
sitemaps while they are noindexed.

Viewer `robots.txt` / `sitemap.xml` routes are implemented in
`apps/viewer/src/pages`. Their launch behavior should match this policy:

- `robots.txt` disallows `/og/` and references the configured public
  `SITE_ORIGIN` sitemap for that deployment.
- `sitemap.xml` for official mode includes only official project pages.
- `sitemap.xml` for serial/reader mode includes canonical public Reader URLs.
- `/s/...`, `/og/...`, and `?lang=en` are excluded from sitemap output.
- `PUBLIC_INDEX_EN_LOCALE=true` is required before English locale URLs become
  indexable. Initial sitemap output still excludes `?lang=en` URLs.

## Canonical And Hreflang

Japanese is the initial canonical language.

Reader and Share metadata should follow these rules:

- canonical URLs omit `?lang`.
- `?lang=en` is a short-term alternate URL, not the canonical URL.
- `x-default` points to the Japanese canonical URL.
- URL fragments such as `#p3` are not canonical URLs.
- `/s/...` Share facade URLs may emit canonical and alternate metadata for
  direct sharing, but they are not included in the initial sitemap.
- Do not add path-prefixed locale URLs such as `/en/...` until sitemap,
  canonical URL, and reciprocal `hreflang` behavior are updated together.

While English pages are noindexed, do not rely on them as search-facing
`hreflang` alternates. Full reciprocal `ja`/`en` hreflang and sitemap inclusion
should wait until English URLs are indexable.

## Analytics

Use Search Console first. Cloudflare Web Analytics is the preferred first
traffic analytics option for the public launch because the Viewer has a
production-only loader gate. Keep GA4 disabled for the first public launch
unless a privacy notice and consent UI are ready.

The Viewer can load Cloudflare Web Analytics, but only when all of these are
true:

- the request host is a production public host such as `manga-cms.com` or
  `read.manga-cms.com`
- `PUBLIC_ANALYTICS_ENV=production`
- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED=true`
- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` is set to the production site token

Do not load Cloudflare Web Analytics on localhost, staging, preview hosts, or
admin/CMS surfaces. The `/s/...` Share facade and `/og/...` image routes do not
emit the Cloudflare Web Analytics beacon.

The Viewer does not load GA4 while `PUBLIC_ANALYTICS_ENABLED=false`. Do not
claim GA4 is active from `PUBLIC_GA_MEASUREMENT_ID` configuration alone.

GA4 should remain disabled in production until consent prerequisites are met:

- keep `PUBLIC_ANALYTICS_ENABLED=false`
- do not enable GA4 only because `PUBLIC_GA_MEASUREMENT_ID` is configured
- do not send Reader feedback text, Bubble text, delivery tokens, user
  identifiers, entitlement state, or raw URLs with sensitive parameters to GA4
- use a separate staging property or stream if staging analytics is ever needed

Cloudflare Web Analytics is acceptable as the first low-friction traffic check.
Search Console is the source for search indexing, query, and sitemap health.
GA4 is a later product analytics option, not a public-launch blocker.

## Launch Checklist

Before submitting sitemaps:

1. Add the Search Console Domain property for `manga-cms.com`.
2. Verify ownership with a Cloudflare DNS TXT record.
3. Confirm production canonical URLs use `https://manga-cms.com` or
   `https://read.manga-cms.com`, not localhost or staging.
4. Confirm staging and local hosts are not submitted to Search Console.
5. Confirm English `?lang=en` URLs are either noindexed or explicitly approved
   for indexing.
6. Confirm `/s/...` and `/og/...` are excluded from sitemap output.
7. Confirm Cloudflare Web Analytics is either not loaded or loads only on
   production public hosts.
8. Confirm GA4 remains disabled unless consent and privacy requirements are
   complete.

Future work:

- verify production `robots.txt` and `sitemap.xml` routes on both public hosts
- verify the Cloudflare Web Analytics loader on the production public hosts
- add a privacy page before enabling broader analytics
- define quality criteria for indexing English Reader and Share URLs
- add Search Console URL Inspection checks for representative Reader and Share
  URLs after launch
