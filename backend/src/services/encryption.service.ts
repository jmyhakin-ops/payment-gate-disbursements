import CryptoJS from 'crypto-js';
import { env } from '../config/env';

const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

// ─── Encrypt / Decrypt API Credentials ───────────────────────────────────────
export function encryptCredentials(data: Record<string, string>): string {
  const json = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(json, ENCRYPTION_KEY).toString();
  return encrypted;
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  const json = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(json);
}

// ─── Mask sensitive fields for display ───────────────────────────────────────
export function maskCredential(value: string): string {
  if (!value || value.length < 8) return '****';
  return value.slice(0, 4) + '*'.repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

// ─── Hash a value (for tokens, passwords) ────────────────────────────────────
export function hashValue(value: string): string {
  return CryptoJS.SHA256(value).toString();
}

// ─── Generate a secure random token ──────────────────────────────────────────
export function generateSecureToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = CryptoJS.lib.WordArray.random(length);
  const words = randomValues.words;
  for (let i = 0; i < length; i++) {
    result += chars[Math.abs(words[Math.floor(i / 4)] >> ((3 - (i % 4)) * 8)) % chars.length];
  }
  return result;
}

// ─── Generate OTP ─────────────────────────────────────────────────────────────
export function generateOTP(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}
