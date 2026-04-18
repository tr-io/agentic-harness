import type { TemplateContext } from "../../types.js";

export function productSenseMd(_ctx: TemplateContext): string {
  return `# Product Context & Goals

> The "why" behind this project. Agents should read this to understand user value before making decisions.

## Product Vision

<!-- What problem does this product solve? For whom? -->

## Core User Flows

<!-- The 2-3 flows that matter most to users. -->

## Success Metrics

<!-- How do we know if the product is working? -->

## Non-Goals

<!-- Explicit non-goals to prevent scope creep. -->
`;
}
