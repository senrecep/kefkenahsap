
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code, or `AGENTS.md` for all other agents).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
This document outlines the implementation plan for the Kefken Ahşap Dekorasyon website. The project involves building a high-end portfolio website with an admin panel for managing projects. The website will showcase the company's 30 years of experience in wood craftsmanship.

## Technical Context
**Language/Version**: TypeScript
**Primary Dependencies**: Next.js (App Router), Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Prisma, NextAuth.js, Supabase Storage, Sharp, Sentry
**Storage**: PostgreSQL
**Testing**: To be determined, likely Jest and/or Cypress
**Target Platform**: Web (Vercel)
**Project Type**: Web Application
**Performance Goals**: Fast page loads, optimized images.
**Constraints**: None
**Scale/Scope**: A corporate website with a project portfolio and admin panel.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No violations of the constitution were found.

## Project Structure

### Documentation (this feature)
```
specs/master/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── (admin)/             # Admin routes
│   ├── dashboard/
│   └── login/
├── (public)/            # Public routes
│   ├── projects/
│   │   └── [id]/
│   ├── about/
│   └── contact/
└── layout.tsx

components/
├── admin/
├── public/
└── ui/

lib/
├── prisma/
└── utils/

prisma/
└── schema.prisma

public/
└── images/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: The project will follow a standard Next.js App Router structure.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - All unknowns were resolved by the `tech-stack.md` file.

2. **Generate and dispatch research agents**:
   - No research was needed.

3. **Consolidate findings** in `research.md` using format:
   - The `research.md` file was created to document the resolved technical context.

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - The `data-model.md` file was created with the Prisma schema for the `User` and `Project` models.

2. **Generate API contracts** from functional requirements:
   - The `contracts/API_SPECIFICATION.md` file was created with the OpenAPI 3.0 specification.

3. **Generate contract tests** from contracts:
   - This will be done in the implementation phase.

4. **Extract test scenarios** from user stories:
   - The `quickstart.md` file was created with test scenarios for public and admin users.

5. **Update agent file incrementally** (O(1) operation):
   - The `GEMINI.md` file was created.

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- The `/tasks` command will generate a `tasks.md` file with a detailed breakdown of the implementation tasks.
- Tasks will be generated based on the `data-model.md`, `API_SPECIFICATION.md`, and `quickstart.md` files.
- The tasks will be organized into epics, such as "Frontend", "Backend", and "Admin Panel".

**Ordering Strategy**:
- TDD order: Tests before implementation.
- Dependency order: Backend before Frontend.
- Mark [P] for parallel execution (independent files).

**Estimated Output**: 30-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
|           |            |                                     |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
