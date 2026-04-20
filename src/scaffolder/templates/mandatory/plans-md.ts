import type { TemplateContext } from "../../types.js";

export function plansMd(_ctx: TemplateContext): string {
  return `# Project Plans

> Current and upcoming work. See .ai/exec-plans/ for detailed execution plans.

## Active Milestones

<!-- List active milestones and their goals. -->

## Upcoming Work

<!-- Planned features and improvements. -->

## Tech Debt

<!-- Known technical debt items and their priority. -->
`;
}
