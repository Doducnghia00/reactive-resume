# Applications Tracker — Roadmap & Status

**Status legend:** ✅ done · 🟡 in progress · ⬜ not started · 🧊 deferred (intentional, revisit when needed)

A job-application tracker built inside Reactive Resume. Each application points at the live
resume the user sent (`resumeId`), which is why it lives in-product rather than a generic
tracker. Built from the claude.ai/design prototype "Applications Tracker.dc.html".

Owner dirs: `packages/db/src/schema/applications.ts`, `packages/schema/src/applications/`,
`packages/api/src/features/applications/`, `apps/web/src/features/applications/`,
`apps/web/src/routes/dashboard/applications/`.

---

## Phase 0 — Core slice ✅ (shipped)

The working vertical slice: data model, CRUD, board, add/detail panels. Zero new deps.

- ✅ DB: `application` table (user FK cascade, `resumeId` FK set-null, JSONB `contacts`/`activity`, follow-up + AI-reservation columns). Migration `20260705090711_third_hercules`.
- ✅ Schema: `applicationStatusSchema`, `STAGES` (value/label/color), `contactSchema`, `activityEventSchema`, `aiMetadataSchema`.
- ✅ API: oRPC `applications.{list,getById,create,update,addNote,delete}` — `protectedProcedure`, `userId`-scoped via one `requireOwned`; `update` auto-logs stage-change activity.
- ✅ Web: sidebar nav item; `/dashboard/applications` route (empty state ↔ board).
- ✅ Board: dnd-kit drag across 6 fixed stages, optimistic move + rollback toast.
- ✅ Add slide-over: manual entry + link a live Reactive Resume; native date follow-up.
- ✅ Detail slide-over: key facts, stage stepper, linked resume, contacts, follow-up, activity timeline + add-note, archive/delete.
- ✅ Unit test: activity-logging path (`service.test.ts`). Typecheck / boundaries / biome clean.

**Known small gaps — now closed (✅):**
- ✅ Lingui messages extracted (`pnpm --filter web lingui:extract`) so the new `<Trans>`/`t` strings are translatable.
- ✅ Board caps rendered cards per column (`COLUMN_PAGE_SIZE = 50`) with a "Show N more" button, so a stage with hundreds of applications doesn't mount hundreds of draggable nodes. Server-side paging still unneeded (list payload is small).
- ✅ Contacts are editable from the Detail panel (`ContactsEditor`): add name/role/label, remove, persisted via API `update`'s existing `contacts` field.

---

## Phase 1 — Table view + Insights ✅ (shipped)

- ✅ **Table view** — paginated table (25/page), row selection + bulk actions (move stage, add tag, archive, delete). Added a wrapped `Checkbox` in `packages/ui`; hand-rolled table (no `@tanstack/react-table` dep). Board/Table/Insights toggle via URL `view` search param.
- ✅ **Insights view** — stat tiles, pipeline funnel (conversion per stage), source bars, and a shareable **funnel-flow SVG** with PNG export (canvas, no chart lib — kept the zero-dep property). Server aggregation `applications.stats` (per-stage/per-source counts); funnel/tiles derived client-side via `computeInsights()` (unit-tested).
- ✅ Tags: `tags text[]` column + filter UI + bulk "add tag" + `applications.tags` distinct list.
- ✅ Archived-toggle so archived rows can be reached and unarchived (closes the archive loop).

## Phase 2 — Campaigns + import + uploads ✅ (shipped)

- ✅ **Campaigns** — the `campaign` text field is now first-class: set on create (with a native `<datalist>` autocomplete of existing campaigns), filter on board/table, per-campaign Insights scoping, and an `applications.campaigns` distinct-with-counts endpoint. (Kept it a text field, not a table — grouping/filtering/insights work without the join-table overhead.)
- ✅ **CSV import** — `Import CSV` opens a slide-over: paste rows or upload a `.csv`, a zero-dep parser (`csv.ts`, unit-tested) maps aliased headers (Company/Role/Stage/Salary/Source/Tags/…), previews recognized columns + ready/skipped counts, then bulk-creates via `applications.import` (max 500, each row gets a `created` activity event). Verified end-to-end in the browser.
- ✅ **Cover-letter upload** — `coverLetterUrl`/`coverLetterName` columns; the detail panel's Documents section attaches a PDF via the existing `orpc.storage.uploadFile`, shows a download link, and supports removal.

---

## Phase 3 — AI agent integration ✅ (shipped, verified live)

All four `applications.ai.*` procedures are implemented (`packages/api/src/features/applications/ai.ts`), resolving the user's default provider via `aiProvidersService.getDefaultRunnable` → `getModel` → `generateText`, with tolerant JSON parsing. Rate-limited via `aiRequestRateLimit`.

