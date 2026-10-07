import type {Buffer} from 'node:buffer';
export const PROGRAM: string;
export const MINT: string;
export const SEED: string;
export const MAGIC: string;
export const DOMAIN: Buffer;
export function keybytes(text: unknown): Buffer;
export function keystring(bytes: Uint8Array): string;
export function recordAddress(operator: string): string;
export function attestationMessage(record: string, genesis: string, bodyBytes: Uint8Array): Buffer;
export function verifyAttestation(operator: string, message: Uint8Array, signature: Uint8Array): boolean;
export interface TrustedChainContext {
  nowUnixSeconds: number;
  anchorSlot: number;
  anchorBlockhash: string;
  anchorBlockTime: number;
}
// Parsing and validation occur in the JS reference reader; consumers must narrow
// individual fields before using them beyond the authenticated JSON boundary.
export function readRecord(record: string, account: unknown, expectedGenesis: string,
  trustedChainContext: TrustedChainContext): Record<string, unknown>;
