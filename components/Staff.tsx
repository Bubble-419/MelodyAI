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
  showHintAnimation?: boolean;
}

const HOLD_DURATION = 2500; 
const EXCLUSION_RADIUS = 20;

// The SVG content string (slightly modified for easier coloring/animation)
const HINT_SVG_CONTENT = `
<g transform="scale(0.35)">
  <path d="M299 192.453C299 250.443 251.542 297.453 193 297.453C134.458 297.453 87 250.443 87 192.453C87 134.463 134.458 87.4526 193 87.4526C251.542 87.4526 299 134.463 299 192.453Z" fill="url(#paint0_hint_grad)"/>
  <path d="M299 192.453H297.557C297.557 249.633 250.758 296.01 193 296.01V297.453V298.896C252.326 298.896 300.443 251.252 300.443 192.453H299ZM193 297.453V296.01C135.242 296.01 88.4431 249.633 88.4431 192.453H87H85.5569C85.5569 251.252 133.674 298.896 193 298.896V297.453ZM87 192.453H88.4431C88.4431 135.273 135.242 88.8958 193 88.8958V87.4526V86.0095C133.674 86.0095 85.5569 133.653 85.5569 192.453H87ZM193 87.4526V88.8958C250.758 88.8958 297.557 135.273 297.557 192.453H299H300.443C300.443 133.653 252.326 86.0095 193 86.0095V87.4526Z" fill="#6366f1" fill-opacity="0.5"/>
  <path d="M268 191.695C268 232.84 234.197 266.195 192.5 266.195C150.803 266.195 117 232.84 117 191.695C117 150.549 150.803 117.195 192.5 117.195C234.197 117.195 268 150.549 268 191.695Z" fill="url(#paint2_hint_grad)"/>
  <path d="M236 192.195C236 215.391 216.748 234.195 193 234.195C169.252 234.195 150 215.391 150 192.195C150 168.999 169.252 150.195 193 150.195C216.748 150.195 236 168.999 236 192.195Z" fill="url(#paint4_hint_grad)"/>
  <path d="M233.221 307.266C215.721 290.266 176.721 291.766 180.221 277.766C181.221 273.433 186.721 264.366 200.721 262.766C218.221 260.766 236.221 264.266 243.721 266.766C251.221 269.266 281.221 277.766 285.721 277.766C290.221 277.766 293.721 278.766 296.221 276.766C298.721 274.766 300.221 273.766 298.221 269.766C296.221 265.766 290.221 249.266 290.221 242.766C288.221 237.266 283.221 224.766 280.721 219.266C278.221 213.766 254.221 181.766 253.221 175.266C250.221 169.266 228.721 141.766 226.721 136.766C224.721 131.766 218.721 116.266 221.721 108.266C224.055 106.266 229.121 102.066 230.721 101.266C232.721 100.266 235.721 102.266 239.721 104.266C243.721 106.266 261.721 124.766 266.221 130.766C270.721 136.766 276.721 139.766 283.221 146.766C289.721 153.766 307.721 186.766 320.721 191.766C331.121 195.766 341.055 191.099 344.721 188.266C346.388 186.099 355.621 176.266 365.221 176.266C377.221 176.266 375.221 178.766 387.221 185.266C394.721 185.766 392.393 173.865 413.221 181.766C427.721 187.266 446.261 175.266 457.394 205.766C461.095 215.905 489.394 302.766 502.894 318.266C531.894 347.766 538.894 357.266 539.894 375.266C540.894 393.266 522.894 406.766 511.894 416.766C493.394 436.766 484.894 444.766 467.894 445.266C450.894 445.766 433.894 428.766 426.394 418.766C418.894 408.766 385.894 383.266 369.394 378.766C340.894 371.766 299.221 333.766 296.221 331.266C293.221 328.766 283.721 325.266 275.22 321.766C268.6 319.041 237.1 311.034 233.221 307.266Z" fill="#CBD5E1" fill-opacity="0.8"/>
  
  <defs>
    <linearGradient id="paint0_hint_grad" x1="193" y1="87.4526" x2="193" y2="297.453" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366f1" stop-opacity="0.3"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="paint2_hint_grad" x1="192.5" y1="117.195" x2="192.5" y2="266.195" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366f1" stop-opacity="0.2"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="paint4_hint_grad" x1="193" y1="150.195" x2="193" y2="234.195" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366f1" stop-opacity="0.1"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
</g>
`;

const Staff: React.FC<StaffProps> = ({ notes, onAddNote, onRemoveNote, isPlaying, playbackTime, isGuideMode = false, showHintAnimation = false }) => {
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

  // Instructional Hint Animation Logic
  useEffect(() => {
    if (!showHintAnimation || !svgRef.current || !isGuideMode) return;
    
    const svg = d3.select(svgRef.current);
    const mainGroup = svg.select("g.main-content");
    if (mainGroup.empty()) return;

    // Get the position of the first guide note
    const firstGuide = GUIDE_MELODY[0];
    const targetX = xScale(firstGuide.startTime);
    const targetY = yScale(firstGuide.pitch) || 0;

    // Create the hint group
    const hintGroup = mainGroup.append("g")
        .attr("class", "instructional-hint")
        .attr("opacity", 0);

    // Inject the silhouette SVG
    hintGroup.html(HINT_SVG_CONTENT);
    const handSilhouette = hintGroup.select("g");

    // Anchor point for the silhouette (approx center of the circles in 749x447 space)
    // 193 is the horizontal center of the circles. 192 is vertical.
    // Scaled by 0.35: offsetX = 193 * 0.35 = 67.55, offsetY = 192 * 0.35 = 67.2
    const anchorX = 67.5;
    const anchorY = 67.2;

    // Start position: slide in from right-bottom
    handSilhouette.attr("transform", `translate(${targetX - anchorX + 250}, ${targetY - anchorY + 150}) scale(0.35) rotate(-15)`);

    // Animation: Fade in and slide to target
    hintGroup.transition().duration(1000).attr("opacity", 1)
        .on("end", () => {
            handSilhouette.transition().duration(1500).ease(d3.easeCubicInOut)
                .attr("transform", `translate(${targetX - anchorX}, ${targetY - anchorY}) scale(0.35) rotate(0)`)
                .on("end", () => {
                    // Simulate the "Long Press" with a loading ring
                    const progressRing = hintGroup.append("circle")
                        .attr("cx", targetX).attr("cy", targetY)
                        .attr("r", 0).attr("fill", "none")
                        .attr("stroke", "#6366f1").attr("stroke-width", 3);

                    progressRing.transition().duration(HOLD_DURATION).ease(d3.easeLinear)
                        .attr("r", 40)
                        .on("end", () => {
                            // Once done, fade out everything
                            hintGroup.transition().duration(1000).attr("opacity", 0).remove();
                        });
                });
        });

    return () => {
        hintGroup.remove();
    };
  }, [showHintAnimation, isGuideMode, xScale, yScale]);

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

  }, [notes, isPlaying, playbackTime, xScale, yScale, height, width, isGuideMode, onAddNote, onRemoveNote, maxTime, showHintAnimation]);

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-x-auto bg-white rounded-2xl shadow-inner border border-slate-200 p-8 custom-scrollbar staff-container"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
    >
      <svg ref={svgRef} width={width} height={height}></svg>
    </div>
  );
};

export default Staff;