# Document Intelligence Pipeline — Agent Guide

Use this guide when working on document upload, vision extraction, Phase A/B/C intelligence, or Trigger.dev document/agent tasks. This is the most complex subsystem; **do not modify without understanding the full chain.**

## High-level flow

```
Upload -> Vision Extraction (15 categories) -> Phase A/B/C Intelligence
  -> Post-Processing (Cross-Reference Resolver, Drawing Schedule Parser, Fixture Extractor, etc.)
  -> Sheet Index Builder -> Quantity Calculator -> Calculated Takeoff Generator
  -> Document Detail UI, Library Badges, Search/Filter
```

## Default mode: discipline-single-pass

- Haiku classify -> Gemini 2.5 Pro vision (primary) -> GPT-5.2 rasterized JPEG (fallback) -> analyzeWithOpusFallback (Opus native PDF then rasterized image). Trigger.dev task-level retry if all fail.

## Legacy mode: three-pass-legacy (PIPELINE_MODE env)

- Gemini Pro 3 -> Gemini 2.5 Pro -> Opus interpretation -> analyzeWithSmartRouting.

## Key files (read before changing)

- **lib/discipline-classifier.ts** — Haiku classification.
- **lib/discipline-prompts.ts** — 8 discipline-specific prompts; plugin deep-extraction references when ai-intelligence submodule present.
- **lib/document-processor-batch.ts** — Pipeline orchestrator.
- **lib/vision-api-multi-provider.ts** — Provider chain and fallback functions (analyzeWithOpusFallback, analyzeWithSmartRouting).
- **src/trigger/process-document.ts** — Trigger.dev task (4 pages concurrently).

## Do not

- Send raw PDF bytes to GPT-5.2 (it only accepts images; rasterize first).
- Add retry loops inside analyzeWithOpusFallback (it is intentionally lean).
- Modify analyzeWithSmartRouting without checking its legacy callers.

## Plugin integration

When the ai-intelligence submodule is present, lib/discipline-prompts.ts appends deep-extraction rules from plugin references; lib/vision-api-quality.ts loads alert thresholds from the plugin. Both fall back to hardcoded values when the submodule is absent.

## References

- [CLAUDE.md](../../CLAUDE.md) — Document Intelligence Pipeline, Document Processing Pipeline (Critical Path).
- [AGENTS.md](../../AGENTS.md) — Document Processing Pipeline, Key Files, Gotchas (rasterizeSinglePage, VisionProvider type).
