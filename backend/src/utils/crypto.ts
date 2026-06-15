import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Password transport encryption (defence-in-depth on top of HTTPS/TLS).
 *
 * The frontend encrypts the password with this server's RSA public key
 * (RSA-OAEP / SHA-256) so the raw password never travels — or appears in
 * browser devtools / proxy logs / APM traces — in cleartext. The server
 * decrypts it back to the original plaintext here, then bcrypt-hashes/compares
 * exactly as before, so existing accounts keep working unchanged.
 *
 * Keys: if PASSWORD_RSA_PRIVATE_KEY + PASSWORD_RSA_PUBLIC_KEY are set in env
 * they are used (required when running multiple backend instances behind a
 * load balancer, so every instance shares the same key). Otherwise an
 * ephemeral keypair is generated at boot — perfectly fine for a single
 * instance because every ciphertext is decrypted in the same request it
 * arrives in.
 */

let publicKeyPem: string;
let privateKeyObject: crypto.KeyObject;

function init(): void {
  if (env.PASSWORD_RSA_PRIVATE_KEY && env.PASSWORD_RSA_PUBLIC_KEY) {
    // Allow "\n"-escaped single-line keys (common in env files / dashboards)
    const priv = env.PASSWORD_RSA_PRIVATE_KEY.replace(/\\n/g, "\n");
    const pub = env.PASSWORD_RSA_PUBLIC_KEY.replace(/\\n/g, "\n");
    privateKeyObject = crypto.createPrivateKey(priv);
    publicKeyPem = pub;
    logger.info("🔐 Password encryption: using RSA keypair from env");
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    publicKeyPem = publicKey;
    privateKeyObject = crypto.createPrivateKey(privateKey);
    logger.info(
      "🔐 Password encryption: generated ephemeral RSA keypair (set PASSWORD_RSA_PUBLIC_KEY/PASSWORD_RSA_PRIVATE_KEY for multi-instance deployments)"
    );
  }
}

init();

/** PEM (SPKI) public key the frontend imports to encrypt passwords. */
export function getPublicKeyPem(): string {
  return publicKeyPem;
}

/** Decrypt a base64 RSA-OAEP/SHA-256 ciphertext back to the original password. */
export function decryptPassword(ciphertextB64: string): string {
  const buffer = Buffer.from(ciphertextB64, "base64");
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKeyObject,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    buffer
  );
  return decrypted.toString("utf8");
}
