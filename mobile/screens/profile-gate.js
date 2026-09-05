import React from 'react';
import { ProfileMainArea } from './profile-main.js';

export function ProfileGate({ words, settings, onSettingsChange, onAccount, onGuest, onOpenStory, onBottomNavVisibilityChange }) {
  return <ProfileMainArea words={words} settings={settings} onSettingsChange={onSettingsChange} onAccount={() => onAccount?.('open')} onGuest={onGuest} onOpenStory={onOpenStory} onBottomNavVisibilityChange={onBottomNavVisibilityChange} />;
}