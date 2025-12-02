import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Note, StaffConfig } from '../types';
import { CONFIG, PITCH_ORDER, STAFF_LINES, NOTE_COLORS } from '../constants';
import { audioService } from '../services/audioService';

interface StaffProps {
  notes: Note[];
  onAddNote: (note: Note) => void;
  onRemoveNote: (noteId: string) => void;
  isPlaying: boolean;
  playbackTime: number; // Current playback step
}

const Staff: React.FC<StaffProps> = ({ notes, onAddNote, onRemoveNote, isPlaying, playbackTime }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Dynamic width based on the furthest note or default measures
  const maxTime = Math.max(
    CONFIG.measureCount * 16, // Minimum 4 bars
    ...(notes.length ? notes.map(n => n.startTime + n.duration + 16) : [0]) // +1 bar buffer
  );
  
  const width = maxTime * CONFIG.stepWidth + 100; // Extra padding
  const height = PITCH_ORDER.length * (CONFIG.lineHeight / 2) + 100; // Height based on pitch range
  const marginTop = 50;
  const marginLeft = 60; // Space for Clef/Keys

  // Scales
  const xScale = useMemo(() => 
    d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, maxTime * CONFIG.stepWidth]),
  [maxTime]);

  const yScale = useMemo(() => 
    d3.scalePoint()
      .domain(PITCH_ORDER)
      .range([0, (PITCH_ORDER.length - 1) * (CONFIG.lineHeight / 2)])
      .padding(0.5),
  []);

  // Render Logic
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const g = svg.append("g")
      .attr("transform", `translate(${marginLeft}, ${marginTop})`);

    // 1. Draw Grid (Measure Lines & Beat Lines)
    const gridGroup = g.append("g").attr("class", "grid");
    
    // 16th note grid (faint)
    for (let i = 0; i <= maxTime; i++) {
        const isMeasure = i % 16 === 0;
        const isBeat = i % 4 === 0;
        
        if (isMeasure || isBeat) {
             gridGroup.append("line")
            .attr("x1", xScale(i))
            .attr("x2", xScale(i))
            .attr("y1", -20)
            .attr("y2", height)
            .attr("stroke", isMeasure ? "#94a3b8" : "#e2e8f0")
            .attr("stroke-width", isMeasure ? 2 : 1)
            .attr("stroke-dasharray", isMeasure ? "none" : "4 2");
        }
    }

    // 2. Draw Staff Lines
    const staffGroup = g.append("g").attr("class", "staff-lines");
    
    STAFF_LINES.forEach(pitch => {
      const y = yScale(pitch);
      if (y !== undefined) {
        staffGroup.append("line")
          .attr("x1", 0)
          .attr("x2", width)
          .attr("y1", y)
          .attr("y2", y)
          .attr("stroke", "#334155")
          .attr("stroke-width", 2);
      }
    });

    // 3. Draw Clef (Simplified visual representation)
    g.append("text")
      .attr("x", -40)
      .attr("y", (yScale("G4") || 0) + 10)
      .text("𝄞")
      .attr("font-size", "60px")
      .attr("fill", "#0f172a");

    // 4. Draw Notes
    const notesGroup = g.append("g").attr("class", "notes");

    notes.forEach(note => {
      const x = xScale(note.startTime);
      const y = yScale(note.pitch);
      const color = note.isAiGenerated ? NOTE_COLORS.AI : NOTE_COLORS.USER;
      
      if (y === undefined) return;

      const noteG = notesGroup.append("g")
        .attr("class", "note")
        .attr("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation(); // Prevent triggering background add
          // Play note on click
          audioService.playNote(note.pitch);
          // Optional: allow removing on right click or shift click? 
          // For now, let's keep it add-only on grid, undo button for mistakes.
        });

      // Note Head
      noteG.append("ellipse")
        .attr("cx", x)
        .attr("cy", y)
        .attr("rx", 8)
        .attr("ry", 6)
        .attr("fill", color)
        .attr("stroke", "white")
        .attr("stroke-width", 1);

      // Ledger Lines (if outside standard E4-F5)
      const isHigh = PITCH_ORDER.indexOf(note.pitch) < PITCH_ORDER.indexOf("F5");
      const isLow = PITCH_ORDER.indexOf(note.pitch) > PITCH_ORDER.indexOf("E4");
      
      if (isHigh || isLow) {
          // Find nearest even line
          // This is a simplified visual calculation for ledgers
          // In a full app, this logic is more complex.
          // For now, we draw a small line through the note if it's not on a staff line pitch.
          // Actually, let's just draw a line if it is C4, A5 etc.
          if (["C4", "A5", "C6", "A3"].includes(note.pitch)) {
             noteG.append("line")
                .attr("x1", x - 12)
                .attr("x2", x + 12)
                .attr("y1", y)
                .attr("y2", y)
                .attr("stroke", "#334155")
                .attr("stroke-width", 2);
          }
      }

      // Stem
      noteG.append("line")
        .attr("x1", x + 7)
        .attr("x2", x + 7)
        .attr("y1", y)
        .attr("y2", y - 35) // Upward stem for simplicity
        .attr("stroke", color)
        .attr("stroke-width", 2);
    });

    // 5. Playback Indicator
    if (isPlaying || playbackTime > 0) {
        // We use a CSS transition based rectangle or line
        // But D3 is easier for precise positioning
        // Calculate X for current 16th step.
        // We might want smooth animation, but step-based is easier to sync with Tone.js loop
        // If we want smooth, we need RequestAnimationFrame and startTime of playback. 
        // Given constraints, step indicator is acceptable.
        
        // Wait, for *smooth* playback cursor, we ideally use the Tone.Transport.seconds
        // But passing that down to React state causes too many re-renders.
        // We will just draw a line at the current playbackTime step passed from parent.
    }
    
    // 6. Interaction Overlay (Invisible rect to catch clicks)
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("click", (event) => {
        const [mx, my] = d3.pointer(event);
        
        // Quantize X to nearest 16th note step
        const stepIndex = Math.round(xScale.invert(mx));
        
        // Quantize Y to nearest Pitch
        const domain = yScale.domain();
        const range = yScale.range(); // undefined if point scale?
        // ScalePoint doesn't implement invert. We must find closest.
        const stepSize = yScale.step();
        const closestIndex = Math.round(my / stepSize);
        const pitch = domain[Math.max(0, Math.min(domain.length - 1, closestIndex))];

        if (pitch) {
            const newNote: Note = {
                id: `user-${Date.now()}`,
                pitch,
                startTime: stepIndex,
                duration: 4, // Default quarter note
                isAiGenerated: false
            };
            // Audio feedback
            audioService.playNote(pitch);
            onAddNote(newNote);
        }
      });

  }, [notes, maxTime, xScale, yScale, width, height]);


  return (
    <div 
      ref={containerRef} 
      className="staff-container overflow-x-auto overflow-y-hidden border border-slate-200 bg-white rounded-xl shadow-sm w-full relative"
      style={{ height: height + 100 }}
    >
        <svg 
            ref={svgRef} 
            width={width + marginLeft} 
            height={height + marginTop + 50} 
            className="block"
        />
        {/* Playback Cursor (React Overlay for smoother updates if needed, though doing it in D3 useEffect is okay too) */}
        {/* Using a simple absolute div for the cursor to avoid full SVG re-renders just for the cursor */}
        {(isPlaying || playbackTime > 0) && (
            <div 
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10 transition-all duration-75"
                style={{ 
                    left: `${marginLeft + xScale(playbackTime)}px`,
                    height: '100%' 
                }}
            />
        )}
    </div>
  );
};

export default Staff;
