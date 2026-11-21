---
name: spec-impl-game
description: Implements an approved game spec exactly like /spec-impl (validates "Approved", creates the spec branch, implements step by step with pauses) and, once the implementation is finished, runs the skin-designer and mobile-porter agents one after the other (never in parallel) on the spec's game.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(git add:*), Bash(git commit:*), Bash(git show:*), Bash(cat:*), Bash(ls:*), Bash(npx tsc:*), Bash(npm run lint:*)
---

# /spec-impl-game — Implementer of approved game specs

Same workflow as `/spec-impl` (Phases 1–4), plus a **Phase 5** that runs `skin-designer` and then `mobile-porter` on the game once the implementation is done.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Workflow config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "No config file — defaults apply: AutoCreateBranch: true, AutoCommitSteps: false"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name (`01-mvp-arkanoid`), only the number (`01`), or only the slug (`mvp-arkanoid`). Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The header label is typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match by position (status line near the top of the spec) and by the surrounding state machine, not by the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, or any unrecognized value) means **stop** and show the error message below.

| State category                            | Examples (any language)                           | Action                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

0. **Check the working tree first.** Look at the `git status --short` output in the session context above. If it is **not empty**, stop and show the pending changes, then ask:

   ```
   ⚠️ There are uncommitted changes in the working tree.
   Switching branches would carry them over. What do you want to do?
     1. Commit or stash them yourself, then re-run this command  (recommended)
     2. Continue anyway — the changes travel to the new branch
   ```

   Wait for the answer. **Do not stash or commit on the user's behalf** unless they explicitly ask for it. If the working tree is clean, skip straight to step 1 without mentioning it.

1. Derive the branch name from the spec file's full name, without the extension. Format: `spec-NN-slug`. Examples:

   - `01-mvp-arkanoid.md` → branch `spec-01-mvp-arkanoid`
   - `02-powerups.md` → branch `spec-02-powerups`

2. Read the `AutoCreateBranch` flag from the **Workflow config** shown in the session context above.

   - If the config file does not exist, the value is missing, or the value is unrecognized → treat it as `true` (the default).
   - Only an explicit `false` (in any capitalization) disables automatic branch creation.

   **If `AutoCreateBranch` is `true` (default):** proceed without asking.

   - If the branch **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: this means previous work is being resumed. Switch to it, read `git log --oneline` on the branch, and tell the user which steps of the plan already look done and which step you propose to resume from. Commits named `spec-NN-step-MM` (created when `AutoCommitSteps` is `true`) mark exactly which steps are finished. Wait for confirmation on the resume point before implementing anything.
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change was successful before continuing.

   **If `AutoCreateBranch` is `false`:** ask before touching git. Show:

   ```
   AutoCreateBranch is set to false.
   Create and switch to the branch spec-NN-slug? [y/N]
   ```

   - If the user answers **yes**: create/switch to the branch exactly as in the `true` case above.
   - If the user answers **no** or leaves it empty: **do not create any branch.** Tell the user you will implement on the current branch (the one shown in the session context above) and ask for explicit confirmation to continue there. Do not improvise — wait for the answer.

