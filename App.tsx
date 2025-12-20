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
  const [message, setMessage] = useState<string>("Hold for 2.5s to place a note.");

  // Init Audio
  useEffect(() => {
    const init = async () => {};
    init();
  }, []);

  // Playback Loop Monitor
  useEffect(() => {
    let animationId: number;
    const loop = () => {
      if (playbackState === PlaybackState.PLAYING) {
        const now = Tone.Transport.seconds;
        const secondsPerStep = (60 / 120) / 4; // Based on 120 BPM
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
    audioService.initialize();
  }, []);

  const handleUndo = useCallback(() => {
    setNotes(prev => {
        const newNotes = [...prev];
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
    setMessage(isGenerating ? "Playing while AI composes..." : "Playing...");
    audioService.playSequence(notes, () => {
      setPlaybackState(PlaybackState.STOPPED);
      setMessage(isGenerating ? "Waiting for AI..." : "Playback finished.");
    });
  }, [notes, playbackState, isGenerating]);

  const handleGenerate = useCallback(async () => {
    if (notes.length < 3) {
      setMessage("Please place at least 3 notes.");
      return;
    }
    if (isGenerating) return;
    try {
      await audioService.initialize();
      setIsGenerating(true);
      setMessage("AI is listening...");
      setPlaybackState(PlaybackState.PLAYING);
      audioService.playSequence(notes, () => {
         setPlaybackState(PlaybackState.STOPPED);
      });
      const newNotes = await geminiService.completeMelody(notes);
      setNotes(newNotes);
      setMessage("Composition complete!");
      audioService.stop();
      setTimeout(() => {
          setPlaybackState(PlaybackState.PLAYING);
          audioService.playSequence(newNotes, () => {
              setPlaybackState(PlaybackState.STOPPED);
              setMessage("Done.");
          });
      }, 500);
    } catch (error) {
      setMessage("Error generating music.");
      setPlaybackState(PlaybackState.STOPPED);
    } finally {
      setIsGenerating(false);
    }
  }, [notes, isGenerating]);

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 max-w-5xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Melody AI Composer</h1>
        <p className="text-slate-500">Long-press to record your inspiration.</p>
      </header>

      <div className="flex flex-wrap gap-4 mb-6 w-full justify-center md:justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-20">
        <div className="flex gap-2">
            <button onClick={handleUndo} disabled={notes.length === 0 || isGenerating} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Undo</button>
            <button onClick={handleClear} disabled={notes.length === 0 || isGenerating} className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">Clear</button>
        </div>
        <div className="text-sm font-medium text-slate-600">{message}</div>
        <div className="flex gap-2">
             <button onClick={handlePlay} disabled={notes.length === 0} className={`px-6 py-2 text-sm font-bold text-white rounded-lg ${playbackState === PlaybackState.PLAYING ? 'bg-amber-500' : 'bg-slate-800'}`}>
                {playbackState === PlaybackState.PLAYING ? 'Stop' : 'Play'}
            </button>
            <button onClick={handleGenerate} disabled={notes.length === 0 || isGenerating} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {isGenerating ? 'Composing...' : '✨ Generate AI'}
            </button>
        </div>
      </div>

      <Staff 
        notes={notes} onAddNote={handleAddNote} onRemoveNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
        isPlaying={playbackState === PlaybackState.PLAYING} playbackTime={playbackTime}
      />
      
      <div className="mt-6 text-sm text-slate-400 text-center">
        <p><strong>Long Press (2.5s)</strong>: Place a note at the coordinate.</p>
        <p><strong>Double-click</strong>: Remove a note.</p>
        <p className="mt-2 flex items-center gap-4 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Yours</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> AI</span>
        </p>
      </div>
    </div>
  );
};

export default App;