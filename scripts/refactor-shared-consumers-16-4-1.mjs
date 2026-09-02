import fs from 'node:fs/promises';

async function edit(path, transform){const before=await fs.readFile(path,'utf8'),after=transform(before);if(after===before){console.log(`${path}: already current`);return false;}await fs.writeFile(path,after,'utf8');console.log(`${path}: updated`);return true;}
function mustReplace(source,search,replacement,label){if(source.includes(search))return source.replace(search,replacement);if(source.includes(replacement))return source;throw new Error(`Missing ${label}`);}
function mustRegex(source,regex,replacement,label,already=''){if(regex.test(source))return source.replace(regex,replacement);if(already&&source.includes(already))return source;throw new Error(`Missing ${label}`);}

await edit('mobile/screens/practice-games.js',(input)=>{
  let s=input;
  s=mustReplace(s,"import { applyTestAnswer, buildTestOptions, initializeTestState, testCompletionSummary } from '../../packages/alantil-core/test.js';","import { applyTestAnswer, buildTestOptions, initializeTestState, restoreTestStateSnapshot, testCompletionSummary, testStateSnapshot } from '../../packages/alantil-core/test.js';",'mobile test imports');
  s=mustReplace(s,"import { initializeMatchState, markMatchSolved, matchCompletionSummary, matchSessionWords, recordMatchMismatch, takeNextMatchRound } from '../../packages/alantil-core/match.js';","import { initializeMatchState, markMatchSolved, matchCompletionSummary, matchSessionWords, matchStateSnapshot, recordMatchMismatch, restoreMatchStateSnapshot, takeNextMatchRound } from '../../packages/alantil-core/match.js';",'mobile match imports');
  s=mustReplace(s,"import { shuffle } from '../../packages/alantil-core/word-selection.js';","import { toggleFavorite } from '../../packages/alantil-core/favorites.js';\nimport { masteryLevelForPercent } from '../../packages/alantil-core/mastery.js';\nimport { buildPracticeScope, practiceScopeKey, practiceSelectedPool, practiceWordScopeKey } from '../../packages/alantil-core/practice-scope.js';\nimport { shuffle } from '../../packages/alantil-core/word-selection.js';",'mobile shared imports');
  s=mustRegex(s,/function scopeKey\(word\) \{[\s\S]*?\n\}\n\nfunction BracketCheck/, 'function BracketCheck','mobile local practice scope','buildPracticeScope');
  s=s.replaceAll('buildScope(words)','buildPracticeScope(words)');
  s=s.replaceAll('`${dictionaryId}||${sectionId}`','practiceScopeKey(dictionaryId, sectionId)');
  s=s.replaceAll('`${dictionary.id}||${section.id}`','practiceScopeKey(dictionary.id, section.id)');
  s=s.replace('new Set(words.map(scopeKey))','new Set(words.map(practiceWordScopeKey))');
  s=s.replace('words.filter((word) => selectedKeys.has(scopeKey(word)))','practiceSelectedPool(words, selectedKeys)');
  s=mustRegex(s,/function testSnapshot\(state\) \{[\s\S]*?\n\}\n\nfunction SessionProgress/, 'function SessionProgress','mobile local test snapshot','restoreTestStateSnapshot');
  s=s.replaceAll('restoreTestSnapshot(snapshot, words)','restoreTestStateSnapshot(snapshot, words, words)');
  s=s.replaceAll('testSnapshot(next)','testStateSnapshot(next)');
  s=s.replaceAll('testSnapshot(state)','testStateSnapshot(state)');
  s=s.replace("const level = result.accuracy_percent >= 100 ? 3 : result.accuracy_percent >= 90 ? 2 : result.accuracy_percent >= 80 ? 1 : 0;","const level = masteryLevelForPercent(result.accuracy_percent);");
  s=s.replace('setFavorites(toggleFavoriteSet(favorites, row.id))','setFavorites(toggleFavorite(favorites, row.id).ids)');
  s=mustRegex(s,/\nfunction toggleFavoriteSet\(set, id\) \{[\s\S]*?\n\}\n\nfunction matchSnapshot\(state\) \{[\s\S]*?\n\}\n\nfunction restoreMatchSnapshot\(snapshot, words\) \{[\s\S]*?\n\}\n\nexport function GeneralMatchFlow/, '\nexport function GeneralMatchFlow','mobile local favorite/match snapshot','restoreMatchStateSnapshot');
  s=s.replaceAll('restoreMatchSnapshot(snapshot, words)','restoreMatchStateSnapshot(snapshot, words)');
  s=s.replaceAll('matchSnapshot(next)','matchStateSnapshot(next)');
  s=s.replaceAll('matchSnapshot(state)','matchStateSnapshot(state)');
  return s;
});

