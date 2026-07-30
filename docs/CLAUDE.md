# Lacertosus Office OS

## Product goal
Build a simple, premium and desktop-first operations platform for the
Lacertosus Marketing and E-commerce office.

## Core principles
- Simplicity before feature quantity.
- No page should require training to understand.
- Maximum six task statuses.
- Every task has one primary owner.
- Use progressive disclosure for advanced options.
- Desktop-first, fully responsive.
- Use Lacertosus orange only for primary actions and highlights.
- Do not introduce dependencies without explaining why.
- Do not change database migrations already applied.
- Never bypass Supabase Row Level Security.
- Never expose service-role credentials in client code.

## Stack
- Next.js App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- Motion
- Supabase
- Zod
- React Hook Form
- Vitest
- Playwright

## Workflow
1. Read relevant documentation.
2. Inspect existing implementation.
3. Produce a concise implementation plan.
4. Implement one bounded feature.
5. Run lint, typecheck and tests.
6. Review responsive behavior.
7. Update documentation.
8. Commit with a descriptive message.

## UI rules
- Avoid excessive gradients.
- Avoid oversized cards.
- Avoid unnecessary modals.
- Prefer side panels for task details.
- All forms need loading, success, empty and error states.
- All interactive elements must be keyboard accessible.
