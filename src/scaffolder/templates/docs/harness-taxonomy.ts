import type { TemplateContext } from "../../types.js";

export function harnessTaxonomy(_ctx: TemplateContext): string {
  return `# Harness Taxonomy: Feedforward vs Feedback Controls

**Date:** <!-- fill in when adopted -->
**Status:** Accepted

## Context

As the harness grows, features added without a deliberate control model drift and
contradict each other. Some features attempt to prevent mistakes before the agent
acts; others detect and surface problems after the agent acts. Without a shared
vocabulary, it's hard to reason about harness balance or design new features
consistently.

Martin Fowler's harness engineering article defines a two-axis taxonomy:

- **Feedforward (guides):** Anticipatory — steer the agent *before* it acts.
  Goal: increase the probability of a correct first attempt.
- **Feedback (sensors):** Corrective — observe *after* the agent acts and help it
  self-correct. Goal: detect and surface problems quickly.

Each axis can also be:

- **Computational:** Deterministic, milliseconds, no LLM call required.
- **Inferential:** AI-based, semantic, slower — requires a model call.

## Decision

All harness features are classified along these two axes. The classification is
recorded in \`src/config/feature-metadata.ts\` and surfaced in \`harness configure\`
(grouped by control type) and \`harness taxonomy\` (full audit table).

Every new feature added to the harness MUST declare its \`controlType\` and
\`executionType\` in \`feature-metadata.ts\` before shipping.

## Feature Classification Table

| Feature | Type | Axis | Execution |
|---|---|---|---|
| ADR docs | Guide | Feedforward | Computational |
| Testing conventions | Guide | Feedforward | Computational |
| Linter bootstrap | Tool | Feedforward | Computational |
| Linear integration | Guide | Feedforward | Computational |
| DDD context maps | Guide | Feedforward | Computational |
| LAT.md | Guide | Feedforward | Computational |
| Skill templates | Guide | Feedforward | Inferential |
| Evaluator QA sub-agent | Tool | Feedforward | Inferential |
| Branch naming warning | Sensor | Feedback | Computational |
| Artifact freshness check | Sensor | Feedback | Computational |
| Auto loop | Sensor | Feedback | Computational |
| Keel enforcement | Sensor | Feedback | Computational |
| Completion reminder | Sensor | Feedback | Inferential |

## Rationale

A harness with only feedforward guides and no feedback sensors is likely
under-instrumented — mistakes go undetected until the user notices. A harness with
only feedback sensors and no guides is reactive but not preventive — it corrects
mistakes it could have avoided. The ideal harness has both.

Fowler notes that good sensors produce signals **optimised for LLM consumption**:
custom linter messages that include self-correction instructions ("positive prompt
injection"). When adding new feedback sensors, this should be a design requirement.

## Consequences

- \`harness configure --section features\` groups prompts under **Guides (feedforward)**
  and **Sensors (feedback)** headers, surfacing the taxonomy in the UX.
- \`harness taxonomy\` prints a formatted table of all features with their enabled
  status and control type, so teams can audit harness balance.
- New features require an explicit classification, preventing classification drift.

## References

- Martin Fowler — *Harness Engineering* (internal/external article)
- \`src/config/feature-metadata.ts\` — runtime classification map
`;
}
