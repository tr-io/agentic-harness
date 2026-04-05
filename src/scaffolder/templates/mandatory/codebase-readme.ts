import type { TemplateContext } from "../../types.js";

export function codebaseReadme(ctx: TemplateContext): string {
  return `# Codebase Navigation

This directory contains navigation maps for the **${ctx.projectName}** codebase.
Add one file per major module or subsystem.

## Convention

Each file should document:
- **Purpose** — what this module does
- **Entry points** — where to start reading
- **Key abstractions** — important types, interfaces, classes
- **Dependencies** — what this module depends on
- **Constraints** — rules agents must follow when working here

## Files

<!-- Add entries here as you document modules -->
<!-- Example: -->
<!-- - [backend.md](backend.md) — API server, routes, services -->
<!-- - [frontend.md](frontend.md) — UI components, stores, routing -->

*No navigation maps yet. As you build the codebase, document modules here.*
`;
}
