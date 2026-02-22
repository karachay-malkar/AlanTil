#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

const src = fs.readFileSync('app.js', 'utf8');

function extractFunction(name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Failed to extract function body for ${name}`);
}

const parseCsvCode = extractFunction('parseCsv');
const parseMultiCode = extractFunction('parseMulti');

// eslint-disable-next-line no-eval
eval(`${parseCsvCode}\n${parseMultiCode}`);

(function testParseCsvRequiredAndDictOrder() {
  const csv = [
    'id,dict,section,set,word,trans,dict_order',
    '1,Main,Basic,1,окъургъа,читать,3',
    '2,Main,Basic,,барыргъа,идти,4',
    '',
  ].join('\n');

  const out = parseCsv(csv);
  assert.strictEqual(out.length, 1, 'parseCsv should skip rows with missing required fields');
  assert.strictEqual(out[0].dict_order, 3, 'parseCsv should read dict_order');
})();

(function testParseCsvFolderFallbackAndQuotes() {
  const csv = [
    'id,dict,folder,set,word,trans,example',
    '3,Main,Travel,2,"сау ""бол""","спасибо, благодарю","пример"',
  ].join('\n');
  const out = parseCsv(csv);
  assert.strictEqual(out.length, 1, 'parseCsv should parse a valid quoted row');
  assert.strictEqual(out[0].section, 'Travel', 'parseCsv should map folder -> section');
  assert.strictEqual(out[0].word, 'сау "бол"', 'parseCsv should unescape doubled quotes');
})();

(function testParseMultiSeparators() {
  const out = parseMulti('идти/ехать, ходить; отправляться');
  assert.ok(Array.isArray(out), 'parseMulti should return array');
  assert.ok(out.length >= 2, 'parseMulti should split multiple variants');
})();

console.log('parser-checks: OK');
