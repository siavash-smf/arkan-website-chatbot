import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";

/**
 * هش رمز عبور با scrypt از node:crypto — بدون کتابخانه‌ی اضافه.
 * نسخه‌ی async استفاده می‌شود تا event loop مسدود نشود
 * (روی Fluid Compute یک instance چند درخواست همزمان را سرو می‌کند).
 * فرمت ذخیره: scrypt:N:r:p:saltHex:hashHex
 */

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nStr, rStr, pStr, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt") return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
