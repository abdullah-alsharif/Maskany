For additional context about technologies to be used, project structure,
shell commands, and other additional information, read the current plan
at specs/[current-feature]/plan.md

## Prompt Template Registry

AI prompts are managed as versioned, locale-specific templates in
`apps/api/src/services/prompts/`. Key files:

- **`templates/`**: JSON template files (e.g., `enhance-en-v1.json`, `review-ar-v1.json`)
  defining sections, weights, conditions, and system prompts.
- **`sections/`**: Renderers that produce section content from context data.
- **`examples/`**: Few-shot example JSON files per category+locale.
- **`registry.ts`**: `PromptTemplateRegistry` class with `render()`, version lookups,
  token estimation, conditional sections, and token budget pruning.
- **`types.ts`**: `PromptTemplate`, `TemplateSection`, `RenderContext`, `RenderResult` types.

The `ai-prompt-builder.ts` delegates system prompts to the registry while
keeping some user-prompt construction inline. Version info flows through
`BuiltPrompt.templateId` / `templateVersion` / `sections` for observability.

<!-- BEGIN coding-harness-managed -->

## Spec-Driven Development

This project follows the coding-harness spec-driven pipeline by default:
`specify → plan → tasks → test → implement`. New features and non-trivial
changes should go through this pipeline (starting with `/speckit-specify`)
rather than being implemented directly, unless the user explicitly asks to
skip it. Full governance rules are in `.specify/memory/constitution.md`.

Managed by coding-harness/install.sh — do not edit this section manually.
Re-run install.sh after updating the harness to keep this section current.
<!-- END coding-harness-managed -->
