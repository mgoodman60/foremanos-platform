---
name: agent
description: List and invoke specialized agents
---

Manage and invoke ForemanOS specialized agents.

## Usage

- `/agent` or `/agent list` - List all available agents
- `/agent <name>` - Show detailed help for an agent
- `/agent <name> <task>` - Invoke an agent with a task

## Available Agents

### Development Agents

| Name | Description |
|------|-------------|
| `security` | Vulnerability scanning, OWASP analysis, auth review, injection scanning |
| `tester` | Run tests, generate tests, improve coverage |
| `fixer` | Fix build errors, bugs, dependency issues |
| `documenter` | Generate documentation for code, APIs, features |
| `database` | Prisma schema, migrations, query optimization |
| `ui` | React components, design system, accessibility |
| `ux-design` | User research, design specs, accessibility audits, user flows |

### Specialized Agents

| Name | Description |
|------|-------------|
| `stripe-expert` | Stripe payments, subscriptions, webhooks, billing |
| `pdf-specialist` | PDF processing, construction drawings, form filling |
| `refactoring-agent` | Large-scale code restructuring, pattern migrations |
| `infra-specialist` | Infrastructure, deployment, Vercel, environment config |
| `analytics-reports` | Report generation, KPI dashboards, data visualization, exports |
| `resilience-architect` | Error handling, retry strategies, graceful degradation, logging |

### Construction Domain Agents

| Name | Description |
|------|-------------|
| `project-controls` | Budget, schedule, EVM, cash flow, variance reports |
| `quantity-surveyor` | Takeoffs, pricing, symbol recognition, bid analysis |
| `document-intelligence` | OCR, RAG, document extraction, contract analysis |
| `field-operations` | Daily reports, labor tracking, weather delays |
| `data-sync` | Cross-system sync, cascade updates, data flow |
| `submittal-tracker` | Submittals, RFIs, spec compliance tracking |
| `compliance-checker` | Permits, inspections, OSHA, closeout docs |
| `bim-specialist` | Autodesk/BIM integration, clash detection, model data |
| `photo-analyst` | Field photo analysis, progress tracking, safety checks |

## Examples

```
/agent list
/agent security
/agent fixer Fix the TypeScript errors in lib/rag.ts
/agent tester Generate tests for the new budget sync feature
/agent quantity-surveyor Extract quantities from the uploaded floor plan
```

## How to Invoke

When the user specifies an agent and task:

1. Use the **Task tool** with `subagent_type` set to the agent name
2. Pass the task description as the `prompt` parameter
3. Set `run_in_background: true` for long-running tasks

Example invocation:
```
Task tool:
  subagent_type: "fixer"
  prompt: "Fix the TypeScript errors in lib/rag.ts"
  description: "Fix TS errors in rag.ts"
```

## Agent Details

To see full details about an agent, read its definition file:
- `.claude/agents/<agent-name>.md`

## Auto-Routing

Agents are also automatically selected based on keywords in user queries:
- "security audit" → security agent
- "run tests" → tester agent
- "fix bug" → fixer agent
- "generate docs" → documenter agent
- "takeoff" → quantity-surveyor agent
- "clash detection" → bim-specialist agent
- "UX audit", "user flow", "WCAG" → ux-design agent
- "report", "KPI", "dashboard", "analytics" → analytics-reports agent
- "error handling", "retry", "circuit breaker" → resilience-architect agent
