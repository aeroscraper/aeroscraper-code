import { Schema, serialize } from 'borsh';

// OpenTroveParams schema (matches Rust struct from IDL)
export class OpenTroveParams {
  loan_amount: bigint;
  collateral_denom: string;
  collateral_amount: bigint;

  constructor(fields: { loan_amount: bigint; collateral_denom: string; collateral_amount: bigint }) {
    this.loan_amount = fields.loan_amount;
    this.collateral_denom = fields.collateral_denom;
    this.collateral_amount = fields.collateral_amount;
  }
}

export const OpenTroveParamsSchema = new Map([
  [
    OpenTroveParams,
    {
      kind: 'struct',
      fields: [
        ['loan_amount', 'u64'],
        ['collateral_denom', 'string'],
        ['collateral_amount', 'u64'],
      ],
    },
  ],
]);

// AddCollateralParams schema (matches Rust struct from IDL)
export class AddCollateralParams {
  amount: bigint;
  collateral_denom: string;
  prev_node_id: bigint | null;
  next_node_id: bigint | null;

  constructor(fields: {
    amount: bigint;
    collateral_denom: string;
  }) {
    this.amount = fields.amount;
    this.collateral_denom = fields.collateral_denom;
    this.prev_node_id = null;
    this.next_node_id = null;
  }
}

export const AddCollateralParamsSchema = new Map([
  [
    AddCollateralParams,
    {
      kind: 'struct',
      fields: [
        ['amount', 'u64'],
        ['collateral_denom', 'string'],
        ['prev_node_id', { option: 'pubkey' }],
        ['next_node_id', { option: 'pubkey' }],
      ],
    },
  ],
]);

// RemoveCollateralParams schema (matches Rust struct from IDL)
export class RemoveCollateralParams {
  collateral_amount: bigint;
  collateral_denom: string;
  prev_node_id: bigint | null;
  next_node_id: bigint | null;

  constructor(fields: {
    collateral_amount: bigint;
    collateral_denom: string;
  }) {
    this.collateral_amount = fields.collateral_amount;
    this.collateral_denom = fields.collateral_denom;
    this.prev_node_id = null;
    this.next_node_id = null;
  }
}

export const RemoveCollateralParamsSchema = new Map([
  [
    RemoveCollateralParams,
    {
      kind: 'struct',
      fields: [
        ['collateral_amount', 'u64'],
        ['collateral_denom', 'string'],
        ['prev_node_id', { option: 'pubkey' }],
        ['next_node_id', { option: 'pubkey' }],
      ],
    },
  ],
]);

// BorrowLoanParams schema (matches Rust struct from IDL)
export class BorrowLoanParams {
  loan_amount: bigint;
  collateral_denom: string;
  prev_node_id: bigint | null;
  next_node_id: bigint | null;

  constructor(fields: {
    loan_amount: bigint;
    collateral_denom: string;
  }) {
    this.loan_amount = fields.loan_amount;
    this.collateral_denom = fields.collateral_denom;
    this.prev_node_id = null;
    this.next_node_id = null;
  }
}

export const BorrowLoanParamsSchema = new Map([
  [
    BorrowLoanParams,
    {
      kind: 'struct',
      fields: [
        ['loan_amount', 'u64'],
        ['collateral_denom', 'string'],
        ['prev_node_id', { option: 'pubkey' }],
        ['next_node_id', { option: 'pubkey' }],
      ],
    },
  ],
]);

// RepayLoanParams schema (matches Rust struct from IDL)
export class RepayLoanParams {
  amount: bigint;
  collateral_denom: string;
  prev_node_id: bigint | null;
  next_node_id: bigint | null;

  constructor(fields: {
    amount: bigint;
    collateral_denom: string;
  }) {
    this.amount = fields.amount;
    this.collateral_denom = fields.collateral_denom;
    this.prev_node_id = null;
    this.next_node_id = null;
  }
}

export const RepayLoanParamsSchema = new Map([
  [
    RepayLoanParams,
    {
      kind: 'struct',
      fields: [
        ['amount', 'u64'],
        ['collateral_denom', 'string'],
        ['prev_node_id', { option: 'pubkey' }],
        ['next_node_id', { option: 'pubkey' }],
      ],
    },
  ],
]);

// StakeParams schema (matches Rust struct from IDL)
export class StakeParams {
  amount: bigint;

  constructor(fields: { amount: bigint }) {
    this.amount = fields.amount;
  }
}

export const StakeParamsSchema = new Map([
  [
    StakeParams,
    {
      kind: 'struct',
      fields: [['amount', 'u64']],
    },
  ],
]);

// UnstakeParams schema (matches Rust struct from IDL)
export class UnstakeParams {
  amount: bigint;

  constructor(fields: { amount: bigint }) {
    this.amount = fields.amount;
  }
}

export const UnstakeParamsSchema = new Map([
  [
    UnstakeParams,
    {
      kind: 'struct',
      fields: [['amount', 'u64']],
    },
  ],
]);

// LiquidateTrovesParams schema (matches Rust struct from IDL)
export class LiquidateTrovesParams {
  liquidation_list: string[]; // Vec<String> in Rust, but we'll pass Pubkey addresses as strings
  collateral_denom: string;

  constructor(fields: { liquidation_list: string[]; collateral_denom: string }) {
    this.liquidation_list = fields.liquidation_list;
    this.collateral_denom = fields.collateral_denom;
  }
}

export const LiquidateTrovesParamsSchema = new Map([
  [
    LiquidateTrovesParams,
    {
      kind: 'struct',
      fields: [
        ['liquidation_list', ['u8']], // Vec<Pubkey> serialized as bytes
        ['collateral_denom', 'string'],
      ],
    },
  ],
]);

// RedeemParams schema (matches Rust struct from IDL)
export class RedeemParams {
  amount: bigint;
  collateral_denom: string;

  constructor(fields: { amount: bigint; collateral_denom: string }) {
    this.amount = fields.amount;
    this.collateral_denom = fields.collateral_denom;
  }
}

export const RedeemParamsSchema = new Map([
  [
    RedeemParams,
    {
      kind: 'struct',
      fields: [
        ['amount', 'u64'],
        ['collateral_denom', 'string'],
      ],
    },
  ],
]);
