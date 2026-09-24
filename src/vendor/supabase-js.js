import { gunzipSync, strFromU8 } from "./gunzip.js?v=16.8.0.3";

const PAYLOADS = Object.freeze([
  "/src/vendor/supabase-js/payload-1.txt?v=16.8.0.3",
  "/src/vendor/supabase-js/payload-2.txt?v=16.8.0.3",
  "/src/vendor/supabase-js/payload-3.txt?v=16.8.0.3",
  "/src/vendor/supabase-js/payload-4.txt?v=16.8.0.3",
]);

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function fetchPayload(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Local Supabase bundle failed: ${response.status}`);
  return (await response.text()).trim();
}

async function decodeCompressedSource(compressed) {
  if (typeof DecompressionStream === "function") {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }
  return strFromU8(gunzipSync(compressed));
}

async function decodeBundle() {
  const encoded = (await Promise.all(PAYLOADS.map(fetchPayload))).join("");
  const source = await decodeCompressedSource(decodeBase64(encoded));
  const objectUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const module = await import(objectUrl);
    if (typeof module?.createClient !== "function") throw new Error("Local Supabase SDK is invalid");
    return module;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const bundle = await decodeBundle();
export const createClient = bundle.createClient;
