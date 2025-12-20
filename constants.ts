import { StaffConfig } from './types';

// Map pitch strings to an index for vertical positioning
export const PITCH_ORDER = [
  'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5',
  'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4'
];

export const STAFF_LINES = ['F5', 'D5', 'B4', 'G4', 'E4'];

export const CONFIG: StaffConfig = {
  stepWidth: 30,
  lineHeight: 12,
  topNote: 'A5',
  bottomNote: 'C4',
  measureCount: 4,
};

export const STEPS_PER_BEAT = 4;
export const BEATS_PER_MEASURE = 4;
export const STEPS_PER_MEASURE = STEPS_PER_BEAT * BEATS_PER_MEASURE;

export const NOTE_COLORS = {
  USER: '#2563eb', 
  AI: '#9333ea',   
  PLAYING: '#f59e0b',
  GUIDE: 'rgba(99, 102, 241, 0.3)', // Indigo with transparency
};

// Twinkle Twinkle Little Star Guide Melody (C Major)
export const GUIDE_MELODY = [
  // Phrase 1
  { pitch: 'C4', startTime: 0 }, { pitch: 'C4', startTime: 4 },
  { pitch: 'G4', startTime: 8 }, { pitch: 'G4', startTime: 12 },
  { pitch: 'A4', startTime: 16 }, { pitch: 'A4', startTime: 20 },
  { pitch: 'G4', startTime: 24 },
  // Phrase 2
  { pitch: 'F4', startTime: 32 }, { pitch: 'F4', startTime: 36 },
  { pitch: 'E4', startTime: 40 }, { pitch: 'E4', startTime: 44 },
  { pitch: 'D4', startTime: 48 }, { pitch: 'D4', startTime: 52 },
  { pitch: 'C4', startTime: 56 },
  // Phrase 3
  { pitch: 'G4', startTime: 64 }, { pitch: 'G4', startTime: 68 },
  { pitch: 'F4', startTime: 72 }, { pitch: 'F4', startTime: 76 },
  { pitch: 'E4', startTime: 80 }, { pitch: 'E4', startTime: 84 },
  { pitch: 'D4', startTime: 88 },
  // Phrase 4 (Repeat Phrase 3)
  { pitch: 'G4', startTime: 96 }, { pitch: 'G4', startTime: 100 },
  { pitch: 'F4', startTime: 104 }, { pitch: 'F4', startTime: 108 },
  { pitch: 'E4', startTime: 112 }, { pitch: 'E4', startTime: 116 },
  { pitch: 'D4', startTime: 120 },
];