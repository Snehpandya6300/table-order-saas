/**
 * Webhook signature helpers.
 *
 * Aggregators sign the raw request body with a shared secret. We verify with
 * HMAC-SHA256 and compare in constant time so a wrong signature can never be
 * discovered byte by byte through timing.
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacHex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return toHex(signature);
}

export async function sha256Hex(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return toHex(digest);
}

/** Accepts `sha256=<hex>`, `hmac-sha256=<hex>` or a bare hex digest. */
export function stripSignaturePrefix(value: string): string {
  const trimmed = value.trim();
  const separator = trimmed.indexOf("=");
  const candidate = separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
  return candidate.trim().toLowerCase();
}

export function safeEqual(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}
