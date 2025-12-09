import { GoogleGenAI, Type } from "@google/genai";
import { Note } from "../types";

// Schema for Gemini output
const noteSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pitch: { type: Type.STRING, description: "Pitch in format like C4, F#5" },
      startTime: { type: Type.NUMBER, description: "Start time in 16th note steps (0-based integer)" },
      duration: { type: Type.NUMBER, description: "Duration in 16th note steps (integer)" },
    },
    required: ["pitch", "startTime", "duration"]
  }
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async completeMelody(currentNotes: Note[]): Promise<Note[]> {
    // 1. Prepare Prompt
    // Minimize token usage by mapping strict necessary data
    const simplifiedNotes = currentNotes.map(n => ({
      pitch: n.pitch,
      startTime: n.startTime,
      duration: n.duration
    }));

    const prompt = `
      You are a world-class composer and pianist. Your task is to turn a user's simple melody sketch into a beautiful, complete musical piece.

      CRITICAL INSTRUCTIONS:
      1. **Harmonize & Infill**: Do NOT just add notes to the end. You MUST add notes *between* the user's notes and *simultaneous* to them (chords/bass).
         - If the user provided a single melody line, add a left-hand accompaniment (bass notes, chords, or arpeggios in ranges C3-B3).
         - Fill empty rhythmic gaps in the user's melody to create a smooth flow, but keep the user's original motif recognizable.
      2. **Polish**: You may slightly adjust the user's note timings or durations if they are rhythmically awkward, but respect their general intent.
      3. **Extend**: After processing the user's section, extend the piece by 4 to 8 bars to bring it to a satisfying musical resolution.
      4. **Style**: Create a pleasant, coherent piece (e.g., Classical, Jazz, or Pop Ballad style).
      5. **Output**: Return the ENTIRE sequence (enhanced user notes + new extension).

      Constraints:
      - 'startTime' and 'duration' are in 16th-note steps.
      - Use 'pitch' like "C3", "C#4".
      - Ensure the output is playable (two hands max).
      
      Input Melody (JSON):
      ${JSON.stringify(simplifiedNotes)}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: noteSchema,
          // Slightly higher temperature for more creative harmonies
          temperature: 0.5, 
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No response from AI");

      const rawNotes = JSON.parse(jsonStr) as any[];

      // Post-process to ensure IDs and AI flags are set correctly
      const newNotes: Note[] = rawNotes.map((n: any, index: number) => {
        
        // Determine if this note is "new" or "modified".
        // We consider a note "AI generated" if:
        // 1. It is completely outside the time range of original notes (Extension)
        // 2. OR it does not match any original note at that specific time/pitch (Harmonization/Infill)
        
        const isOriginalMatch = currentNotes.some(cn => 
            cn.pitch === n.pitch && 
            Math.abs(cn.startTime - n.startTime) < 1 // Strict timing match
        );

        return {
          id: `ai-${index}-${Date.now()}`,
          pitch: n.pitch,
          startTime: n.startTime,
          duration: n.duration,
          isAiGenerated: !isOriginalMatch, // Highlight everything the AI added or changed
        };
      });

      return newNotes;

    } catch (error) {
      console.error("Gemini Music Generation Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();