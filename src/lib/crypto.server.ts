// Server-only cryptographic helpers: step-up token mint/verify, SHA-256 hex,
// and Merkle-root over an ordered list of hex hashes. Web Crypto (Worker-safe).

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b = btoa(json);
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): string {
  const b = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 ? "=".repeat(4 - (b.length % 4)) : "";
  return atob(b + pad);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return toHex(buf);
}

/** Mint a short-lived step-up token. Payload is b64url(JSON). Sig is hex HMAC-SHA256. */
export async function mintStepUpToken(
  secret: string,
  userId: string,
  ttlMs = 5 * 60_000,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlMs;
  const payload = b64url({ uid: userId, exp: expiresAt, nonce: crypto.randomUUID() });
  const key = await hmacKey(secret);
  const sig = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return { token: `${payload}.${sig}`, expiresAt };
}

/** Verify a step-up token's signature, expiry, and that it belongs to `userId`. */
export async function verifyStepUpToken(
  secret: string,
  token: string,
  userId: string,
): Promise<boolean> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, enc.encode(sig), enc.encode(payload));
    if (!ok) return false;
    const claims = JSON.parse(b64urlDecode(payload)) as { uid?: string; exp?: number };
    if (claims.uid !== userId) return false;
    if (!claims.exp || Date.now() > claims.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/** Merkle root over an ordered list of hex entry hashes. Empty -> 64 zeros. */
export async function merkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return "0".repeat(64);
  let layer = hashes.slice();
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) next.push(await sha256Hex(layer[i] + layer[i + 1]));
      else next.push(layer[i]); // odd carry
    }
    layer = next;
  }
  return layer[0];
}
