import { GoogleGenAI, Type } from "@google/genai";
import { CommentaryResponse } from "../types";

let ai: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

export const generateCommentary = async (
  playerScore: number,
  cpuScore: number,
  lastEvent: string
): Promise<CommentaryResponse> => {
  if (!ai) {
    return { text: "AI Commentary unavailable (Check API Key).", mood: 'neutral' };
  }

  const prompt = `
    You are a high-energy, witty beach volleyball commentator. 
    The current score is: Mr. B ${playerScore} - Sören sein Vater ${cpuScore}.
    The last event was: "${lastEvent}".
    
    Provide a short, punchy commentary (max 1 sentence) in German. 
    Also select a mood for the commentary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            mood: { 
              type: Type.STRING, 
              enum: ['excited', 'sarcastic', 'neutral', 'encouraging'] 
            }
          },
          required: ['text', 'mood']
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    return JSON.parse(jsonText) as CommentaryResponse;
  } catch (error) {
    console.error("Error generating commentary:", error);
    return { 
      text: "Was für ein Spiel! (AI Offline)", 
      mood: 'neutral' 
    };
  }
};