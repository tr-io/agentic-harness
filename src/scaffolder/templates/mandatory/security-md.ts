import type { TemplateContext } from "../../types.js";

export function securityMd(_ctx: TemplateContext): string {
  return `# Security Guidelines

> Security requirements, threat model, and agent guardrails.

## Threat Model

<!-- What are the key assets and threat vectors for this project? -->

## Authentication & Authorization

<!-- Auth patterns in use and their constraints. -->

## Secrets Management

<!-- How secrets are stored and accessed. Never commit secrets to this file. -->

## Agent Guardrails

<!-- What agents must never do: write to prod, delete data, expose credentials, etc. -->
`;
}
