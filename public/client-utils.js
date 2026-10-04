// getRandomValues is available on HTTP LAN origins; randomUUID is not.
export function makeCommandId(cryptoProvider = globalThis.crypto) {
  return Array.from(cryptoProvider.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
}
