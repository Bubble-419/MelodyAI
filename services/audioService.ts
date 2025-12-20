import * as Tone from 'tone';
import { Note } from '../types';

class AudioService {
  private synth: Tone.Sampler | null = null;
  private isInitialized = false;
  private loadPromise: Promise<void> | null = null;

  public async initialize() {
    // Ensure AudioContext is running (requires user gesture)
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (this.isInitialized) return;

    // Avoid double initialization
    if (!this.loadPromise) {
      this.loadPromise = new Promise((resolve) => {
        // Use Tone.Sampler with Salamander Piano samples for realistic sound
        // We load only essential samples to keep it relatively lightweight
        this.synth = new Tone.Sampler({
          urls: {
            "C4": "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            "A4": "A4.mp3",
            "C5": "C5.mp3",
            "D#5": "Ds5.mp3",
            "F#5": "Fs5.mp3",
            "A5": "A5.mp3"
          },
          release: 1,
          baseUrl: "https://tonejs.github.io/audio/salamander/",
          onload: () => {
            this.isInitialized = true;
            resolve();
          }
        });

        // Add a High-Shelf Filter (EQ) to boost treble for a "brighter/cheerful" tone
        const eq = new Tone.EQ3({
          low: -4,
          mid: 2,
          high: 6 
        });

        // Reverb for pleasant space
        const reverb = new Tone.Reverb({
          decay: 1.2,
          preDelay: 0.01,
          wet: 0.15
        });

        // Chain: Sampler -> EQ -> Reverb -> Speakers
        this.synth.chain(eq, reverb, Tone.Destination);
        
        // Set a naturally cheerful tempo
        Tone.Transport.bpm.value = 120;
      });
    }

    return this.loadPromise;
  }

  // Called when user presses down
  public startNote(pitch: string) {
    if (!this.synth || !this.synth.loaded) {
      this.initialize();
      return;
    }
    // triggerAttack keeps playing until triggerRelease is called
    this.synth.triggerAttack(pitch);
  }

  // Called when user releases
  public stopNote(pitch: string) {
    if (this.synth && this.synth.loaded) {
        this.synth.triggerRelease(pitch);
    }
  }

  public playNote(pitch: string, durationStr: string = '8n') {
    // If not loaded yet, try to initialize in background, but we can't play this specific note yet
    if (!this.synth || !this.synth.loaded) {
      this.initialize();
      return;
    }
    // Trigger with high velocity (1.0) for a brighter, harder strike
    this.synth.triggerAttackRelease(pitch, durationStr, undefined, 1.0);
  }

  public async playSequence(notes: Note[], onComplete?: () => void) {
    if (!this.synth || !this.isInitialized) {
      await this.initialize();
    }
    
    // Stop any previous transport
    Tone.Transport.cancel();
    Tone.Transport.stop();

    const now = Tone.now();
    const startDelay = 0.5; // Short buffer

    // Sort notes by time
    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);
    if (sortedNotes.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    // Schedule each note
    notes.forEach(note => {
      // note.startTime is in 16th note steps.
      const timeOffset = note.startTime * Tone.Time('16n').toSeconds();
      const durationSeconds = note.duration * Tone.Time('16n').toSeconds();
      
      // Use full velocity (1.0) for cheerful character
      if (this.synth && this.synth.loaded) {
          this.synth.triggerAttackRelease(note.pitch, durationSeconds, now + startDelay + timeOffset, 1.0);
      }
    });

    // Calculate end time
    const lastNote = sortedNotes[sortedNotes.length - 1];
    const lastNoteEndStep = lastNote.startTime + lastNote.duration;
    const totalDurationSeconds = lastNoteEndStep * Tone.Time('16n').toSeconds();

    // Schedule cleanup/callback
    Tone.Transport.schedule(() => {
        if (onComplete) {
            setTimeout(onComplete, 0);
        }
    }, totalDurationSeconds + startDelay + 0.5);

    Tone.Transport.start();
  }

  public stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if(this.synth) {
        this.synth.releaseAll();
    }
  }
}

export const audioService = new AudioService();