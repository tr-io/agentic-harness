import type { TemplateContext } from "../../types.js";

export function frontendMd(_ctx: TemplateContext): string {
  return `# Frontend Guidance

> Frontend-specific conventions, patterns, and constraints.

## State Management

<!-- How application state is managed (e.g. Zustand, Redux, Context). -->

## Routing

<!-- Routing library and conventions. -->

## Data Fetching

<!-- How data is fetched and cached (e.g. React Query, SWR, tRPC). -->

## Styling

<!-- CSS approach and conventions. -->

## Testing

<!-- Component testing strategy and tools. -->
`;
}
