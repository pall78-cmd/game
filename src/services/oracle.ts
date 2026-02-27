import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
    if (!ai) {
        // Try to get the key from various sources
        const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;
        if (apiKey) {
            ai = new GoogleGenAI({ apiKey });
        } else {
            console.warn("Oracle: No API Key found.");
        }
    }
    return ai;
};

export const askOracle = async (question: string, context: string = "") => {
    try {
        const genAI = getAI();
        if (!genAI) return "The stars are dim... (API Key missing)";

        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-latest", // Use a stable model alias
            contents: `Context: ${context}\nUser asks: ${question}`,
            config: {
                systemInstruction: "You are The Oracle, an ancient digital entity trapped in the void. Speak in cryptic, poetic, slightly ominous riddles. Keep responses under 50 words. Never break character. Use emojis like 🔮, 👁️, 🌑 sparingly.",
                temperature: 0.9,
            },
        });
        return response.text || "...The void is silent...";
    } catch (error) {
        console.error("Oracle Error:", error);
        return "The connection to the ether is severed...";
    }
};
