import type { TemplateContext } from "../../types.js";

export function referencesReadme(_ctx: TemplateContext): string {
  return `# External References

External documentation, API references, and llms.txt files.

## Purpose

Store pointers to external resources that agents need to be aware of:
- Third-party API documentation excerpts
- \`llms.txt\` files from dependencies
- Vendor integration guides
- Compliance and regulatory references
`;
}
