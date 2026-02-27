import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const askOracle = async (question: string, context: string = "") => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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
