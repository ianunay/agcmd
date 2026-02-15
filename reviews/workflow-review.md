# Workflow & Prioritization Review

## Executive Summary

agcmd today is a **message dispatcher** — it sends text to tmux panes and hopes agents do the right thing. It has no output capture, no completion detection, no programmatic quality evaluation. Every proposed workflow must be evaluated against this fundamental constraint: **you cannot close a feedback loop you cannot observe.**

The three plans collectively propose ~14 distinct workflows. Most are aspirational. This review identifies the 2-3 that deliver real value within agcmd's architecture, and explains why the rest should wait.

---

## 1. Workflow Prioritization

### Ranking All Proposed Workflows

| Rank | Workflow | Value | Feasibility | Effort | Verdict |
|------|----------|-------|-------------|--------|---------|
| 1 | Consensus Review (Plan 1) / Build+Critique (Plan 2) | **High** | **High** | Low | **Ship first** |
| 2 | Pipeline / Sequential Handoff (Plan 1+3 "Triad") | **High** | **Medium** | Medium | **Ship second** |
| 3 | Parallel Exploration / Best-of-N (Plan 1) | **Medium** | **High** | Low | **Ship alongside #1** |
| 4 | Red Team / Blue Team (Plans 1+3) | **Medium** | **Medium** | Medium | Phase 2 |
| 5 | Plan Triangulation (Plan 2) | Medium | Medium | Medium | Phase 2 |
| 6 | Spec-to-Tests Loop (Plan 2) | Medium | Low | High | Phase 3 |
| 7 | Specialized Routing (Plan 1) | Low | Medium | Medium | Defer |
| 8 | Cascade / Cost Optimization (Plan 1+3) | Low | **Very Low** | High | **Don't build** |
| 9 | Subscription-Aware Load Balancing (Plan 2) | Low | Medium | Medium | Defer |
| 10 | Incident Triage Swarm (Plan 2) | Low | Low | High | Defer |

### The Top 3 (Ship First)

#### 1. Consensus Review — the obvious first workflow

**Why:** This is what developers actually want multi-agent setups for. "Get three opinions on my diff, see where they disagree." It's high-value, immediately understandable, and almost works today.

**What exists:** `agcmd all review-diff main..HEAD` already broadcasts the review request. The missing piece is aggregation — a command that collects the responses and surfaces disagreements.

**Incremental cost:** One new command (`agcmd compare <feature>` or `agcmd aggregate <feature>`) that reads saved review files and produces a diff of opinions. This is the "smallest useful thing" that Plan 1 failed to prioritize.

**Key constraint:** Agents must save their reviews to files (they currently respond in-pane). This means either: (a) modify the review-diff message template to include "Save your review to: {path}", or (b) add tmux pane capture as a fallback. Option (a) is simpler and consistent with how `plan` already works.

#### 2. Pipeline / Sequential Handoff ("The Triad")

**Why:** This is the second most common multi-agent pattern. "Claude designs, Codex implements, Claude reviews." Plan 3's Triad and Plan 1's Pipeline are the same idea.

**How it works with tmux:** The human runs a sequence of commands, each referencing outputs from the previous step. The file system is the handoff mechanism — Agent A saves to a file, Agent B is told to read that file.

**Example concrete flow:**
```bash
agcmd claude plan auth-feature "Design OAuth2 flow"
# Claude saves to ~/.agcmd/projects/.../plans/auth-feature/claude.md
# Human reviews, approves
agcmd codex send "Implement the plan in ~/.agcmd/projects/.../plans/auth-feature/claude.md"
# Codex implements
agcmd claude review-diff main..auth-feature
```

**What's needed:** A `workflow` command that encodes this sequence with human checkpoints between steps. Not a YAML DSL — just a hardcoded TypeScript playbook that prompts the user at each stage.

#### 3. Parallel Exploration (Best-of-N)

**Why:** "All three agents propose a solution, I pick the best one." This is trivially close to what `agcmd all plan` already does.

**Incremental cost:** Almost zero — `agcmd all plan` broadcasts, agents save to `plans/<feature>/<agent>.md`. The only missing piece is the same aggregation/comparison command from Consensus Review. These two workflows share infrastructure.

### What to Defer and Why

**Red Team / Blue Team (Phase 2):** Requires sequential coordination (Blue writes → Red attacks → Judge evaluates). This is Pipeline with role assignment. Build Pipeline first; Red Team becomes a specific pipeline configuration.

