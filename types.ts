export interface Note {
  id: string;
  pitch: string; // Scientific pitch notation, e.g., "C4", "G#4"
  startTime: number; // Time in "steps" (16th notes), 0-based
  duration: number; // Duration in "steps" (e.g., 4 = quarter note)
  isAiGenerated?: boolean;
}

export enum PlaybackState {
  STOPPED,
  PLAYING,
  PAUSED,
}

export interface StaffConfig {
  stepWidth: number; // Pixels per 16th note
  lineHeight: number; // Pixels between staff lines
  topNote: string; // The highest note on the visual render
  bottomNote: string; // The lowest note on the visual render
  measureCount: number; // Initial measures to show
}
