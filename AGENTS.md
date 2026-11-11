# Chemical X Agent Directives: Zombie Survival

> Mandatory architectural and operational directives for AI agents operating on Zombie Survival.
> Strictly enforce these standards on every code generation, refactor, and review pass.

---

## ⚡ Quick Agent Reflex Table (Mandatory Token-Bounded Operations)

> **MANDATORY**: Agents MUST invoke the unified master tool `chemx` (MCP tool `chemical-x` / `chemx` or CLI `pnpm chemx <cmd>`) instead of primitive commands (`cat`, `sed`, `grep`, `vitest`, `tsc`). Always pass `projectRoot` on MCP calls (`/home/xopher/www/x/Xophz-COMPASS/apps/zombie-survival`).

| Standard Reflex | `chemx` Equivalent | Token & Architecture Advantage |
| :--- | :--- | :--- |
| `grep -rn "pattern" .` | `chemx q -g "pattern" --bare` or MCP `{ action: "q", params: { query: "pattern", literal: true, bare: true } }` | Fixed-string search matching rg token-for-token. Add `context: 3` to inspect surrounding code in one turn without extra read calls. Zero bloated text dumps. |
| `sed -n 'N,Mp' <file>` / `cat <file>` | `chemx read <file>:N-M --bare` or MCP `{ action: "read", params: { path, startLine: N, endLine: M, bare: true } }` | Verbatim slice matching sed byte-for-byte; 0 header, box or line number tokens. `--bare` never truncates or injects outline scaffold on targeted slices. |
| Inspecting signatures | `chemx read <file> --outline` or MCP `{ action: "read", params: { path, outline: true } }` | AST signatures only. Extracts signatures at 90%+ token reduction compared to full file content. |
| Inspecting declaration | `chemx read <file> --symbol=<name>` or MCP `{ action: "read", params: { path, symbol: "<name>", bare: true } }` | Surgical AST symbol extraction without loading surrounding boilerplate. |
| `git diff` | `chemx d` or MCP `{ action: "d" }` | Zero-context (`-U0`), auto-collapses to `--stat` if > 80 lines, micro-syncs search index. |
| `find . -name "*.ext"` | `chemx f "*.ext"` or MCP `{ action: "f", params: { filter: "*.ext" } }` | Strictly filters by `.gitignore` and ignored dirs with zero unconstrained directory walking. |
| `git log` | `chemx log -n 5` or MCP `{ action: "log", params: { args: ["-n", "5"] } }` | Compact single-line commit history (roughly 28 tokens per commit). |
| `cat package.json` | `chemx p -s` / `chemx p <script>` or MCP `{ action: "p", params: { query: "-s" } }` | Script or dependency extraction without loading large JSON files. |
| `cat <data.json>` | `chemx j <file.json>` or MCP `{ action: "j", params: { path } }` | Structural schema shape only; collapses repeating arrays and large objects. |
| `npm run typecheck` / `tsc` | `chemx typecheck` or MCP `{ action: "typecheck" }` | Structured JSON diagnostics without verbose terminal output. |
| `npm run build` / `vite build` | `chemx build` or MCP `{ action: "build" }` | Structured output with timing, exit code, and categorized error diagnostics. |
| `npm test` / `vitest` | `chemx test` or MCP `{ action: "test", params: { testTarget } }` | Summary on success, targeted failing diffs on failure. |
| Multi-file file edits | `chemx patch` or MCP `{ action: "patch", params: { path, search, replace } }` | Single-turn atomic AST parse check, line budget enforcement, and zero-leak patch. |
| File locking | `chemx team lock acquire <file>` or MCP `{ action: "team_lock", params: { action: "acquire", filePath, agentId } }` | Atomic coordination in shared-main repository to prevent concurrent edit clobbering. |

---

## 1. System Directives: Token & Context Optimization

### [1] DO (Mandatory Execution)
* **Formatting:** Use brief, nested bullet points. Output data strictly in compact formats (CSV/minified JSON).
* **Constraints:** Enforce strict numerical limits (e.g., "list 2", "under 50 words").
* **Processing:** Skip explanations/reasoning unless explicitly requested. Halt immediately on first error or blocker.
* **Batching:** Combine multiple micro-tasks into single prompts.
* **Status Updates:** Summarize all actions and thoughts strictly via nested bullets.
* **Context Mgt:** Initiate new threads for domain shifts. Boot new threads using compact initialization blocks, never historical chat dumps.
* **Targeting:** Request isolated diffs, patch formats, or specific function replacements for large file edits.
* **Strict Patching:** Use standard SEARCH/REPLACE blocks or unified diffs for file modifications to avoid rewriting unchanged code.
* **Fail Fast & Query:** If an instruction is ambiguous, ask a single clarifying question rather than guessing and generating an extensive, incorrect implementation.
* **Silent Corrections:** When correcting an error, output only the fix. Skip all apologies and acknowledgments.
* **Atomic Commits:** Break large architectural changes into sequential, single-step prompts rather than requesting monolithic, multi-file refactors.

