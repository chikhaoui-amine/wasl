# Money Accounts & Cards Specification

## Overview
Adds comprehensive support for Accounts and Cards (Bank Accounts, Credit/Debit Cards, Cash Wallets, Vaults, Investments, Digital Wallets) to the Money domain in WASL across both Local (`wasl-local`) and Cloud (`wasl-cloud`) editions.

## User Goals & Requirements
1. **Account & Card Management**: Users can create, view, edit, color-code, and delete financial accounts and cards.
2. **Dynamic Ledger Balances**: Each account has a starting balance (`initialBalance`). All transactions (incomes, expenses, and transfers) update the account's real-time computed balance automatically.
3. **Multi-Account & Transfer Capabilities**:
   - Assign transactions to specific accounts.
   - Perform account-to-account transfers with linked source and destination accounts.
   - Filter the Money page (transactions, graphs, and stats) by account or view aggregate "All Accounts".
4. **Visual Excellence**: Modern, responsive UI with customized card colors, icons, balance chips, and interactive filters.
5. **Full MCP & Sync Parity**: Update MCP tools in all three locations and ensure zero-loss migrations and backup compatibility.

---

## 1. Domain Types & Data Models

### Account & Transaction Types (`lib/data/domains/money/types.ts`)
```typescript
export type AccountType = "bank" | "card" | "cash" | "savings" | "investment" | "wallet";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  isArchived?: boolean;
}

export type AccountInput = Omit<Account, "id" | "createdAt">;

export interface Txn {
  id: string;
  label: string;
  amount: number; // + income, - expense
  tag: string;
  date: string; // ISO string YYYY-MM-DD
  accountId?: string;
  transferAccountId?: string;
}

export type TxnInput = Omit<Txn, "id">;

export interface SavingsGoal {
  id: string;
  name: string;
  current: number;
  target: number;
}

export interface MoneyPersistedState {
  currency: string;
  accounts: Account[];
  transactions: Txn[];
  savings: SavingsGoal[];
}
```

---

## 2. Ledger Math & Operations (`lib/data/domains/money/utils.ts` & `operations.ts`)

### Account Balance Calculation
For any account $A$:
$$\text{Balance}(A) = \text{initialBalance}_A + \sum_{\text{Income}(A)} \text{amount} - \sum_{\text{Expense}(A)} |\text{amount}| - \sum_{\text{TransferFrom}(A)} |\text{amount}| + \sum_{\text{TransferTo}(A)} |\text{amount}|$$

### Global Balance Calculation
$$\text{Total Net Worth} = \sum_{A \in \text{accounts}} \text{Balance}(A) + \sum_{\text{UnassignedTxns}} \text{amount}$$
(If no accounts exist, falls back cleanly to the sum of all transactions).

### Pure Operations:
- `addAccountOperation(state, account: Account): MoneyPersistedState`
- `updateAccountOperation(state, id: string, patch: Partial<AccountInput>): MoneyPersistedState`
- `deleteAccountOperation(state, id: string): MoneyPersistedState` (unlinks or cascades gracefully)
- `addTxnOperation`, `updateTxnOperation`, `deleteTxnOperation`
- `addSavingsOperation`, `updateSavingsOperation`, `addToSavingsOperation`, `deleteSavingsOperation`
- `normalizeMoneyState(current: unknown): MoneyPersistedState` (guarantees `accounts: []` if missing)

---

## 3. UI Components

### Accounts Deck (`app/money/page.tsx`)
- Placed cleanly beneath the page header.
- Displays horizontal scrolling/wrapping card list:
  - **"All Accounts" Pill**: Shows total net worth and resets active account filter.
  - **Account Cards**: Customized with color themes (emerald, blue, purple, amber, rose, slate), type icons (Landmark, CreditCard, Banknote, PiggyBank, Wallet, Coins), account name, account type badge, and live calculated balance.
  - Quick edit button on card hover/click.
  - **"+ Add Account" button** to launch the Account Modal.
- Selecting an account filters the **Income vs Expense bar chart**, **Recent Transactions list**, and **Net This Month / Runway stats** for that specific account.

### Account Modal (`components/forms/AccountModal.tsx` or inline)
- Name input (e.g. "Main Checking", "Gold Mastercard", "Daily Cash")
- Account type selector (`bank`, `card`, `cash`, `savings`, `investment`, `wallet`)
- Initial balance input
- Currency selector (defaults to global currency)
- Color & Icon picker presets
- Save / Delete buttons

### Enhanced Transaction Modal (`components/forms/TxnForm.tsx`)
- Type selector: `Expense` | `Income` | `Transfer`
- When `Expense` or `Income`: Select the account used (optional or default account).
- When `Transfer`: Select **From Account** and **To Account**.
- Amount, Category/Tag, Date, Note.

---

## 4. MCP Tools & API Parity

### MCP Tools Added / Updated:
1. `get_money`: Returns `{ currency, accounts, transactions, savings }`.
2. `add_money_account`: Creates an account `{ name, type, initialBalance?, currency?, color?, icon? }`.
3. `update_money_account`: Updates an account by ID or unique name.
4. `delete_money_account`: Deletes an account by ID or unique name.
5. `add_money_transaction`: Supports `accountId`, `transferAccountId`, `type`.
6. `transfer_money`: Moves funds between accounts with from/to IDs.

### Synchronized Files:
- `lib/ai/tools.ts` (Cloud tool handlers)
- `app/api/[transport]/route.ts` (Cloud API endpoint schemas)
- `packages/wasl-mcp-local/src/tool-definitions.ts` (Local MCP tools schema)
- `lib/relay/local-executor.ts` (Local MCP execution dispatcher)

---

## 5. Storage, Migration & Backup Integrity
1. **Schema Versioning**: Bump `STORE_REGISTRY["lifeos-money"].version` from 3 to 4.
2. **Migrations**: `DOMAIN_MIGRATIONS["lifeos-money"]` normalizes states to include `accounts: []`.
3. **Strict Validation**: Update `MoneyStateSchema`, `TxnSchema`, and `AccountSchema` in `lib/data/validation/domain-schemas.ts`.
4. **Selective Backup & Transfer**: Update `lib/data/backup/transfer.ts` to merge, filter, and extract `accounts`.
5. **Tests**: Update `money.test.ts`, `domain-schemas.test.ts`, `schema-drift.test.ts`, and `tools.test.ts`.
