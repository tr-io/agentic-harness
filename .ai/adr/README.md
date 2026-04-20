# Architecture Decision Records

This directory records architectural decisions made during development of **agentic-harness**.

## Format (Nygard)

Each ADR is a numbered markdown file: `NNN-title-in-kebab-case.md`

```markdown
# NNN. Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-NNN]

## Context

What situation or problem led to this decision?
What forces are at play?

## Decision

What was decided? State it clearly and directly.

## Rationale

Why was this decision made over the alternatives?
What tradeoffs were accepted?

## Consequences

What are the results of this decision?
What becomes easier? What becomes harder?
What new problems are introduced?
```

## Rules

- ADRs are **immutable** once accepted — never edit a decision after acceptance
- To reverse a decision: write a new ADR that supersedes the old one
- Write the ADR **before** implementing the decision, not after
- Link to relevant code, tickets, or external references

## Index

- [001](001-harness-as-claude-code-plugin.md) — Harness as a Claude Code plugin (plugin directory architecture)
