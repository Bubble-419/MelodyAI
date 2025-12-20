import React, { useState, useEffect, useCallback } from 'react';
import { Note, PlaybackState } from './types';
import Staff from './components/Staff';
import { audioService } from './services/audioService';
import { geminiService } from './services/geminiService';
import * as Tone from 'tone';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [playbackTime, setPlaybackTime] = useState(0); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGuideMode, setIsGuideMode] = useState(false);
  const [hasShownGuideHint, setHasShownGuideHint] = useState(false);
  const [triggerHint, setTriggerHint] = useState(false);
  const [message, setMessage] = useState<string>("Hold for 2.5s to place a note.");

  // Playback Loop Monitor
  useEffect(() => {
    let animationId: number;
    const loop = () => {
      if (playbackState === PlaybackState.PLAYING) {
        const now = Tone.Transport.seconds;
        const secondsPerStep = (60 / 120) / 4; 
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

  // Trigger hint animation once when entering guide mode for the first time
  useEffect(() => {
    if (isGuideMode && !hasShownGuideHint) {
      setTriggerHint(true);
      setHasShownGuideHint(true);
      // Reset trigger state after animation finishes (approx 5s)
      setTimeout(() => setTriggerHint(false), 5500);
    }
  }, [isGuideMode, hasShownGuideHint]);

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

  const handlePlay = useCallback(async (e?: React.PointerEvent) => {
    if (e) e.preventDefault();
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

  const handleGenerate = useCallback(async (e?: React.PointerEvent) => {
    if (e) e.preventDefault();
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
    <div className="min-h-screen flex flex-col items-center py-10 px-4 max-w-5xl mx-auto select-none">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Melody AI Composer</h1>
        <p className="text-slate-500">Long-press to record your inspiration.</p>
      </header>

      <div className="flex flex-wrap gap-4 mb-6 w-full justify-center md:justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-20">
        <div className="flex gap-2 items-center">
            <button onPointerDown={handleUndo} disabled={notes.length === 0 || isGenerating} className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 touch-manipulation">Undo</button>
            <button onPointerDown={handleClear} disabled={notes.length === 0 || isGenerating} className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 touch-manipulation">Clear</button>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <label className="flex items-center cursor-pointer select-none">
                <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isGuideMode} onChange={() => setIsGuideMode(!isGuideMode)} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isGuideMode ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isGuideMode ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <div className="ml-3 text-sm font-medium text-slate-700">
                    Guide Mode 💡
                </div>
            </label>
        </div>

        <div className="text-sm font-medium text-slate-600 hidden lg:block">{message}</div>

        <div className="flex gap-2">
             <button 
                onPointerDown={handlePlay} 
                disabled={notes.length === 0} 
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg touch-manipulation transition-colors ${playbackState === PlaybackState.PLAYING ? 'bg-amber-500' : 'bg-slate-800'}`}
             >
                {playbackState === PlaybackState.PLAYING ? 'Stop' : 'Play'}
            </button>
            <button 
                onPointerDown={handleGenerate} 
                disabled={notes.length === 0 || isGenerating} 
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 touch-manipulation transition-colors"
            >
                {isGenerating ? 'Composing...' : '✨ Generate AI'}
            </button>
        </div>
      </div>

      <Staff 
        notes={notes} onAddNote={handleAddNote} onRemoveNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
        isPlaying={playbackState === PlaybackState.PLAYING} playbackTime={playbackTime}
        isGuideMode={isGuideMode}
        showHintAnimation={triggerHint}
      />
      
      <div className="mt-6 text-sm text-slate-400 text-center">
        <p><strong>Long Press (2.5s)</strong>: Place a note. {isGuideMode ? "Follow the glowing dots!" : ""}</p>
        <p><strong>Double-click</strong>: Remove a note.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Yours</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> AI</span>
            {isGuideMode && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-300 inline-block animate-pulse"></span> Guide (Little Star)</span>}
        </div>
      </div>
    </div>
  );
};

export default App;