# Trust Governance Protocol

## Overview

The trust governance layer provides hard constraints, auditable injection approval, and dynamic configuration for AI agents using the MCP Rule Engine. It enforces that all code generation is validated before output, and all rule modifications are explicitly approved by a human operator.

## Three-Tier Knowledge Base

| Tier | Scope | Storage | Validation Mode |
|------|-------|---------|-----------------|
| Global | Universal code patterns across all projects | CognitionNode(type=CONSTRAINT) with NegativeConstraint payload | REJECT (hard block) |
| Project | Project-specific conventions and rules | CognitionNode(type=CONSTRAINT) | WARN (soft warning) |
| Reuse | Cross-project patterns and heuristics | CognitionNode(type=INTENT or HEURISTIC) | Weight-based via traversal |

## Injection Approval Flow

All rule modifications follow this protocol:

1. Agent calls cognition_query, which implicitly creates a Proposal with TTL=5 minutes
2. User receives the proposal via cognition_query output
3. User calls cognition_approve_injection(proposalId, decision)
4. Decision is recorded in the audit log
5. If approved, the traversal or validation proceeds
6. If expired (TTL exceeded), returns -32602 with retryable:true

### TTL and Conflict Rules

- TTL = 5 minutes from proposal creation
- Only one active proposal per contextHash
- Duplicate proposals return the existing proposal
- Expired proposals can be retried

## Constraint Validation Dual-Mode

- **REJECT (Hard Block)**: The constraint violation is returned as error code -32602 with the ruleId. The agent MUST NOT proceed with the current operation.
- **WARN (Soft Warning)**: The violation is returned as part of the output. The agent may proceed with user confirmation.

## Config Hot Update

Dynamic thresholds (e.g., similarity 0.7/0.9) are stored as CognitionNode(type=HEURISTIC):

1. Agent calls cognition_update_config(key, value, expertMode=true)
2. A new config node is created with the updated value
3. The old node receives a supersededBy metadata field pointing to the new node
4. Non-expert mode calls return -32601 Unauthorized

## Audit Logging

All governance events are recorded using the MetricEvent table:

- eventType: cognition_feedback_pending, proposal_created, proposal_approved, proposal_rejected, proposal_expired
- Properties: JSON with all relevant context data
- Written asynchronously (fire-and-forget)
- On write failure, events fall back to logs/fallback.log

## Error Codes

| Code | Meaning | Retryable | Scenario |
|------|---------|-----------|----------|
| -32602 | Invalid Request | false | Missing required fields, invalid parameters |
| -32602 | Proposal Expired | true | TTL exceeded |
| -32602 | Unauthorized Injection | false | Non-expert mode config attempt |
| -32603 | Internal Error | true | Engine failure during validation or traversal |
| -32001 | Timeout | true | Graph traversal exceeded time limit |

## Response Validation Middleware

All tools/call responses are validated for Schema compliance:

- If validationRequired is missing from cognition_query or cognition_validate responses, the middleware auto-adds it with value true
- A WARN log entry is written to logs/validation-warnings.log
- This ensures Agent constraint even if the Agent ignores the Schema declaration