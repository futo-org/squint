export type SigningKey = { kid: string; privateKey: CryptoKey; jwk: JsonWebKey & { kid: string } };

export const base64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCodePoint(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const encode = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

export const newSigningKey = async (kid: string): Promise<SigningKey> => {
  const algorithm = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  };
  const { privateKey, publicKey } = (await crypto.subtle.generateKey(algorithm, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey;

  return { kid, privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
};

export const signJwt = async (key: SigningKey, claims: Record<string, unknown>) => {
  const content = `${encode({ alg: 'RS256', typ: 'JWT', kid: key.kid })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(content));

  return `${content}.${base64Url(signature)}`;
};
