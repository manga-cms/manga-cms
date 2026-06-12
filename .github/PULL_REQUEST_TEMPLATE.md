## Summary

Describe the change in one or two sentences.

## Area

- [ ] API / domain / schema
- [ ] Creator CMS
- [ ] Public Viewer / Reader
- [ ] Ingestion
- [ ] Content / Packs
- [ ] Docs / operations

## Boundary Check

- [ ] Keeps `Series -> Episode -> Page -> Panel -> Bubble` terminology.
- [ ] Keeps `contents/` and `packs/` as canonical manga content sources.
- [ ] Does not move canonical manga content into the runtime DB.
- [ ] Does not add payment-provider, hosted SaaS, custom-domain, private CDN,
      fingerprinting, watermarking, or leak-detection implementation.
- [ ] Does not commit secrets, private manuscripts, production databases, or
      unpublished third-party content.

## Verification

List commands run. Use the narrowest useful checks.

```text
pnpm lint
pnpm test:compose-safety
pnpm validate:content
pnpm test:content-validation
pnpm check:docs
pnpm build
```

## Review Notes

Call out contract, public URL, indexing, rights, or migration implications.
