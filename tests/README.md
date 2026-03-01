# tests

Universal test suite for the OpenMesa monorepo. Integration, end-to-end, and cross-service tests live here.

App-level unit tests live alongside their source (e.g. `apps/web/src/**/*.test.ts`).
This folder is for tests that span multiple apps or services.

```
tests/
  e2e/          # End-to-end tests (Playwright)
  integration/  # Cross-service integration tests
  load/         # Load and performance tests
```
