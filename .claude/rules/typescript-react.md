---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript & React rules
- Strict mode. Never use `any` — use `unknown` and narrow with type guards.
- Use `interface` for object shapes, `type` for unions and intersections.
- Validate ALL external data with Zod (API responses, Gemini output, user input).
- React: one component per file, default export, functional only.
- Extract complex logic into custom hooks (src/hooks/).
- TailwindCSS utility classes only, no inline styles, no CSS-in-JS.
- Keys: stable unique IDs (item.id), never array index.
- Error boundaries around: Gemini-dependent components, camera/scanner, image upload.
- Use discriminated unions for async state:
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }
- Prefer `const` assertions and `satisfies` operator for type narrowing.
- Use `React.lazy()` + `Suspense` for route-level code splitting.
- Image components: always include alt text, use loading="lazy" for below-fold images.
