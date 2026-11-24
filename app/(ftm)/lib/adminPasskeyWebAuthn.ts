"use client";

type JsonCredentialDescriptor = {
  id: string;
  type?: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
};

type JsonCreationOptions = Omit<PublicKeyCredentialCreationOptions, "challenge" | "user" | "excludeCredentials"> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
  excludeCredentials?: JsonCredentialDescriptor[];
};

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function deserializeCreationOptions(options: JsonCreationOptions): PublicKeyCredentialCreationOptions {
  const nativeParser = (PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: (json: JsonCreationOptions) => PublicKeyCredentialCreationOptions;
  }).parseCreationOptionsFromJSON;
  if (nativeParser) return nativeParser(options);

  return {
    ...options,
    challenge: decodeBase64Url(options.challenge),
    user: { ...options.user, id: decodeBase64Url(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: decodeBase64Url(credential.id),
      type: credential.type || "public-key",
    })),
  } as PublicKeyCredentialCreationOptions;
}

export async function createAdminTargetPasskey(options: JsonCreationOptions) {
  if (typeof window === "undefined" || !window.isSecureContext || !navigator.credentials || !("PublicKeyCredential" in window)) {
    throw new Error("Passkeys require HTTPS or localhost and a browser with WebAuthn support.");
  }

  const credential = await navigator.credentials.create({ publicKey: deserializeCreationOptions(options) });
  if (!(credential instanceof PublicKeyCredential)) throw new Error("The browser did not return a passkey credential.");
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: encodeBase64Url(response.attestationObject),
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
  };
}