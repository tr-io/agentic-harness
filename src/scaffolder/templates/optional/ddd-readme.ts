import type { TemplateContext } from "../../types.js";

export function dddReadme(ctx: TemplateContext): string {
  return `# Domain Context Maps

This directory documents the domain model for **${ctx.projectName}** using
Domain-Driven Design (DDD) concepts.

## Convention

One file per bounded context: \`<context-name>.md\`

Each context file should document:

\`\`\`markdown
# <Context Name>

## Aggregates
List aggregates with their fields, invariants, and identity.

## Repository Interfaces
Abstract interfaces for data access — no implementation details here.

## Application Services / Use Cases
Business logic orchestration. What can this context do?

## Facade (Cross-Context API)
Public API exposed to other contexts. Other contexts NEVER import
repos or aggregates directly — only the facade.

## Infrastructure Adapters
Concrete implementations (DB, message queue, external APIs).

## Cross-Context Rules
What rules govern how this context interacts with others?
\`\`\`

## Index

<!-- Add entries as contexts are documented -->

*No contexts documented yet.*
`;
}
