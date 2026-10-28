# Security Notes

## Build dependency advisory exception — v1.0.0

The production dependency graph was checked with:

```bash
npm audit --omit=dev --package-lock-only
```

Result: **0 vulnerabilities**.

The full frontend lockfile reports eight transitive advisories in development
dependencies: two moderate and six high. They originate in the Tailwind CSS v3
build toolchain and its transitive packages. They are not present in the
production dependency graph or generated production assets.

This release intentionally does not run `npm audit fix` or migrate to Tailwind
CSS v4 automatically, because that is a major-version migration that requires
separate UI regression testing. The dependency review remains a maintenance
item for a future release.

## Package security boundaries

- The package contains readable, editable source code and no license DRM,
  purchase-code validation, domain lock or remote license check.
- `.env.example` files contain variable names and placeholders only. Never
  commit or share real `.env` files, credentials, tokens or database dumps.
- Payment credentials and webhook secrets must be created independently for
  each buyer environment.
