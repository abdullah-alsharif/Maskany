For additional context about technologies to be used, project structure,
shell commands, and other additional information, read the current plan
at specs/[current-feature]/plan.md

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
