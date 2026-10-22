import { AppLockConfig } from "../types";

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const input = `${pin}:${salt}`;
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback hashing jika crypto.subtle tidak tersedia
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "fb_" + Math.abs(hash).toString(16);
}

export async function verifyPin(pin: string, config: AppLockConfig): Promise<boolean> {
  if (!config.enabled || !config.pinHash) return false;
  const computed = await hashPin(pin, config.salt);
  return computed === config.pinHash;
}

export async function isWebAuthnSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export async function registerBiometric(username: string = "Pengguna"): Promise<string | null> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return null;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Catatan Keuangan",
          id: window.location.hostname || undefined,
        },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.id) {
      return credential.id;
    }
    return null;
  } catch (err: any) {
    console.warn("Registrasi Biometrik WebAuthn gagal atau dibatalkan:", err);
    return null;
  }
}

export async function authenticateBiometric(credentialId?: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        userVerification: "required",
        timeout: 60000,
      },
    };

    if (credentialId) {
      try {
        const rawId = Uint8Array.from(
          atob(credentialId.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        );
        options.publicKey!.allowCredentials = [
          {
            type: "public-key",
            id: rawId,
          },
        ];
      } catch {
        // Abaikan formatting credential ID jika parse gagal, biarkan platform authenticator mencari credential
      }
    }

    const assertion = await navigator.credentials.get(options);
    return Boolean(assertion);
  } catch (err: any) {
    console.warn("Verifikasi Biometrik WebAuthn gagal atau dibatalkan:", err);
    return false;
  }
}
