// Shared types for the Credits/Shop system.
// Re-exports Prisma types + defines API response shapes.

export type {
  Product,
  Redemption,
  CreditRule,
  CreditTransaction,
  CreditAction,
  CreditDirection,
  RedemptionStatus,
} from "@/generated/prisma/client";

/** Credit rule as displayed in the UI. */
export interface CreditRuleDisplay {
  id: string;
  action: string;
  name: string;
  description: string;
  amount: number;
  dailyCap: number;
  icon: string | null;
}

/** Product card for the shop grid. */
export interface ProductCard {
  id: string;
  name: string;
  description: string;
  image: string | null;
  priceCredits: number;
  available: boolean;
}

/** Transaction record in history. */
export interface TransactionRecord {
  id: string;
  action: string;
  direction: string;
  amount: number;
  balance: number;
  note: string | null;
  createdAt: string;
}

/** Full shop data returned by the API. */
export interface ShopApiResponse {
  balance: number;
  rules: CreditRuleDisplay[];
  products: ProductCard[];
  recentTransactions: TransactionRecord[];
}
