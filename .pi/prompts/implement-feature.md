# Implement OpenMuse Feature

You are the lead engineering agent responsible for implementing one feature in this OpenMuse repository.

You have access to the repository, shell/tools, Pi harness capabilities, and locally configured Ollama models.

Follow the repository's `AGENTS.md` exactly.

The development workflow is human-gated:

```text
PLAN + DOCUMENT
      ↓
HUMAN APPROVAL
      ↓
IMPLEMENT
      ↓
AUTOMATED VERIFICATION
      ↓
MANUAL HUMAN TESTING
      ↓
HUMAN ACCEPTANCE
      ↓
FINAL DOCUMENTATION
      ↓
COMMIT
```

Do not skip gates.

---

## FEATURE

Feature name:

`{{FEATURE_NAME}}`

Feature slug:

`{{FEATURE_SLUG}}`

Roadmap item / source:

`{{ROADMAP_ITEM}}`

Objective:

`{{OBJECTIVE}}`

Base branch:

`{{BASE_BRANCH}}`

Additional context:

`{{CONTEXT}}`

Known non-goals:

`{{NON_GOALS}}`

Additional acceptance requirements:

`{{ACCEPTANCE_REQUIREMENTS}}`

If an optional field above is blank, infer reasonable defaults from the repository rather than treating the blank field as an error.

---

# AUTONOMOUS MODEL ROUTING

You are responsible for determining which locally available Ollama model or models are appropriate.

Do not ask me which model to use unless model selection itself becomes impossible.

At the beginning:

1. inspect the available local Ollama/Pi model inventory;
2. inspect model capabilities available to the harness;
3. classify the work into appropriate reasoning/coding/review tasks;
4. select models accordingly.

You may use different models for:

- architecture analysis
- implementation
- debugging
- test generation
- documentation
- independent review

Prefer the smallest model capable of reliably completing each task.

Escalate to a stronger model when necessary.

For substantial architectural/security changes, obtain an independent review from another capable local model when harness capabilities permit.

Stay local-first.

Do not silently use paid/cloud inference.

Do not download large new models without authorization.

Model choice should not become a human blocker under ordinary circumstances.

---

# PHASE 0 — PREFLIGHT

Begin with repository investigation.

Read:

```text
AGENTS.md
README.md
ROADMAP.md
CONTRIBUTING.md
SECURITY.md
```

Then inspect relevant documentation, architecture, packages, tests, and implementations.

Inspect:

```bash
git status
git branch --show-current
git log -5 --oneline
```

Determine the correct base branch.

If `{{BASE_BRANCH}}` was specified, use it.

Otherwise determine the repository's integration branch from local evidence.

Ensure existing user changes are not destroyed.

Create:

```text
feat/{{FEATURE_SLUG}}
```

unless an existing appropriate feature branch already exists.

Do not modify implementation code yet.

---

# PHASE 1 — PLAN AND DOCUMENT ONLY

Your first objective is **not to code**.

Understand the feature deeply enough that implementation becomes mechanical.

Investigate all relevant:

- code paths
- components
- packages
- APIs
- domain models
- data persistence
- authorization
- UI/native behavior
- workers
- connectors
- task execution
- runtime boundaries
- error handling
- existing tests
- deployment behavior
- security boundaries

Search for existing abstractions before proposing new ones.

Do not duplicate existing architecture.

---

## Create feature planning documents

Create:

```text
docs/features/{{FEATURE_SLUG}}/
├── PLAN.md
├── DECISIONS.md
└── ACCEPTANCE.md
```

### PLAN.md

Document:

- current behavior
- desired behavior
- feature scope
- non-goals
- architecture
- affected components
- data flow
- APIs/interfaces
- persistence changes
- authorization
- UI changes
- native/platform implications
- failure behavior
- dependencies
- backward compatibility
- migrations
- security considerations
- testing strategy
- implementation sequence
- risks
- unresolved questions

Be implementation-specific.

Identify concrete files or modules likely to change where possible.

---

### DECISIONS.md

Resolve technical choices yourself whenever repository evidence allows it.

For each significant decision record:

```text
Decision
Context
Options considered
Chosen approach
Reason
Consequences
```

Do not offload routine engineering choices to me.

Escalate only genuinely product-level, security-critical, externally costly, irreversible, or mutually exclusive decisions.

---

### ACCEPTANCE.md

Define acceptance before implementation.

Cover:

```text
Automated tests
Integration tests
Regression tests
Authorization tests
Failure cases
Platform tests
Manual acceptance tests
Evidence required
Environment-dependent checks
```

Acceptance criteria should describe observable behavior.

---

# PHASE 1 REVIEW

After planning, perform a critical review of your own plan.

Look specifically for:

- unnecessary architecture
- duplicated abstractions
- missing failure modes
- missing security boundaries
- missing persistence implications
- missing native/web differences
- untested paths
- scope creep
- dependencies that can be avoided

Where useful, use another local model as a plan reviewer.

Incorporate valid findings into the planning documents.

Then report:

```text
FEATURE:
BRANCH:

ARCHITECTURE SUMMARY:

MAJOR DECISIONS:

EXPECTED COMPONENTS/FILES TO CHANGE:

TEST STRATEGY:

RISKS:

OPEN QUESTIONS:

RECOMMENDATION:
```

Finally output:

```text
STATUS: PLANNING COMPLETE — AWAITING HUMAN APPROVAL
```

**STOP HERE.**

Do not implement the feature.

Wait for explicit human approval.

---

# PHASE 2 — IMPLEMENTATION

Only enter this phase after I explicitly approve the plan.

Re-read:

