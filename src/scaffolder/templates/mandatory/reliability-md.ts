import type { TemplateContext } from "../../types.js";

export function reliabilityMd(_ctx: TemplateContext): string {
  return `# Reliability & On-Call

> SLOs, alerting thresholds, and on-call runbooks.

## SLOs

<!-- Service Level Objectives: availability, latency, error rate targets. -->

## Alerting

<!-- What pages, what thresholds, who gets alerted. -->

## Runbooks

<!-- Step-by-step guides for common incident scenarios. -->

## Failure Modes

<!-- Known failure modes and their mitigations. -->
`;
}