3. Visually confirm to the user the spec is ready and which branch is active:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)   (← or the current branch, if no new branch was created)
   State:  Approved   (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be authored in any language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.
Each step will be committed as spec-NN-step-MM.   (← only if AutoCommitSteps is true)
When the last step is done I will run skin-designer and then mobile-porter, one after the other.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do not start without it.

Once confirmed, follow these rules during the entire implementation:

**Committing is controlled by the `AutoCommitSteps` flag** in the **Workflow config** shown in the session context above. If the config file does not exist, the value is missing, or the value is unrecognized → treat it as `false` (the default). Only an explicit `true` (in any capitalization) enables per-step commits.

- **`AutoCommitSteps: false` (default) — never commit automatically.** Not per step, not at the end. You write the code and show the diff; committing is the user's decision and the user's command. Only commit if they explicitly ask you to.
- **`AutoCommitSteps: true` — commit each step as soon as it is finished**, before pausing for review:
  - Stage only the files you created, modified or deleted in this step: `git add -- <file> <file> …`. Never use `git add -A` or `git add .` — they could sweep in changes that do not belong to the step.
  - Commit with the message `spec-NN-step-MM` and nothing else (no description, no body). `NN` is the spec number and `MM` is the step number from the implementation plan, both zero-padded to two digits. Example: step 3 of `01-mvp-arkanoid.md` → `spec-01-step-03`.
  - If the user asks for adjustments to the step while reviewing it, apply them and fold them into the same commit (`git add -- <files>` + `git commit --amend --no-edit`), so each step stays a single commit. Only ever amend the commit of the step currently under review, never an earlier one.
  - If the commit fails (e.g. a pre-commit hook rejects it), stop and show the error. Never bypass hooks with `--no-verify`.
  - Never push.

**One rule above all:** implement what the spec says. If something in the spec looks suboptimal to you, mention it as an observation but implement what was agreed. Changes to the spec go into the spec, not into the code by surprise.

**Work rhythm:**

- Implement one step of the plan.
- If `AutoCommitSteps` is `true`, commit the step as described above.
- Show a summary of which files you touched and what you did. If you committed, add the commit line: `Committed as spec-NN-step-MM (<short hash>)` — the user can review it with `git show HEAD`.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step:** do NOT yet tell the user to verify acceptance criteria or mark the spec as `Implemented`. Say:

```
✅ All steps of the plan are implemented.

Next: Phase 5 — I will run skin-designer and then mobile-porter on the game.
```

and continue to Phase 5 (no extra confirmation needed, unless Phase 5.0 requires a decision).

---

### Phase 5 — Game post-implementation: skin-designer, then mobile-porter (sequential)

**These two agents must run strictly one after the other, never in parallel.** Both edit `ENGINES.<id>` in `app/lib/games/registry.ts` (`controls` vs `touch`), so running them together would cause conflicting edits. Launch each with a **single** `Agent` call in its own message, wait for its completion notification, and only then proceed. Never set `isolation: "worktree"`: their changes must land on the active spec branch.

#### 5.0 — Determine the game id

- Derive `<game-id>` from the spec (file name such as `09-snake-game-integration` → `snake`, or the id the spec registers in `ENGINES`).
- Verify it exists as a key of `ENGINES` in `app/lib/games/registry.ts`.
- If there is no clear game id, or it is not in `ENGINES` (the spec is not a game spec, or the game is still simulated): say so, ask the user for the id or whether to skip Phase 5, and **do not launch any agent by assumption**. If they skip, go to 5.3 without agents.

Tell the user: `Launching skin-designer for <game-id>; mobile-porter will go after it finishes.`

#### 5.1 — skin-designer

Call `Agent` with `subagent_type: "skin-designer"`. The prompt must include: the `<game-id>`, the spec path, the active branch, and the reminder that it only touches `app/games/<game-id>/` and that game's `controls` entry in `ENGINES`, and never commits.

- **Wait for it to finish.** Do not launch anything else meanwhile.
- Summarize its report to the user (audit, skins added, selector key, contrast check).
- If it asks a question (e.g. the game already has skins) or fails: stop, show it to the user, and do **not** go to 5.2 until it is resolved.
- If `AutoCommitSteps` is `true`: stage only the files it changed (`git add -- <files>`) and commit as `spec-NN-skins`. If `false`: do not commit.

#### 5.2 — mobile-porter

Only after 5.1 has completed successfully. Call `Agent` with `subagent_type: "mobile-porter"`. The prompt must include: the `<game-id>`, the spec path, the active branch, a note that skin-designer already modified `ENGINES.<game-id>.controls` and the engine's skins (it must not overwrite them), and that it never touches engines, specs or Supabase and never commits.

- **Wait for it to finish.** Summarize its report (`touch` entry, mobile CSS, verification at 390×844 / 360×740 / 1280, regression on the other engines).
- If it asks a question or fails: stop and show it to the user.
- If `AutoCommitSteps` is `true`: stage only the files it changed and commit as `spec-NN-mobile`. If `false`: do not commit.

#### 5.3 — Wrap-up

Run `npx tsc --noEmit` and `npm run lint`. Report the result faithfully (if something fails, show the output). Then tell the user:

```
✅ Spec implemented, skins added and mobile version applied.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" (or the equivalent
in your repo's language) and make the final commit before merging this branch.
```

Never mark the spec as `Implemented` yourself and never push.

---

## Summary of expected behavior

```
/spec-impl-game 12-frogger-game-integration   (state: Approved)

  Phase 1  →  Finds the spec
  Phase 2  →  State "Approved" → ✅ continues
  Phase 3  →  Creates/switches to spec-12-frogger-game-integration, shows the summary
  Phase 4  →  Implements step by step with pauses
  Phase 5  →  Game id → skin-designer (wait) → mobile-porter (wait) → tsc + lint
              Reminds to verify the acceptance criteria

/spec-impl-game 02-powerups  (state: Draft / Borrador)

  Phase 2  →  ❌ stops with the standard error message. No branch, no code, no agents.
```

Branch creation (`AutoCreateBranch`, default `true`) and per-step commits (`AutoCommitSteps`, default `false`) are controlled by `specs/.spec-config.yml`, exactly as in `/spec-impl`.