**Cascade / Cost Optimization: Don't build this.** Self-reported confidence is not a viable quality signal. LLMs are notoriously poorly calibrated when asked to rate their own confidence. You'd need programmatic evaluation (test passes, linter output, structured scoring) to make cascading work, and agcmd has none of that infrastructure. The existing reviews flagged this correctly.

**Specialized Routing:** "Route reasoning tasks to Claude, tests to Codex" sounds good in theory, but requires a task classifier — another LLM call to categorize input. This adds latency, cost, and a point of failure. Let humans route explicitly; they know what they want.

**Incident Triage Swarm:** Requires real-time coordination, blocking waits, and result aggregation — all things agcmd cannot do today. This is a v3+ feature.

---

## 2. Workflow Definition Format

### Recommendation: Hardcoded TypeScript Playbooks (Plan 3's approach)

**Not YAML. Not JSON DSL. Not yet.**

Here's the reasoning:

**Who is the user?** A developer who installed an npm CLI to talk to AI agents in tmux. They're comfortable with the terminal. They are NOT comfortable with learning a custom workflow DSL before they've even validated that multi-agent workflows are useful to them.

**The YAML DSL trap:** Plan 1 proposes a workflow definition format before there are any workflows to define. This is premature abstraction. You don't know what primitives the DSL needs until you've built 3-5 workflows by hand and found the patterns. A YAML DSL built now will either be too limited (missing primitives you discover later) or too complex (encoding every possible pattern upfront).

**The playbook approach:**
- Each workflow is a TypeScript function in `src/lib/workflows/`
- It calls existing primitives (`sendToAgent`, `savePaneMapping`, file reads)
- It has human checkpoints (`readline` prompts between steps)
- It's discoverable via `agcmd workflow list`
- It's extensible by adding new `.ts` files

**When to introduce a DSL:** After 5+ hardcoded playbooks exist, extract the common patterns into a declarative format. The DSL should emerge from real usage, not be designed upfront.

**Progression:**
1. **Phase 1:** 2-3 hardcoded playbooks (consensus-review, pipeline, parallel-explore)
2. **Phase 2:** If users want custom workflows, add a simple JSON config that parameterizes existing playbooks (e.g., which agents, in what order)
3. **Phase 3:** If there's genuine demand, extract a workflow DSL from the patterns

---

## 3. The "agcmd all" Pattern — How Much Already Works?

This is the critical question. Let's map the proposed workflows to existing commands:

| Workflow | Existing Commands | Gap |
|----------|------------------|-----|
| Consensus Review | `agcmd all review-diff main..HEAD` | Agents respond in-pane, not to files. No aggregation command. |
| Parallel Exploration | `agcmd all plan feature "prompt"` | Works! Agents save to files. No comparison command. |
| Plan Triangulation | `agcmd all plan` + `agcmd all review-plan` | Works for 2 rounds. No synthesis step. |

**The gaps are:**

1. **Review output capture:** `review-diff` and `review-plan` don't instruct agents to save responses to files. `plan` does. This inconsistency means reviews vanish into tmux scrollback. Fix: add `--save` flag or always include save-path for reviews, producing `reviews/<feature>/<agent>.md`.

2. **Aggregation command:** No command reads multiple agent outputs and presents a comparison. This is the single highest-value new command. Call it `agcmd compare <feature>` — it reads all files in a feature directory and outputs a side-by-side comparison or summary.

3. **Sequencing with checkpoints:** `agcmd all plan` then `agcmd all review-plan` requires the human to wait for all agents to finish before running the next step. There's no wait mechanism. The human has to visually check the agent panes.

**Incremental value of formalizing into workflows:** Modest for consensus and parallel exploration (they're 80% there). Higher for pipeline/sequential workflows where the ordering and checkpoints matter.

**My recommendation:** Fix the two gaps (review file saving + comparison command) before building any workflow abstraction. These gaps block the "last mile" of the already-working `agcmd all` pattern.

---

## 4. Cascade / Escalation Viability

### Short answer: No, not viable. Not with the current architecture.

**The proposed mechanism:** Start with a cheap model (Gemini), ask it to self-report confidence, escalate to Claude if confidence is low.

**Why self-reported confidence fails:**

1. **Calibration:** LLMs are systematically overconfident. A model that says "95% confident" is often wrong. There's no correlation between stated confidence and actual correctness for most coding tasks.

2. **Adversarial incentive:** If the model knows its confidence determines whether it gets replaced, there's an implicit incentive to report high confidence regardless. (This is a theoretical concern with instruction-following models, not a proven exploit, but it's directionally correct.)

