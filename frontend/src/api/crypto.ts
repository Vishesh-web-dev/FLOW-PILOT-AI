import apiClient from "./client";

/**
 * Client-side password encryption (defence-in-depth on top of HTTPS).
 *
 * Fetches the backend's RSA public key and encrypts the password with
 * RSA-OAEP / SHA-256 via the native Web Crypto API (no dependencies) so the
 * raw password never appears in cleartext in network tools / proxy logs.
 * The backend decrypts it before bcrypt, so accounts are unaffected.
 *
 * If Web Crypto is unavailable (non-secure context) or the key can't be
 * loaded, this gracefully falls back to sending the plaintext value with
 * `encrypted: false` — TLS still protects it and login keeps working.
 */

let keyPromise: Promise<CryptoKey | null> | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function loadPublicKey(): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const res = await apiClient.get("/auth/public-key");
  const pem: string = res.data?.data?.publicKey;
  if (!pem) return null;
  return window.crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

function getPublicKey(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    keyPromise = loadPublicKey().catch(() => {
      // Allow a later retry on transient failure
      keyPromise = null;
      return null;
    });
  }
  return keyPromise;
}

export async function encryptPassword(plain: string): Promise<{ value: string; encrypted: boolean }> {
  try {
    const key = await getPublicKey();
    if (!key) return { value: plain, encrypted: false };
    const cipher = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      key,
      new TextEncoder().encode(plain)
    );
    return { value: arrayBufferToBase64(cipher), encrypted: true };
  } catch {
    return { value: plain, encrypted: false };
  }
}
