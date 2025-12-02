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
      You are an expert pianist and composer.
      Task:
      1. Analyze the provided melody (JSON).
      2. Polish it: You may slightly adjust timing or add harmonies to the existing notes if they feel empty, but keep the user's main idea intact.
      3. Extend it: Add 4 to 8 bars of new music following the established key, mood, and rhythm.
      4. The total length should be the original length plus roughly 16 to 32 steps (1-2 bars) or slightly more if needed for resolution.
      5. Output the FULL sequence (original polished + extension) as JSON.
      
      Constraints:
      - 'startTime' and 'duration' are in 16th-note steps.
      - Use 'pitch' like "C4", "G#5".
      - Keep it playable on a piano.
      
      Input JSON:
      ${JSON.stringify(simplifiedNotes)}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: noteSchema,
          // Low temperature for musical consistency, but enough for creativity
          temperature: 0.4, 
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No response from AI");

      const rawNotes = JSON.parse(jsonStr) as any[];

      // Post-process to ensure IDs and AI flags are set correctly
      // We try to match old notes to preserve IDs if possible, or just regenerate
      const newNotes: Note[] = rawNotes.map((n: any, index: number) => {
        // Simple heuristic: if this note overlaps significantly with an original note, valid.
        // But simpler: Just treat everything from AI as "clean slate" based on user input, 
        // but mark the ones that start *after* the original max time as 'isAiGenerated' for visual flair.
        
        const originalMaxTime = Math.max(...currentNotes.map(cn => cn.startTime + cn.duration), 0);
        const isExtension = n.startTime >= originalMaxTime;

        return {
          id: `ai-${index}-${Date.now()}`,
          pitch: n.pitch,
          startTime: n.startTime,
          duration: n.duration,
          isAiGenerated: isExtension || !currentNotes.some(cn => cn.pitch === n.pitch && Math.abs(cn.startTime - n.startTime) < 2),
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