await edit('src/features/test/view.js',(input)=>{
  let s=input;
  s=mustReplace(s,'import { msg } from "../../shared/i18n/index.js?v=13.9.0";','import { msg } from "../../shared/i18n/index.js?v=13.9.0";\nimport { masteryLevelForPercent } from "../../../packages/alantil-core/mastery.js";\nimport { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from "../../../packages/alantil-core/practice-scope.js";','web test shared imports');
  s=mustRegex(s,/function dictionaryId\(word\) \{[\s\S]*?\nfunction enabledWords\(words\) \{/, 'function enabledWords(words) {','web test local scope helpers','buildPracticeScope');
  s=s.replaceAll('buildScope(available)','buildPracticeScope(available)');
  s=s.replace(/function selectedPool\(\) \{\n\s*const keys = new Set\(sectionCheckboxes\.filter\(\(checkbox\) => checkbox\.checked\)\.map\(\(checkbox\) => scopeKey\(checkbox\.dataset\.dict, checkbox\.dataset\.section\)\)\);\n\s*return available\.filter\(\(word\) => keys\.has\(scopeKey\(dictionaryId\(word\), sectionId\(word\)\)\)\);\n\s*\}/,'function selectedPool() {\n    const keys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => practiceScopeKey(checkbox.dataset.dict, checkbox.dataset.section)));\n    return practiceSelectedPool(available, keys);\n  }');
  s=s.replaceAll('scopeKey(', 'practiceScopeKey(');
  s=s.replace('const level = percentage >= 100 ? 3 : percentage >= 90 ? 2 : percentage >= 80 ? 1 : 0;','const level = masteryLevelForPercent(percentage);');
  return s;
});

await edit('src/features/match/view.js',(input)=>{
  let s=input;
  s=mustReplace(s,'import { msg } from "../../shared/i18n/index.js?v=13.9.0";','import { msg } from "../../shared/i18n/index.js?v=13.9.0";\nimport { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from "../../../packages/alantil-core/practice-scope.js";','web match shared imports');
  s=mustRegex(s,/function dictionaryId\(word\) \{[\s\S]*?\n\}\n\nexport function renderMatchMenu/, 'export function renderMatchMenu','web match local scope helpers','buildPracticeScope');
  s=s.replaceAll('buildScope(available)','buildPracticeScope(available)');
  s=s.replace(/function selectedPool\(\) \{ const keys = new Set\(children\.filter\(\(child\) => child\.checked\)\.map\(\(child\) => scopeKey\(child\.dataset\.dict, child\.dataset\.section\)\)\); return available\.filter\(\(word\) => keys\.has\(scopeKey\(dictionaryId\(word\), sectionId\(word\)\)\)\); \}/,'function selectedPool() { const keys = new Set(children.filter((child) => child.checked).map((child) => practiceScopeKey(child.dataset.dict, child.dataset.section))); return practiceSelectedPool(available, keys); }');
  s=s.replaceAll('scopeKey(', 'practiceScopeKey(');
  return s;
});

await edit('packages/alantil-core/station-test.js',(input)=>{
  let s=input;
  s=mustReplace(s,"import { CORE_PATH_CONFIG } from './path-config.js';","import { masteryLevelForPercent } from './mastery.js';\nimport { CORE_PATH_CONFIG } from './path-config.js';",'station mastery import');
  s=s.replace("masteryLevel:payload.accuracy>=100?3:payload.accuracy>=90?2:payload.accuracy>=80?1:0","masteryLevel:masteryLevelForPercent(payload.accuracy)");
  return s;
});

await edit('mobile/screens/station.js',(input)=>{
  let s=input;
  s=mustReplace(s,"import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';","import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';\nimport { masteryMarkForPercent } from '../../packages/alantil-core/mastery.js';",'mobile station mastery import');
  s=mustRegex(s,/function masteryMark\(percent\) \{[\s\S]*?\n\}\n\nfunction StatisticsPane/, 'function StatisticsPane','mobile local mastery helper','masteryMarkForPercent');
  s=s.replaceAll('masteryMark(stats.best)','masteryMarkForPercent(stats.best)');
  s=s.replaceAll('mark[0]','mark.mark');
  s=s.replaceAll('mark[1]','mark.label');
  s=s.replaceAll('masteryMark(row.percent)[1]','masteryMarkForPercent(row.percent).label');
  return s;
});
