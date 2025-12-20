import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Note } from '../types';
import { CONFIG, PITCH_ORDER, STAFF_LINES, NOTE_COLORS, GUIDE_MELODY } from '../constants';
import { audioService } from '../services/audioService';

interface StaffProps {
  notes: Note[];
  onAddNote: (note: Note) => void;
  onRemoveNote: (noteId: string) => void;
  isPlaying: boolean;
  playbackTime: number; 
  isGuideMode?: boolean;
}

const HOLD_DURATION = 2500; 
const EXCLUSION_RADIUS = 20; // 20px radius around existing notes to ignore new placement events

const Staff: React.FC<StaffProps> = ({ notes, onAddNote, onRemoveNote, isPlaying, playbackTime, isGuideMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activePointers = useRef(new Map<number, { 
    pitch: string,
    stepIndex: number,
    rippleGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    rippleInterval: ReturnType<typeof setInterval>,
    placementTimer: ReturnType<typeof setTimeout>,
    hasPlaced: boolean 
  }>());

  const maxTime = Math.max(
    CONFIG.measureCount * 16,
    isGuideMode ? 128 : 0, 
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
        mainGroup.append("g").attr("class", "guide-layer"); 
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
                .attr("y1", -20).attr("y2", height - marginTop * 2)
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
          .attr("x1", 0).attr("x2", xScale(maxTime)).attr("y1", y).attr("y2", y)
          .attr("stroke", "#334155").attr("stroke-width", 2);
      }
    });

    mainGroup.select(".clef-text")
      .attr("x", -40).attr("y", (yScale("G4") || 0) + 10)
      .text("𝄞").attr("font-size", "60px").attr("fill", "#0f172a");

    // Guide Layer
    const guideLayer = mainGroup.select(".guide-layer");
    guideLayer.selectAll("*").remove();
    if (isGuideMode) {
        GUIDE_MELODY.forEach(guide => {
            const x = xScale(guide.startTime);
            const y = yScale(guide.pitch);
            if (y === undefined) return;
            const guideG = guideLayer.append("g").attr("class", "guide-note").style("pointer-events", "none");
            guideG.append("ellipse").attr("cx", x).attr("cy", y).attr("rx", 9).attr("ry", 6).attr("fill", NOTE_COLORS.GUIDE).attr("transform", `rotate(-15, ${x}, ${y})`);
            guideG.append("line").attr("x1", x + 8).attr("y1", y).attr("x2", x + 8).attr("y2", y - 30).attr("stroke", NOTE_COLORS.GUIDE).attr("stroke-width", 1.5);
        });
    }

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
    hitRect.attr("width", xScale(maxTime)).attr("height", height - marginTop * 2);

    hitRect
      .on("pointerdown", (event) => {
        const [mx, my] = d3.pointer(event, interactionLayer.node());
        
        // Block interaction if too close to an existing note
        const isNearExistingNote = notes.some(note => {
            const nx = xScale(note.startTime);
            const ny = yScale(note.pitch);
            if (ny === undefined) return false;
            const dist = Math.sqrt(Math.pow(mx - nx, 2) + Math.pow(my - ny, 2));
            return dist < EXCLUSION_RADIUS;
        });

        if (isNearExistingNote) return;

        event.stopPropagation();
        const pointerId = event.pointerId;
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

        const placementTimer = setTimeout(() => {
            const data = activePointers.current.get(pointerId);
            if (data && !data.hasPlaced) {
                data.hasPlaced = true;
                clearInterval(data.rippleInterval);
                data.rippleGroup.transition().duration(200).attr("opacity", 0).remove();
                audioService.stopNote(data.pitch);
                
                onAddNote({
                    id: `user-${Date.now()}-${pointerId}`,
                    pitch: data.pitch,
                    startTime: data.stepIndex,
                    duration: 4,
                    isAiGenerated: false
                });
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
        const pointerId = event.pointerId;
        const data = activePointers.current.get(pointerId);
        if (data) {
            clearTimeout(data.placementTimer);
            clearInterval(data.rippleInterval);
            data.rippleGroup.remove();
            audioService.stopNote(data.pitch);
            activePointers.current.delete(pointerId);
        }
      });

    // Notes Layer
    const notesLayer = mainGroup.select(".notes-layer");
    const noteSelection = notesLayer.selectAll<SVGGElement, Note>("g.note-group")
      .data(notes, d => d.id);

    const noteEnter = noteSelection.enter().append("g")
      .attr("class", "note-group")
      .style("cursor", "pointer")
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        onRemoveNote(d.id);
      });

    noteEnter.append("ellipse")
      .attr("rx", 9).attr("ry", 6);

    noteEnter.append("line")
      .attr("stroke-width", 2);

    const noteUpdate = noteEnter.merge(noteSelection as any);

    noteUpdate.select("ellipse")
      .attr("fill", d => d.isAiGenerated ? NOTE_COLORS.AI : NOTE_COLORS.USER)
      .attr("transform", d => {
        const x = xScale(d.startTime);
        const y = yScale(d.pitch) || 0;
        return `translate(${x}, ${y}) rotate(-15)`;
      });

    noteUpdate.select("line")
      .attr("x1", d => xScale(d.startTime) + 8)
      .attr("y1", d => yScale(d.pitch) || 0)
      .attr("x2", d => xScale(d.startTime) + 8)
      .attr("y2", d => (yScale(d.pitch) || 0) - 30)
      .attr("stroke", d => d.isAiGenerated ? NOTE_COLORS.AI : NOTE_COLORS.USER);

    noteSelection.exit().remove();

    // Playback marker
    let marker = mainGroup.select<SVGLineElement>("line.playback-marker");
    if (marker.empty()) {
        marker = mainGroup.append("line")
            .attr("class", "playback-marker")
            .attr("stroke", NOTE_COLORS.PLAYING)
            .attr("stroke-width", 2)
            .attr("y1", -20)
            .attr("y2", height - marginTop * 2);
    }

    if (isPlaying) {
      marker.attr("x1", xScale(playbackTime)).attr("x2", xScale(playbackTime)).attr("opacity", 1);
    } else {
      marker.attr("opacity", 0);
    }

  }, [notes, isPlaying, playbackTime, xScale, yScale, height, width, isGuideMode, onAddNote, onRemoveNote, maxTime]);

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-x-auto bg-white rounded-2xl shadow-inner border border-slate-200 p-8 custom-scrollbar"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
    >
      <svg ref={svgRef} width={width} height={height}></svg>
    </div>
  );
};

export default Staff;