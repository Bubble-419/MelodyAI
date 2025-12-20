import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Note } from '../types';
import { CONFIG, PITCH_ORDER, STAFF_LINES, NOTE_COLORS } from '../constants';
import { audioService } from '../services/audioService';

interface StaffProps {
  notes: Note[];
  onAddNote: (note: Note) => void;
  onRemoveNote: (noteId: string) => void;
  isPlaying: boolean;
  playbackTime: number; // Current playback step
}

const HOLD_DURATION = 2500; // 2.5 seconds to confirm note placement

const Staff: React.FC<StaffProps> = ({ notes, onAddNote, onRemoveNote, isPlaying, playbackTime }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track active pointers for multi-touch and their specific hold states
  const activePointers = useRef(new Map<number, { 
    pitch: string,
    stepIndex: number,
    rippleGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    rippleInterval: ReturnType<typeof setInterval>,
    placementTimer: ReturnType<typeof setTimeout>,
    hasPlaced: boolean // Flag to prevent multiple placements per hold
  }>());

  const maxTime = Math.max(
    CONFIG.measureCount * 16,
    ...(notes.length ? notes.map(n => n.startTime + n.duration + 16) : [0])
  );
  
  const width = maxTime * CONFIG.stepWidth + 100;
  const height = PITCH_ORDER.length * (CONFIG.lineHeight / 2) + 100;
  const marginTop = 50;
  const marginLeft = 60;

  const xScale = useMemo(() => 
    d3.scaleLinear().domain([0, maxTime]).range([0, maxTime * CONFIG.stepWidth]),
  [maxTime]);

  const yScale = useMemo(() => 
    d3.scalePoint()
      .domain(PITCH_ORDER)
      .range([0, (PITCH_ORDER.length - 1) * (CONFIG.lineHeight / 2)])
      .padding(0.5),
  []);

  useEffect(() => {
    return () => {
      activePointers.current.forEach(p => {
        clearInterval(p.rippleInterval);
        clearTimeout(p.placementTimer);
        audioService.stopNote(p.pitch);
      });
      activePointers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    let mainGroup = svg.select<SVGGElement>("g.main-content");
    if (mainGroup.empty()) {
        mainGroup = svg.append("g")
            .attr("class", "main-content")
            .attr("transform", `translate(${marginLeft}, ${marginTop})`);
        
        mainGroup.append("g").attr("class", "grid-layer");
        mainGroup.append("g").attr("class", "staff-layer");
        mainGroup.append("g").attr("class", "interaction-layer");
        mainGroup.append("g").attr("class", "notes-layer");
        mainGroup.append("text").attr("class", "clef-text");
    }

    // Grid
    const gridLayer = mainGroup.select(".grid-layer");
    gridLayer.selectAll("*").remove();
    for (let i = 0; i <= maxTime; i++) {
        const isMeasure = i % 16 === 0;
        const isBeat = i % 4 === 0;
        if (isMeasure || isBeat) {
            gridLayer.append("line")
                .attr("x1", xScale(i)).attr("x2", xScale(i))
                .attr("y1", -20).attr("y2", height)
                .attr("stroke", isMeasure ? "#94a3b8" : "#e2e8f0")
                .attr("stroke-width", isMeasure ? 2 : 1)
                .attr("stroke-dasharray", isMeasure ? "none" : "4 2");
        }
    }

    // Staff Lines
    const staffLayer = mainGroup.select(".staff-layer");
    staffLayer.selectAll("*").remove();
    STAFF_LINES.forEach(pitch => {
      const y = yScale(pitch);
      if (y !== undefined) {
        staffLayer.append("line")
          .attr("x1", 0).attr("x2", width).attr("y1", y).attr("y2", y)
          .attr("stroke", "#334155").attr("stroke-width", 2);
      }
    });

    mainGroup.select(".clef-text")
      .attr("x", -40).attr("y", (yScale("G4") || 0) + 10)
      .text("𝄞").attr("font-size", "60px").attr("fill", "#0f172a");

    // Interaction Layer
    const interactionLayer = mainGroup.select(".interaction-layer");
    let hitRect = interactionLayer.select<SVGRectElement>("rect.hit-rect");
    if (hitRect.empty()) {
        hitRect = interactionLayer.append("rect")
            .attr("class", "hit-rect")
            .attr("fill", "transparent")
            .style("touch-action", "none")
            .on("contextmenu", (e) => e.preventDefault());
    }

    hitRect.attr("width", width).attr("height", height);

    hitRect
      .on("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const pointerId = event.pointerId;
        const [mx, my] = d3.pointer(event, interactionLayer.node());
        
        const stepIndex = Math.round(xScale.invert(mx));
        const domain = yScale.domain();
        const stepSize = yScale.step();
        const closestIndex = Math.round(my / stepSize);
        const pitch = domain[Math.max(0, Math.min(domain.length - 1, closestIndex))];

        if (!pitch) return;

        const targetX = xScale(stepIndex);
        const targetY = yScale(pitch) || my;

        audioService.startNote(pitch);

        const rippleGroup = interactionLayer.append("g")
            .attr("transform", `translate(${targetX}, ${targetY})`)
            .style("pointer-events", "none");

        const spawnRipple = () => {
            rippleGroup.append("circle")
                .attr("r", 0).attr("fill", "none").attr("stroke", NOTE_COLORS.USER).attr("stroke-width", 2).attr("opacity", 0.8)
                .transition().duration(1000).ease(d3.easeLinear).attr("r", 50).attr("opacity", 0)
                .on("end", function() { d3.select(this).remove(); });
        };

        spawnRipple();
        const rippleInterval = setInterval(spawnRipple, 400);

        // Define what happens when hold duration is reached
        const placementTimer = setTimeout(() => {
            const data = activePointers.current.get(pointerId);
            if (data && !data.hasPlaced) {
                // 1. Mark as placed
                data.hasPlaced = true;
                
                // 2. Clear ripples
                clearInterval(data.rippleInterval);
                data.rippleGroup.transition().duration(200).attr("opacity", 0).remove();
                
                // 3. Stop sound
                audioService.stopNote(data.pitch);
                
                // 4. Add the actual note
                const newNote: Note = {
                    id: `user-${Date.now()}-${pointerId}`,
                    pitch: data.pitch,
                    startTime: data.stepIndex,
                    duration: 4, // Fixed Quarter Note
                    isAiGenerated: false
                };
                onAddNote(newNote);
            }
        }, HOLD_DURATION);

        activePointers.current.set(pointerId, {
            pitch,
            stepIndex,
            rippleGroup,
            rippleInterval,
            placementTimer,
            hasPlaced: false
        });

        (event.target as Element).setPointerCapture(pointerId);
      })
      .on("pointerup pointercancel", (event) => {
        event.preventDefault();
        const pointerId = event.pointerId;
        const data = activePointers.current.get(pointerId);
        
        if (data) {
            // Cleanup
            clearTimeout(data.placementTimer);
            clearInterval(data.rippleInterval);
            data.rippleGroup.remove();
            audioService.stopNote(data.pitch);
            
            activePointers.current.delete(pointerId);
        }
      });

    // Notes Layer
    const notesLayer = mainGroup.select(".notes-layer");
    notesLayer.selectAll("*").remove();

    notes.forEach(note => {
      const x = xScale(note.startTime);
      const y = yScale(note.pitch);
      const color = note.isAiGenerated ? NOTE_COLORS.AI : NOTE_COLORS.USER;
      if (y === undefined) return;

      const noteG = notesLayer.append("g")
        .attr("class", "note").attr("cursor", "pointer")
        .on("pointerdown", (event) => event.stopPropagation())
        .on("click", (event) => {
          event.stopPropagation(); 
          audioService.playNote(note.pitch);
        })
        .on("dblclick", (event) => {
           event.preventDefault(); event.stopPropagation();
           onRemoveNote(note.id);
        });

      noteG.append("rect")
        .attr("x", x - 15).attr("y", y - 15).attr("width", 30).attr("height", 30).attr("fill", "transparent");

      noteG.append("ellipse")
        .attr("cx", x).attr("cy", y).attr("rx", 9).attr("ry", 6).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1)
        .attr("pointer-events", "none").attr("transform", `rotate(-15, ${x}, ${y})`);

      const pitchIndex = PITCH_ORDER.indexOf(note.pitch);
      const centerIndex = PITCH_ORDER.indexOf("B4");
      const isStemUp = pitchIndex > centerIndex;
      const stemX = isStemUp ? x + 8 : x - 8;
      const stemYStart = y;
      const stemYEnd = isStemUp ? y - 35 : y + 35;

      noteG.append("line")
        .attr("x1", stemX).attr("y1", stemYStart).attr("x2", stemX).attr("y2", stemYEnd)
        .attr("stroke", color).attr("stroke-width", 2).attr("pointer-events", "none");

      const isHigh = PITCH_ORDER.indexOf(note.pitch) <= PITCH_ORDER.indexOf("A5") && PITCH_ORDER.indexOf(note.pitch) < PITCH_ORDER.indexOf("F5");
      const isLow = PITCH_ORDER.indexOf(note.pitch) >= PITCH_ORDER.indexOf("C4") && PITCH_ORDER.indexOf(note.pitch) > PITCH_ORDER.indexOf("E4");
      
      if (isHigh || isLow) {
          if (["C4", "A5", "C6", "A3"].includes(note.pitch)) {
             noteG.append("line")
                .attr("x1", x - 14).attr("x2", x + 14).attr("y1", y).attr("y2", y)
                .attr("stroke", "#334155").attr("stroke-width", 2).attr("pointer-events", "none");
          }
      }
    });

  }, [notes, maxTime, xScale, yScale, width, height]);

  return (
    <div 
      ref={containerRef} 
      className="staff-container overflow-x-auto overflow-y-hidden border border-slate-200 bg-white rounded-xl shadow-sm w-full relative"
      style={{ height: height + 100, touchAction: 'none' }}
    >
        <svg ref={svgRef} width={width + marginLeft} height={height + marginTop + 50} className="block select-none" />
        {(isPlaying || playbackTime > 0) && (
            <div 
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10 transition-all duration-75"
                style={{ left: `${marginLeft + xScale(playbackTime)}px`, height: '100%' }}
            />
        )}
    </div>
  );
};

export default Staff;