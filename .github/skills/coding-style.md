---
description: Use when writing or reviewing Python, JavaScript, HTML, or CSS code in this project.
---

# Coding Style

## Python
- Targets Python 3.8+.
- Keep functions small, use clear exceptions, and follow existing snake_case naming.

## JavaScript
- Uses modern syntax (const/let, arrow functions) and camelCase naming.
- Keep functions small to match existing modules.
- When adding new JS modules, update imports so `DependencyProcessor` can resolve module order; all dashboard JS is bundled into one script at generation time.

## HTML
- Keep markup semantic and accessible; keep it minimal and label form controls in templates.

## CSS
- Use existing class conventions (Bootstrap/Datatables) and keep selectors shallow.
- Prefer CSS variables for theme values.

## General
- Update docs in `docs/` when user-facing behavior changes.
