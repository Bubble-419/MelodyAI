import { StaffConfig } from './types';

// Map pitch strings to an index for vertical positioning (higher index = lower pitch visually)
// We render from A5 (top) down to C4 (bottom, with ledger lines)
export const PITCH_ORDER = [
  'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5',
  'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4'
];

// Natural notes for drawing the actual staff lines (E4 to F5 standard treble)
export const STAFF_LINES = ['F5', 'D5', 'B4', 'G4', 'E4'];

export const CONFIG: StaffConfig = {
  stepWidth: 30, // Each 16th note is 30px wide
  lineHeight: 12, // Space between lines/spaces
  topNote: 'A5',
  bottomNote: 'C4',
  measureCount: 4, // Start with 4 bars
};

export const STEPS_PER_BEAT = 4; // 16th notes
export const BEATS_PER_MEASURE = 4;
export const STEPS_PER_MEASURE = STEPS_PER_BEAT * BEATS_PER_MEASURE;

export const NOTE_COLORS = {
  USER: '#2563eb', // Blue-600
  AI: '#9333ea',   // Purple-600
  PLAYING: '#f59e0b', // Amber-500
};
