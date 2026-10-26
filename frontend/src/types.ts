export type Role = "auctioneer" | "bidder";
export type LotStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Lot {
  id: string;
  title: string;
  artist: string | null;
  dateDisplay: string | null;
  medium: string | null;
  imageUrl: string | null;
  attributes: Record<string, unknown>;
  startPriceCents: number;
  minIncrementCents: number;
  startAt: string;
  endAt: string;
  currentBidCents: number | null;
  bidCount: number;
  settledAt: string | null;
  status: LotStatus;
  serverNow: string;
}

export interface Bid {
  sequence: number;
  amountCents: number;
  createdAt: string;
  bidder: string;
  isMine: boolean;
}

export interface Room {
  lot: Lot;
  bids: Bid[];
  myPosition: "none" | "leading" | "outbid";
}

export interface Wallet {
  totalCents: number;
  committedCents: number;
  availableCents: number;
}

export interface Showcase {
  live: Lot[];
  scheduled: Lot[];
  ended: Lot[];
}

export interface ArtworkResult {
  externalId: string;
  title: string;
  artist: string | null;
  dateDisplay: string | null;
  medium: string | null;
  imageUrl: string | null;
}

export interface MyBid {
  lotId: string;
  title: string;
  artist: string | null;
  imageUrl: string | null;
  status: "scheduled" | "live" | "ended";
  endAt: string;
  currentBidCents: number;
  myBestCents: number;
  result: "leading" | "outbid" | "won" | "lost";
  receiptId: string | null;
}

export interface Receipt {
  id: string;
  lotId: string;
  title: string;
  artist: string | null;
  imageUrl: string | null;
  amountCents: number;
  bidCount: number;
  winner: string;
  finalHash: string;
  issuedAt: string;
}

export interface AuditBid {
  sequence: number;
  amountCents: number;
  createdAt: string;
  bidder: string;
  prevHash: string;
  hash: string;
}

export interface AuditResult {
  lotId: string;
  title: string;
  status: string;
  valid: boolean;
  firstFailure: { sequence: number | null; code: string } | null;
  issues: { sequence: number | null; code: string }[];
  bidCount: number;
  headHash: string;
  bids: AuditBid[];
}
