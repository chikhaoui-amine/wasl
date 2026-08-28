# Money Accounts & Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Accounts and Cards management with dynamic ledger calculations, account-to-account transfers, card filtering, and MCP parity in WASL Local and WASL Cloud.

**Architecture:** Extend the Money domain (`lifeos-money`) with an `Account` entity, bump store version from 3 to 4 with a pure migration handler, integrate dynamic ledger balance math across incomes/expenses/transfers, update strict Zod validation schemas and backups, align MCP tools in both editions, and build a modern card-deck UI with account filtering on the Money page.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Dexie / IndexedDB (Local), Supabase Postgres (Cloud), Vitest, Zod.

## Global Constraints
- Dual-Edition Development Rule: Every change must be applied and tested in both `/home/amine/wasl-local` and `/home/amine/wasl-cloud`.
- Local edition must remain 100% offline, zero-auth, and zero-network credentials.
- Zero Data Loss: Pure migration in `lib/data/migrations.ts` ensuring backward compatibility for existing money stores.
- MCP parity across `packages/wasl-mcp-local/src/tool-definitions.ts`, `lib/relay/local-executor.ts`, and `lib/ai/tools.ts`.
- Strict schema validation in `domain-schemas.ts` and schema-drift test compliance.

---

### Task 1: Domain Types, Pure Operations, and Ledger Calculations

**Files:**
- Modify: `lib/data/domains/money/types.ts`
- Modify: `lib/data/domains/money/operations.ts`
- Modify: `lib/data/domains/money/utils.ts`
- Modify: `lib/data/domains/money/index.ts`
- Test: `lib/data/domains/money/money.test.ts`

**Interfaces:**
- Produces: `Account`, `AccountType`, `AccountInput`, `Txn` (with `accountId`, `transferAccountId`), `addAccountOperation`, `updateAccountOperation`, `deleteAccountOperation`, `accountBalance`, `totalNetWorth`.

- [ ] **Step 1: Write the failing domain test in `lib/data/domains/money/money.test.ts`**
Add tests for `addAccountOperation`, `updateAccountOperation`, `deleteAccountOperation`, `accountBalance` (including income, expense, transfers in, transfers out), and updated `normalizeMoneyState`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test lib/data/domains/money/money.test.ts`
Expected: FAIL due to missing account types and functions.

- [ ] **Step 3: Implement types, operations, and utils in `wasl-local` and `wasl-cloud`**
Update `lib/data/domains/money/types.ts`, `lib/data/domains/money/operations.ts`, `lib/data/domains/money/utils.ts`, and `lib/data/domains/money/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test lib/data/domains/money/money.test.ts`
Expected: PASS.

---

### Task 2: Store Registry, Pure Migrations, Zod Schemas & Backups

**Files:**
- Modify: `lib/data/types.ts`
- Modify: `lib/data/store-registry.ts`
- Modify: `lib/data/migrations.ts`
- Modify: `lib/data/validation/domain-schemas.ts`
- Modify: `lib/data/backup/transfer.ts`
- Test: `lib/data/validation/domain-schemas.test.ts`
- Test: `lib/data/store-registry.test.ts`
- Test: `lib/data/schema-drift.test.ts`

**Interfaces:**
- Produces: `STORE_REGISTRY["lifeos-money"].version = 4`, `AccountSchema`, updated `MoneyStateSchema`, backup transfer logic for `accounts`.

- [ ] **Step 1: Write/update tests in `store-registry.test.ts` and `domain-schemas.test.ts`**
Update expected store version to 4 and test account schema validation.

- [ ] **Step 2: Run tests to verify failures**
Run: `npm test lib/data/store-registry.test.ts lib/data/validation/domain-schemas.test.ts`
Expected: FAIL on version check and schema mismatch.

- [ ] **Step 3: Implement Store Registry v4, Zod Schemas, Migrations, and Backup handling**
Update `store-registry.ts`, `migrations.ts`, `types.ts`, `domain-schemas.ts`, and `transfer.ts` in both `wasl-local` and `wasl-cloud`.

- [ ] **Step 4: Run all domain and schema-drift tests**
Run: `npm test lib/data/store-registry.test.ts lib/data/validation/domain-schemas.test.ts lib/data/schema-drift.test.ts`
Expected: PASS.

---

### Task 3: Domain Hooks & Data Mutation Layer

**Files:**
- Modify: `lib/data/domains/money/hooks.ts`
- Test: `lib/data/domains/money/money.test.ts`

**Interfaces:**
- Produces: `useMoneyData` returning `{ accounts, addAccount, updateAccount, deleteAccount, transferMoney, ... }`.

- [ ] **Step 1: Write hook integration tests in `lib/data/domains/money/money.test.ts`**
Add tests for adding, updating, and deleting accounts via `useMoneyData`, as well as logging transfers.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test lib/data/domains/money/money.test.ts`
Expected: FAIL due to missing hook methods.

