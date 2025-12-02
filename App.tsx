import React, { useState, useEffect, useCallback } from 'react';
import { Note, PlaybackState } from './types';
import Staff from './components/Staff';
import { audioService } from './services/audioService';
import { geminiService } from './services/geminiService';
import * as Tone from 'tone';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [playbackTime, setPlaybackTime] = useState(0); // In steps
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string>("Click on the staff to place notes.");

  // Init Audio
  useEffect(() => {
    const init = async () => {
      // User interaction usually required to start audio context
      // We'll handle it on the first click on the UI
    };
    init();
  }, []);

  // Playback Loop Monitor
  useEffect(() => {
    let animationId: number;

    const loop = () => {
      if (playbackState === PlaybackState.PLAYING) {
        // Sync visual cursor with Tone.Transport
        // Tone.Transport.position returns "BAR:BEAT:SIXTEENTH"
        // We can get seconds and convert, or use ticks.
        // Simplest: Get seconds, convert to steps.
        const now = Tone.Transport.seconds;
        // 1 step = 16th note.
        // BPM 100. 1 beat = 60/100 = 0.6s. 1 step = 0.15s.
        const secondsPerStep = (60 / 100) / 4;
        const currentStep = now / secondsPerStep;
        
        setPlaybackTime(currentStep);
        animationId = requestAnimationFrame(loop);
      }
    };

    if (playbackState === PlaybackState.PLAYING) {
      loop();
    } else {
      setPlaybackTime(0);
    }

    return () => cancelAnimationFrame(animationId);
  }, [playbackState]);

  const handleAddNote = useCallback((note: Note) => {
    setNotes(prev => [...prev, note]);
    audioService.initialize(); // Ensure audio is ready on first interaction
  }, []);

  const handleUndo = useCallback(() => {
    setNotes(prev => {
        const newNotes = [...prev];
        // Remove the last added note (assuming user added them in order of creation, or just remove last in array)
        // If we want "undo last action", popping last array element is correct.
        newNotes.pop();
        return newNotes;
    });
  }, []);

  const handleClear = useCallback(() => {
    setNotes([]);
    setPlaybackState(PlaybackState.STOPPED);
    audioService.stop();
  }, []);

  const handlePlay = useCallback(async () => {
    if (notes.length === 0) return;
    
    await audioService.initialize();
    
    if (playbackState === PlaybackState.PLAYING) {
      audioService.stop();
      setPlaybackState(PlaybackState.STOPPED);
      return;
    }

    setPlaybackState(PlaybackState.PLAYING);
    setMessage("Playing...");

    audioService.playSequence(notes, () => {
      setPlaybackState(PlaybackState.STOPPED);
      setMessage("Playback finished.");
    });
  }, [notes, playbackState]);

  const handleGenerate = useCallback(async () => {
    if (notes.length < 3) {
      setMessage("Please place at least 3 notes before generating.");
      return;
    }

    if (isGenerating) return;

    try {
      await audioService.initialize();
      setIsGenerating(true);
      setMessage("Generating accompaniment... (Playing your notes while you wait)");

      // 1. Start playing current notes immediately for perceived speed
      // We don't block the AI call.
      setPlaybackState(PlaybackState.PLAYING);
      audioService.playSequence(notes, () => {
         // If AI is still thinking, we just wait.
         // If AI is done, the effect will trigger re-render and we might want to play full result?
         // For now, let's stop.
         setPlaybackState(PlaybackState.STOPPED);
      });

      // 2. Call Gemini in background
      const newNotes = await geminiService.completeMelody(notes);
      
      // 3. Update state
      setNotes(newNotes);
      setMessage("AI Composition complete! Playing full version...");
      
      // 4. Stop current playback (if any) and restart with full notes
      audioService.stop();
      // Small timeout to allow cleanup
      setTimeout(() => {
          setPlaybackState(PlaybackState.PLAYING);
          audioService.playSequence(newNotes, () => {
              setPlaybackState(PlaybackState.STOPPED);
              setMessage("Done.");
          });
      }, 500);

    } catch (error) {
      setMessage("Error generating music. Please try again.");
      console.error(error);
      setPlaybackState(PlaybackState.STOPPED);
    } finally {
      setIsGenerating(false);
    }
  }, [notes, isGenerating]);

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 max-w-5xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Melody AI Composer</h1>
        <p className="text-slate-500">
          Place notes on the staff. Let AI complete your masterpiece.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 w-full justify-center md:justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-20">
        <div className="flex gap-2">
            <button 
                onClick={handleUndo}
                disabled={notes.length === 0 || isGenerating}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
                Undo
            </button>
            <button 
                onClick={handleClear}
                disabled={notes.length === 0 || isGenerating}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
                Clear
            </button>
        </div>

        <div className="text-sm font-medium text-slate-600 animate-pulse">
            {message}
        </div>

        <div className="flex gap-2">
             <button 
                onClick={handlePlay}
                disabled={notes.length === 0 || isGenerating}
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 ${
                    playbackState === PlaybackState.PLAYING 
                    ? 'bg-amber-500 hover:bg-amber-600' 
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
            >
                {playbackState === PlaybackState.PLAYING ? 'Stop' : 'Play'}
            </button>
            <button 
                onClick={handleGenerate}
                disabled={notes.length === 0 || isGenerating}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200"
            >
                {isGenerating ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Composing...
                    </span>
                ) : (
                    '✨ Generate AI Completion'
                )}
            </button>
        </div>
      </div>

      {/* Staff Display */}
      <Staff 
        notes={notes} 
        onAddNote={handleAddNote} 
        onRemoveNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
        isPlaying={playbackState === PlaybackState.PLAYING}
        playbackTime={playbackTime}
      />
      
      <div className="mt-6 text-sm text-slate-400">
        <p>Tip: You can place multiple notes on the same vertical line to create chords.</p>
        <p className="mt-1 flex items-center gap-4 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Your Notes</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> AI Generated</span>
        </p>
      </div>
    </div>
  );
};

export default App;
