# Testing Conventions

This document defines the testing strategy for **agentic-harness**.

## Test Types

### Unit Tests
- **What:** Pure logic with no I/O, no network, no database
- **Where:** `<!-- e.g., src/**/*.test.ts or tests/unit/ -->`
- **Command:** `npm test`
- **Target:** Fast, many. Run on every save.

### Integration Tests
- **What:** Real dependencies (DB, HTTP, message queue)
- **Where:** `<!-- e.g., tests/integration/ -->`
- **Command:** `<!-- e.g., npm run test:integration -->`
- **Target:** Key workflows. Run pre-push.

### E2E Tests
- **What:** Full user flows against a running application
- **Where:** `<!-- e.g., e2e/ -->`
- **Command:** `<!-- e.g., playwright test -->`
- **Target:** Smoke tests and critical paths. Run post-deploy.

## Conventions

### Naming
```
<!-- Fill in your naming convention -->
<!-- Example: describe('AuthService', () => { it('returns 401 for invalid token') }) -->
```

### Query Style (if UI testing)
- Query by role/label/text — never by CSS class or test ID
- Test behavior, not implementation

### Mocking Strategy
```
<!-- Fill in your mocking boundaries -->
<!-- Example: mock at adapters (HTTP, DB), never mock domain logic -->
```

## Coverage Map

Track coverage in a `coverage.md` file in this directory as the project grows.

| Module | Unit Tests | Integration | E2E | Notes |
|--------|-----------|-------------|-----|-------|
| *none yet* | — | — | — | — |

## What NOT to Test

```
<!-- List things explicitly out of scope -->
<!-- Example: third-party SDKs, generated code, trivial getters/setters -->
```