3. **Format unreliability:** agcmd sends a text message and gets back unstructured text. Parsing a confidence score from free-form agent output is fragile. The agent might say "I'm fairly confident" instead of "confidence: 0.85."

**Better approaches (if you eventually want cascade):**

1. **Test-gated escalation:** Run the cheap model's output through tests. If tests fail, escalate. This requires a test runner integration, not confidence parsing.

2. **Human-gated escalation:** Show the cheap model's output. Human says "good enough" or "escalate." This is just Pipeline with a conditional branch.

3. **Structural checks:** Did the agent produce a file at the expected path? Does it parse as valid JSON/code? Is it non-empty? These are cheap, programmatic checks that don't require LLM self-assessment.

**Recommendation:** Don't build cascade. If cost optimization matters, let the human choose which agent to use per-task. `agcmd gemini send "simple task"` / `agcmd claude send "hard task"` is already cost-optimized routing — by the human.

---

## 5. Handoff Mechanism

### The Problem

Plan 3 proposes "pipe last output of Agent A as input to Agent B." But agent output lives in a tmux pane — it's not in a pipe, not in a variable, not easily captured.

### Options Evaluated

| Mechanism | How It Works | Pros | Cons |
|-----------|-------------|------|------|
| **File-based (instruct agent to save)** | Message includes "save output to {path}". Next step reads that file. | Consistent with existing `plan` pattern. Reliable. Agent-controlled. | Agent must comply. No guarantee of timing. |
| **tmux capture-pane** | `tmux capture-pane -t {paneId} -p` grabs pane content. | No agent cooperation needed. | Captures everything (prompt, noise, ANSI codes). Hard to extract just the relevant output. Pane buffer is limited. |
| **File polling** | Watch for file creation at expected path. Proceed when file appears. | Enables automation. | Adds complexity. Polling interval tradeoffs. Agent might save partial content. |
| **Shared memory file** | `.agcmd/context.md` as whiteboard (Plan 3). | Simple concept. | Write races. Prompt injection risk. No structure. Who cleans it up? |

### Recommendation: File-based handoff with a wait primitive

**The right mechanism is file-based, matching the existing `plan` pattern.** This is the only approach that:
- Works today without new tmux trickery
- Gives structured output (one file per agent per feature)
- Is auditable (files persist)
- Doesn't require parsing tmux scrollback

**What's needed:**

1. **Consistent save instructions:** Every command that expects a response should include a save path. Currently only `plan`, `ask`, and `answer` do this. Extend to `review-plan`, `review-diff`, and `send` (optionally).

2. **A wait primitive:** `agcmd wait <path> [--timeout 300]` that polls for file existence/modification. This enables scripting: `agcmd claude plan feature && agcmd wait plans/feature/claude.md && agcmd codex send "implement plans/feature/claude.md"`.

3. **Do NOT use shared memory files.** The existing reviews correctly flagged race conditions and prompt injection risks. Per-agent, per-feature files are the right granularity.

**Avoid tmux capture-pane** as a primary mechanism. It's useful as a debugging tool (`agcmd debug capture claude`) but not as a reliable handoff. tmux pane content is noisy, unstructured, and buffer-limited.

---

## 6. CLI Command UX

### Comparing the Proposed Formats

```
agcmd workflow run consensus-review main..HEAD
agcmd team run triad feature-auth "Design auth system"
agcmd playbook triad feature-auth "Design auth system"
```

### Analysis

**`agcmd workflow run consensus-review`** — Too enterprisey. "workflow run" is two words before you get to what you want. Feels like Kubernetes, not a developer CLI.

**`agcmd team run triad`** — "team" implies persistent team state (creating teams, managing members). agcmd doesn't have persistent teams; it has ad-hoc agent sessions. Misleading noun.

**`agcmd playbook triad`** — Better. "Playbook" correctly implies a predefined sequence. But it's still a new concept layered onto an already-simple CLI.

### Recommendation: Purpose-specific subcommands under the existing pattern

The current CLI shape is `agcmd <agent> <verb>`. Workflows should follow the same pattern where possible, with `all` as the natural broadcast target:

