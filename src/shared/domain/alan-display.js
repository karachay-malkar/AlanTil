import { getUserSettings } from "../settings/user-settings-store.js?v=13.10.12";
import * as core from "../../../packages/alantil-core/alan-display.js";

function settingsOrCurrent(settings) {
  return settings || getUserSettings();
}

export const applyAlanCyrillicDialect = core.applyAlanCyrillicDialect;

export function getDisplayedSessionExitPhrase(settings) {
  return core.getDisplayedSessionExitPhrase(settingsOrCurrent(settings));
}

export function getDisplayedAlanWord(entry, settings) {
  return core.getDisplayedAlanWord(entry, settingsOrCurrent(settings));
}

export function getDisplayedAlanPhrases(entry, settings) {
  return core.getDisplayedAlanPhrases(entry, settingsOrCurrent(settings));
}

export function getDisplayedStoryName(entry, settings) {
  return core.getDisplayedStoryName(entry, settingsOrCurrent(settings));
}

export function getDisplayedDictionaryName(entry, settings) {
  return core.getDisplayedDictionaryName(entry, settingsOrCurrent(settings));
}

export function getDisplayedSectionName(entry, settings) {
  return core.getDisplayedSectionName(entry, settingsOrCurrent(settings));
}

export function getDisplayedSetName(entry, settings) {
  return core.getDisplayedSetName(entry, settingsOrCurrent(settings));
}

export function getDisplayedStoryIntro(entry, settings) {
  return core.getDisplayedStoryIntro(entry, settingsOrCurrent(settings));
}

export function getDisplayedTranslation(entry, settings) {
  return core.getDisplayedTranslation(entry, settingsOrCurrent(settings));
}

export function getDisplayedExample(entry, settings) {
  return core.getDisplayedExample(entry, settingsOrCurrent(settings));
}

export function getDisplayedWordEntry(entry, settings) {
  return core.getDisplayedWordEntry(entry, settingsOrCurrent(settings));
}

export function getDisplayedWordCollection(words, settings) {
  return core.getDisplayedWordCollection(words, settingsOrCurrent(settings));
}