- ✅ **Job-posting autofill** — paste a URL → server fetches + strips the page → LLM extracts company/role/location/salary/jobDescription → prefills the Add form. (`jobDescription` is now a user-editable field so it persists for match/tailor.)
- ✅ **Resume↔job match score** — scores the linked resume vs the job description, persists `matchScore` + gaps in `aiMetadata`. Rendered as a **fit ring** in the redesigned copilot.
- ✅ **Tailor resume** — one-shot: duplicates the linked resume, regenerates a job-tailored `summary`, links the copy to the application, logs a timeline event. (No agent/REDIS dependency.)
- ✅ **Draft cover letter / follow-up** — generates from application + resume context; shown inline with copy/dismiss.
- ✅ **UX**: the AI section was redesigned into an **"Application Copilot"** module — a resume-fit ring (band-colored) as the signature element + a capability menu (icon + title + description) instead of plain buttons.

Verified live against a real OpenAI provider (autofill, match score, tailor resume).

### Extra polish shipped alongside (from review + user requests)
- ✅ **Edit an application** — the Add sheet became `ApplicationFormSheet`, edit-capable; reachable from the detail-panel "Edit" button and the context menu.
- ✅ **Context menus** — kebab "⋯" on board cards (hover) and table rows: Edit / Move to ▸ / Archive / Delete (`application-actions-menu.tsx`).
- ✅ Review fixes: bulk stage-moves log activity; single-statement note append; "Mark rejected" + "no results" states; CSV BOM strip + 500-row cap + file-input reset.

### ✅ Cover-letter upload (re-enabled)
Un-deferred. The blocker was `storage/service.ts` hardcoding a `.jpeg` key for every upload, so a PDF was read back as an image. Fixed by deriving the key extension from the content type the router already passes (`buildFileKey` + `EXTENSION_BY_CONTENT_TYPE`) — images stay `.jpeg` (unchanged for avatars), PDFs get `.pdf` and the static handler's existing `.pdf` force-download path serves them correctly. Re-added `coverLetterUrl`/`coverLetterName` columns (migration `20260705125353_yielding_star_brand`), DTO editable fields, and a Documents-section upload/download/remove in the detail sheet (PDF-only, best-effort `storage.deleteFile` on remove). Link-to-Reactive-Resume remains the primary document feature; the cover letter sits alongside it.

---

## (historical) Phase 3 plan — reservations in place, no model wired yet

Reservations already shipped: schema fields (`sourceUrl`, `jobDescription`, `matchScore`,
`aiMetadata`) and stubbed `applications.ai.*` procedures that throw `NOT_IMPLEMENTED`
(`packages/api/src/features/applications/ai.ts`). Each stub below just needs its handler
implemented against `@reactive-resume/ai` and the existing agent/thread tables
(`agentThread`, `agentAction` in `packages/db/src/schema/agent.ts`).

- ⬜ **Job-posting autofill** (`applications.ai.autofill`) — fetch `sourceUrl` (or accept pasted text) → LLM extracts company/role/location/salary/jobDescription → return a prefill object for the Add form; persist raw extraction in `aiMetadata`. UI: enable the disabled "Auto-fill" button in `add-application-sheet.tsx`.
- ⬜ **Resume ↔ job match score** (`applications.ai.matchScore`) — compare the linked resume's data against `jobDescription` → write `matchScore` (0–100) + a gap list into `aiMetadata`. UI: surface a score badge on the card + a gaps section in the Detail panel.
- ⬜ **Tailor resume for this job** (`applications.ai.tailorResume`) — spawn an agent thread that duplicates the linked resume and edits it for the posting (reuse the agent JSON-patch pipeline); link the new `resumeId` back to the application and log a timeline event.
- ⬜ **Cover-letter / follow-up drafting** (`applications.ai.draftMessage`) — generate a cover letter or recruiter follow-up from application + resume + contact context. UI: the disabled "AI actions" block in `application-detail-sheet.tsx`.
- ⬜ **Rate-limiting & provider check** — reuse `aiRequestRateLimit` (already exists) and gate on a configured AI provider (`aiProviders` table) before calling any of the above.

**Suggested order:** autofill (highest user value, self-contained) → match score → draft
message → tailor resume (most complex, depends on the agent pipeline).

---

## Verification (each phase)
- `pnpm --filter @reactive-resume/api test` + `typecheck`, `pnpm --filter web typecheck`, `pnpm exec turbo boundaries`, `pnpm check`.
- DB changes: `dotenvx run -f .env.local -- pnpm db:generate` → review SQL → `pnpm db:migrate`.
- Manual: `dotenvx run -f .env.local -- pnpm dev` (:3000) → exercise the new surface end-to-end.
