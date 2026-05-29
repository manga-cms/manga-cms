# Security Policy

Manga CMS is early open source software. Security-sensitive areas include:

- authentication and session cookies
- admin API keys
- entitlement checks
- delivery tokens
- gated image delivery
- purchase and redeem flows
- private manuscripts and production databases

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that could expose private
content, bypass entitlements, leak secrets, or affect user accounts.

Until a dedicated security contact is published, contact the maintainer privately
through the repository owner.

When reporting, include:

- affected area
- steps to reproduce
- expected impact
- whether private content, user data, or secrets may be exposed

## Handling Secrets

Never commit:

- `.env`
- API keys
- database dumps with real user data
- private manuscripts
- production purchase or entitlement records

Use `.env.example` as the safe template for configuration.

## Current Maturity

This project is not yet a production-ready paid manga platform. See
[docs/PUBLIC_RELEASE_CHECKLIST.md](docs/PUBLIC_RELEASE_CHECKLIST.md) for the
current release status and commercial-launch gaps.
