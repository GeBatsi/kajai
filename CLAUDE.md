# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. KajAI Project Context

### Stack
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL (primary), Redis (cache/sessions)
- **Search:** Meilisearch
- **AI:** OpenAI GPT-4o
- **Target market:** Hungary 🇭🇺

### Monorepo structure
```
kajai/
├── frontend/    # Next.js 14+
├── backend/     # NestJS
└── shared/      # shared types/utils
```

### User roles
`guest` → `registered_user` → `moderator` → `admin`  
Never add permissions outside this hierarchy without explicit confirmation.

### Data model rules
- The core entities are: User, FoodItem, Recipe, RecipeIngredient, MealLog, MealLogEntry, NutritionGoal, Badge, UserBadge, Notification, PriceData, FoodItemAlias, Review, Tag
- `RecipeIngredient` is **self-referential** (nested sub-recipes) — treat with extra care, never flatten without asking
- Hungarian food names and aliases are authoritative; do not rename or translate them
- `PriceData` is sourced from `arfigyelo.gvh.hu` (Hungarian government price monitoring) — treat as read-only external data

### Jira / Atlassian
- Project key: `KAI`
- Cloud: `gebatsi.atlassian.net`
- Jira issue descriptions use **ADF format** (`contentFormat: "adf"`) — never write plain markdown into description fields
- Acceptance criteria live under `### ✅ Elfogadási kritériumok` as ADF taskList nodes

### Language & communication
- Code, comments, and commit messages: **English**
- User-facing UI strings: **Hungarian**
- When in doubt about a Hungarian term or food name, ask — do not guess or translate

### Critical rules
- Never modify the data model (entities, relations, column names) without explicit confirmation
- Never bypass the NestJS Guard/Role system — always implement auth via existing decorators
- Never hardcode API keys, secrets, or credentials — use environment variables (`.env`)
- Never push directly to `main` — all changes go through PRs
- Always validate Hungarian-specific inputs (e.g. postal codes, phone numbers) with HU locale rules
