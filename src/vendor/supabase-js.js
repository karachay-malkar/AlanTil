import { gunzipSync, strFromU8 } from "./gunzip.js?v=13.10.2";

const TEXT_PAYLOAD = "/src/vendor/supabase-js/payload-1.txt?v=13.10.2";
const BINARY_PAYLOADS = Object.freeze([
  "/src/vendor/supabase-js/payload-2.bin?v=13.10.2",
  "/src/vendor/supabase-js/payload-3.bin?v=13.10.2",
  "/src/vendor/supabase-js/payload-4.bin?v=13.10.2",
]);

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decodeCompressedSource(compressed) {
  if (typeof DecompressionStream === "function") {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }
  return strFromU8(gunzipSync(compressed));
}

async function decodeBundle() {
  const [textResponse, ...binaryResponses] = await Promise.all([
    fetch(TEXT_PAYLOAD, { cache: "force-cache" }),
    ...BINARY_PAYLOADS.map((url) => fetch(url, { cache: "force-cache" })),
  ]);
  const responses = [textResponse, ...binaryResponses];
  const failed = responses.find((response) => !response.ok);
  if (failed) throw new Error(`Local Supabase bundle failed: ${failed.status}`);

  const first = decodeBase64(await textResponse.text());
  const rest = await Promise.all(binaryResponses.map(async (response) => new Uint8Array(await response.arrayBuffer())));
  const byteLength = first.byteLength + rest.reduce((total, chunk) => total + chunk.byteLength, 0);
  const compressed = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of [first, ...rest]) {
    compressed.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const source = await decodeCompressedSource(compressed);
  const objectUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try { return await import(objectUrl); } finally { URL.revokeObjectURL(objectUrl); }
}

const bundle = await decodeBundle();
export const createClient = bundle.createClient;