### [2] DO NOT (Strict Prohibitions)
* **Output Bloat:** No conversational filler, pleasantries, apologies, intros, or outros. No echoing the original prompt. No paragraph-form narrations of process.
* **Input Bloat:** Do not feed entire documents or logs; manually extract targeted snippets.
* **Tooling:** No commands yielding massive text outputs. No broad, unconstrained directory searches.
* **Queries:** No open-ended questions if a direct "yes/no" or single-word answer suffices.
* **Degradation:** Do not prolong a bloated thread if context is slipping. Request a compressed state summary and reboot in a fresh chat.
* **Speculative Generation:** Never implement features, UI elements, or error handling that were not explicitly requested (YAGNI).
* **Disclaimers:** Never include AI safety disclaimers, ethical framing, or "As an AI..." explanations.
* **Lazy Placeholders:** Do not use `// ...` or similar placeholders unless the patching system explicitly supports it.
* **Formatting Overhead:** Avoid excessive Markdown (like nested tables or heavy bolding/italics) when plain text or code blocks suffice.
* **No Em Dashes:** Never use em dashes in code, copy, or markdown text. Use standard punctuation or rewrite sentences to flow without them.

---

## 2. Environment & Tooling: The ChemX Master Gateway

* **Master Gateway Rule**: When operating inside environments with per-tool permission controls (e.g., Google Antigravity, Claude Desktop, Cursor), AI agents MUST invoke the unified master tool `chemx` rather than invoking fragmented tools or dropping down to bash subshells.
* **Antigravity Tool Mapping**: In Google Antigravity, `chemx` is registered under server name `chemical-x` (`call_mcp_tool` with `ServerName: "chemical-x"`, `ToolName: "chemx"`). Always pass `projectRoot: "/home/xopher/www/x/Xophz-COMPASS/apps/zombie-survival"`.
* **Strict Ban on Primitive Inspection**: Never use raw `sed`, `grep`, `head`, `tail`, `cat`, or full-file viewers when inspecting code. Always use `chemx` with `action: "read"` (`outline`, `symbol`, or line slices) or `action: "q"`.
* **Verification Through chemx**: Never run unthrottled `vitest` or `vue-tsc` in bash subshells. Route through `chemx({ action: "typecheck" })`, `chemx({ action: "verify" })`, or `chemx({ action: "test" })`.

---

## 3. Architectural Hierarchy (Component Design)

Enforce strict boundaries for component complexity. Files must remain lean (max 300-500 lines). Break down logic and UI into clear structural tiers:
* **Atoms / Foundations:** Single, foundational UI elements. (The ONLY tier where raw DOM/HTML elements are permitted).
* **Molecules / Blocks:** Groups of foundational elements. (NO raw elements).
* **Organisms / Modules:** Complex groupings of components. (NO raw elements).
* **Templates / Layouts:** Structural blueprints for pages. (NO raw elements).
* **Views / Pages:** High-level components that implement layouts and inject state.

---

## 4. State Management & Data Flow

* **Single Source of Truth:** Rely strictly on the project's primary state management architecture or engine. NEVER duplicate global state or core business logic locally.
* **Direct Rendering:** Render directly from the established state objects, stores, or context providers.
* **No Mirroring:** Do not create custom hooks or local variables that store, mirror, or mutate data that is already handled by the core data engine.

---

## 5. Code Syntax & Formatting Patterns

* **Self-Documenting Code:** Minimize inline comments; rely on explicit, readable variable naming.
* **Precise Naming Conventions:** Use adjective and verb-nouns. Keep names precise and quick to read.
* **Explicit Conditionals:** Always abstract complex logic into named boolean variables before evaluation.
* **Deconstruct & Extract:**
  * Destructure primitives at the top of the scope if used more than twice.
  * Extract common groups of values into shared arrays or constants.
  * Use the spread operator to compose complex structures from shared patterns.
* **Named Callbacks:** Extract anonymous functions into named variables before passing them as arguments.
* **Zero-Lag Derivation:** Avoid unnecessary memoization for simple object mappings or derivations from stable references unless addressing a proven performance bottleneck.

---

## 6. Two-Stage Boolean Logic Example

Always name conditionals and anonymous functions into readable variables:

```typescript
// Good: Named callbacks and extracted logic
const isRecentlyActive = (user: User): boolean => user.lastLogin > Date.now() - 86400000;
const isActiveAdmin = (user: User): boolean => user.status === 'active' && user.role === 'admin' && isRecentlyActive(user);

const activeAdmins = users.filter(isActiveAdmin);
```