- [ ] **Step 3: Implement updated hooks in `lib/data/domains/money/hooks.ts` in `wasl-local` and `wasl-cloud`**

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test lib/data/domains/money/money.test.ts`
Expected: PASS.

---

### Task 4: MCP Tools & Bridge Dispatcher Parity

**Files:**
- Modify: `packages/wasl-mcp-local/src/tool-definitions.ts`
- Modify: `lib/relay/local-executor.ts`
- Modify: `wasl-cloud/lib/ai/tools.ts`
- Modify: `wasl-cloud/lib/ai/tool-contracts.ts`
- Modify: `wasl-cloud/app/api/[transport]/route.ts`
- Test: `wasl-cloud/lib/ai/tools.test.ts`

**Interfaces:**
- Produces: `get_money`, `add_money_account`, `update_money_account`, `delete_money_account`, `transfer_money`, `add_money_transaction`.

- [ ] **Step 1: Write/update MCP tool tests in `wasl-cloud/lib/ai/tools.test.ts`**
Test adding accounts, updating accounts, transfers, and version 4 state.

- [ ] **Step 2: Run test to verify failures**
Run: `cd /home/amine/wasl-cloud && npm test lib/ai/tools.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement MCP tool definitions and executors in `wasl-local` and `wasl-cloud`**

- [ ] **Step 4: Run MCP tool tests and build MCP connector**
Run: `cd /home/amine/wasl-cloud && npm test lib/ai/tools.test.ts`
Run: `cd /home/amine/wasl-local && npm run build:mcp`
Expected: PASS.

---

### Task 5: UI Components — Account Modal, Enhanced Txn Form & Accounts Deck

**Files:**
- Create: `components/forms/AccountModal.tsx`
- Modify: `components/forms/TxnForm.tsx`
- Modify: `app/money/page.tsx`

**Interfaces:**
- Produces: `AccountModal`, interactive card deck with color badges, account filter state, and 3-way `TxnForm` (income, expense, transfer).

- [ ] **Step 1: Create `components/forms/AccountModal.tsx` in `wasl-local` and `wasl-cloud`**
Implement account creation & edit modal with name, type selector, starting balance, currency, color picker presets, and icon presets.

- [ ] **Step 2: Enhance `components/forms/TxnForm.tsx` in `wasl-local` and `wasl-cloud`**
Support `Expense`, `Income`, and `Transfer` types with account selector dropdowns.

- [ ] **Step 3: Update `app/money/page.tsx` in `wasl-local` and `wasl-cloud`**
Render the Accounts & Cards deck with card styling, live balance pills, filtering interaction, and updated stat tiles.

---

### Task 6: Full Verification, Lint, Typecheck & Builds

**Files:** All modified files across `wasl-local` and `wasl-cloud`.

- [ ] **Step 1: Run full test suites in both repositories**
Run: `cd /home/amine/wasl-local && npm test`
Run: `cd /home/amine/wasl-cloud && npm test`
Expected: 100% PASS.

- [ ] **Step 2: Run typecheck in both repositories**
Run: `cd /home/amine/wasl-local && npm run typecheck`
Run: `cd /home/amine/wasl-cloud && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run linter in both repositories**
Run: `cd /home/amine/wasl-local && npm run lint`
Run: `cd /home/amine/wasl-cloud && npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Run production builds**
Run: `cd /home/amine/wasl-local && npm run build && npm run build:mcp`
Run: `cd /home/amine/wasl-cloud && npm run build:cloud`
Expected: Successful builds.
