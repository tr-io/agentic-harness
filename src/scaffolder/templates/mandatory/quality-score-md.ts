import type { TemplateContext } from "../../types.js";

export function qualityScoreMd(_ctx: TemplateContext): string {
  return `# Quality Standards

> Define the quality bar for this project: what "good" looks like across dimensions.

## Code Quality

<!-- Style guide, complexity limits, review requirements. -->

## Test Coverage

<!-- Coverage targets and what must be tested. -->

## Performance

<!-- Latency budgets, bundle size limits, or benchmark targets. -->

## Documentation

<!-- What must be documented and to what level of detail. -->
`;
}