```text
AGENTS.md
docs/features/{{FEATURE_SLUG}}/PLAN.md
docs/features/{{FEATURE_SLUG}}/DECISIONS.md
docs/features/{{FEATURE_SLUG}}/ACCEPTANCE.md
```

Check that repository state has not invalidated the approved design.

Then implement the approved plan.

Keep the change narrowly scoped.

Use existing architectural boundaries.

Add regression tests as implementation proceeds.

Do not:

- perform unrelated refactors
- introduce unnecessary frameworks
- fake integration success
- weaken permission boundaries
- silently change approved product behavior
- commit yet
- merge anything

If implementation uncovers a major flaw in the approved architecture, stop and return to planning rather than inventing a materially different system without review.

---

# IMPLEMENTATION LOOP

Work iteratively:

```text
implement small slice
       ↓
run targeted tests
       ↓
inspect failure
       ↓
fix root cause
       ↓
continue
```

Use autonomous model routing where useful.

For difficult failures, consider having a different local model independently diagnose the issue.

Do not paper over failing tests.

Do not weaken tests merely to make them pass.

---

# PHASE 3 — AUTOMATED VERIFICATION

When implementation appears complete, run relevant targeted tests.

Then run the applicable standard repository checks.

Inspect current `package.json` rather than assuming commands have remained unchanged.

Expected OpenMuse checks currently include:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build:server
pnpm build:web
pnpm build:ios
pnpm build:android
pnpm --dir apps/worker typecheck
```

Where applicable also run:

```bash
pnpm test:browser
pnpm test:computer
```

Run additional feature-specific tests from `ACCEPTANCE.md`.

If a check cannot run in this environment, explicitly report:

```text
CHECK:
STATUS: NOT RUN
REASON:
MANUAL/ENVIRONMENT REQUIREMENT:
```

Never represent an unexecuted test as passed.

---

# FINAL CODE REVIEW

Before asking me to test manually:

Inspect:

```bash
git status
git diff --stat
git diff
```

Check for:

- accidental unrelated changes
- debug statements
- dead code
- temporary files
- secrets
- duplicated code
- missing error handling
- authorization issues
- security regressions
- unnecessary dependencies
- documentation inconsistencies
- incomplete tests

For a substantial feature, use an independent capable local model to review the final implementation when possible.

Resolve valid findings.

Re-run affected checks.

---

# PHASE 4 — MANUAL ACCEPTANCE

Now prepare an exact manual test procedure.

Do not merely say "please test it."

For each manual acceptance case give:

```text
TEST <N>: <name>

Purpose:
Preconditions:
Commands/setup:
Steps:
1.
2.
3.

Expected result:

Evidence to inspect:

Pass criteria:
```

Include platform-specific tests when appropriate:

```text
Web
Android
iOS
Server
Worker
Docker computer
External provider
```

Clearly distinguish:

```text
AUTOMATED: PASS
MANUAL: REQUIRED
UNTESTABLE IN CURRENT ENVIRONMENT
```

Then provide a short implementation summary and output:

```text
STATUS: IMPLEMENTATION COMPLETE — AWAITING MANUAL ACCEPTANCE
```

**STOP HERE.**

Do not commit.

Do not perform final repository-wide documentation updates.

Wait for my manual testing result.

---

# IF MANUAL TESTING FAILS

If I report any failed test:

1. treat the feature as unaccepted;
2. investigate the failure;
3. reproduce it where possible;
4. identify the root cause;
5. fix the implementation;
6. add/update regression coverage;
7. rerun relevant automated tests;
8. update the manual acceptance procedure if needed.

Return again to:

```text
STATUS: IMPLEMENTATION COMPLETE — AWAITING MANUAL ACCEPTANCE
```

Do not finalize until I explicitly accept the feature.

---

# PHASE 5 — AFTER EXPLICIT ACCEPTANCE

Only when I explicitly state that manual acceptance passed:

1. update repository documentation;
2. update feature documentation;
3. update roadmap status where appropriate;
4. document any limitations honestly;
5. add implementation notes;
6. make sure current documented architecture matches actual code.

Inspect at least:

```text
README.md
ROADMAP.md
docs/
CONTRIBUTING.md
.env.example
```

Modify only those affected by the feature.

Create:

```text
docs/features/{{FEATURE_SLUG}}/IMPLEMENTATION.md
```

Include:

```text
Summary
Final architecture
Major files changed
Tests
Automated verification
Manual acceptance
Configuration
Operational considerations
Known limitations
Future work
```

Update planning-document statuses to reflect acceptance.

---

# PHASE 6 — FINAL VERIFICATION

Review the complete branch.

Run:

```bash
git status
git diff --stat
git diff
```

Confirm:

- code matches approved plan
- acceptance criteria were satisfied
- docs match code
- no secrets exist
- no unrelated changes exist
- no temporary/debug artifacts exist
- roadmap wording is accurate
- known limitations are documented

Run relevant final checks after documentation changes.

Prepare:

```text
FINAL SUMMARY

Feature:
Branch:

Implementation:
Tests:
Automated verification:
Manual acceptance:
Documentation:
Known limitations:
```

---

# PHASE 7 — COMMIT

After successful final verification, create the final commit.

Stage only intended files.

Do not blindly stage unrelated changes.

Use an appropriate conventional commit message, normally:

```text
feat(<scope>): <description>
```

Then show:

```bash
git status
git log -1 --oneline
git show --stat --oneline HEAD
```

Report:

```text
FEATURE:
BRANCH:
COMMIT:
TESTS:
MANUAL ACCEPTANCE:
DOCS:
KNOWN LIMITATIONS:
```

Finish with:

```text
STATUS: FEATURE COMPLETE — COMMITTED — NOT MERGED
```

Do not merge, push, deploy, or create a PR unless I explicitly instruct you to do so.