```bash
# Consensus review — just the existing pattern + file saving + comparison
agcmd all review-diff main..HEAD --save
agcmd compare review-diff           # new command: aggregate saved reviews

# Pipeline — sequenced commands, human-driven
agcmd claude plan auth "Design OAuth2"
agcmd codex send "Implement the plan at ~/.agcmd/.../plans/auth/claude.md"
agcmd claude review-diff main..auth

# Parallel exploration — existing pattern
agcmd all plan auth "Three approaches to OAuth2"
agcmd compare plan auth             # new command: compare plans
```

For multi-step orchestrated workflows that go beyond "run command, wait, run next command," add a single `agcmd run` command:

```bash
agcmd run consensus-review main..HEAD
agcmd run pipeline auth "Design and implement OAuth2"
agcmd run explore auth "Three approaches to OAuth2"
```

**Why `agcmd run <name>` instead of `agcmd workflow run <name>`:**
- One less word. Developer CLIs should minimize typing.
- `run` is a familiar verb (npm run, docker run, make run).
- The playbook name follows immediately — `agcmd run consensus-review` reads naturally.

**Discoverability:**
```bash
agcmd run --list    # show available playbooks
agcmd run --help    # explain the concept
```

**Don't over-design the command surface.** Start with `agcmd compare` and `agcmd run`. If neither gets traction, workflows aren't what users need.

---

## 7. Critical Gaps Not Addressed by Any Plan

### 7.1 Review file saving is missing

`plan` includes save instructions. `review-plan` and `review-diff` do not. This is the single biggest gap blocking the consensus review workflow. Every command that expects agent output should include a save path. This is a prerequisite for any workflow.

### 7.2 No wait/completion primitive

All three plans assume sequential steps but none address how to know when an agent is done. Without completion detection, workflows are either:
- Human-gated (human visually confirms, presses Enter to continue) — viable but manual
- Time-based (sleep 60 seconds, hope the agent is done) — fragile
- File-poll-based (check for output file existence) — most practical

A `wait` command that polls for file existence is the minimum viable completion primitive.

### 7.3 No structured output parsing

Even if agents save to files, the content is unstructured markdown. For aggregation/comparison, you need to parse "agrees: true, confidence: 0.8, blocking: false" from free-text. This is inherently fragile. Consider: instruct agents to save as JSON, or accept that comparison will be best-effort text diffing.

### 7.4 Test strategy for workflows

None of the plans propose tests for workflow correctness. At minimum:
- Unit tests for playbook step sequencing
- Integration tests with mocked tmux that verify correct message ordering
- File I/O tests that verify save paths are constructed correctly

---

## 8. Recommended Implementation Order

### Phase 1: Foundation (1-2 weeks)
1. Add save-path to `review-plan` and `review-diff` commands (writes to `reviews/<feature>/<agent>.md`)
2. Add `agcmd compare <type> <feature>` command (reads agent files, outputs side-by-side)
3. Add `agcmd wait <path> [--timeout]` primitive (polls for file existence)

### Phase 2: First Playbooks (1-2 weeks)
4. Add `src/lib/workflows/` directory with playbook runner
5. Implement `consensus-review` playbook (broadcast review → wait for files → compare)
6. Implement `pipeline` playbook (parameterized: agent A plans → human approves → agent B implements → agent C reviews)
7. Expose via `agcmd run <playbook> [args]`

### Phase 3: Iterate (ongoing)
8. Add `parallel-explore` playbook (trivial variant of consensus)
9. Add `red-team` playbook (pipeline variant with adversarial roles)
10. Evaluate whether a config-driven playbook format is needed based on user feedback

---

## 9. Summary of Recommendations

| Question | Recommendation |
|----------|---------------|
| Which workflows first? | Consensus Review + Parallel Exploration (share infrastructure), then Pipeline |
| Workflow definition format? | Hardcoded TypeScript playbooks. No YAML DSL until 5+ playbooks exist. |
| How much does `agcmd all` cover? | 80% of consensus and parallel. Gap: review file saving + comparison command. |
| Is cascade viable? | No. Self-reported confidence is unreliable. Let humans route by agent. |
| Handoff mechanism? | File-based (match existing `plan` pattern). Add `wait` primitive for polling. |
| CLI command shape? | `agcmd run <playbook>` for orchestrated workflows. `agcmd compare` for aggregation. |
| Biggest prerequisite? | Add save-path to review commands. Without this, no workflow that consumes reviews works. |
