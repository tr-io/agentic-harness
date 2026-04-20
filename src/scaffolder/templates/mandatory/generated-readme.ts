import type { TemplateContext } from "../../types.js";

export function generatedReadme(_ctx: TemplateContext): string {
  return `# Generated Artifacts

Auto-generated files. Do not edit by hand — these are overwritten by harness tooling.

## Contents

- Codebase analysis from \`harness init\` (sub-agent output)
- Database schema snapshots
- API type exports
- Other auto-generated docs

To regenerate: run \`harness init\` or the relevant generation command.
`;
}
