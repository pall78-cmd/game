import { CryptoUtils } from './crypto';

export interface ReplyData {
    id: string;
    name: string;
    text: string;
}

export interface ParsedMessage {
    isVO: boolean;
    replyData: ReplyData | null;
    type: 'text' | 'vn' | 'img' | 'game';
    content: string;
    originalText: string;
    vnDuration: number | null;
    isEdited: boolean;
}

export const MessageParser = {
    parse: (rawText: string, encKey?: string): ParsedMessage => {
        if (!rawText) return { isVO: false, replyData: null, type: 'text', content: '', originalText: '', vnDuration: null, isEdited: false };

        let text = rawText;
        try {
            const key = encKey || localStorage.getItem('enc_key') || '';
            text = CryptoUtils.decrypt(text, key);
        } catch (e) {}

        let isVO = false;
        let isEdited = false;
        let replyData: ReplyData | null = null;
        let replyChain: ReplyData[] = [];

        // Handle multiple [EDITED] tags just in case
        while (text.endsWith("[EDITED]")) {
            isEdited = true;
            text = text.substring(0, text.length - 8).trim();
        }

        if (text.startsWith("[VO]")) {
            isVO = true;
            text = text.substring(4);
        }

        while (true) {
            const replyMatch = text.match(/^\[REPLY:(.+?)\](.*)$/s);
            if (replyMatch) {
                try {
                    const jsonStr = replyMatch[1];
                    const parsedReply = JSON.parse(jsonStr);
                    replyChain.push(parsedReply);
                    replyData = parsedReply; // The last one is the actual direct reply if multiple exist
                    text = replyMatch[2]; 
                } catch (e) {
                    console.warn("Failed to parse reply JSON:", e);
                    break;
                }
            } else {
                break;
            }
        }

        let type: 'text' | 'vn' | 'img' | 'game' = "text";
        let content = text;
        let vnDuration: number | null = null;

        if (text.startsWith("[VN]")) {
            type = "vn";
            const rawVn = text.substring(4).trim();
            if (rawVn.includes('|')) {
                const parts = rawVn.split('|');
                content = parts[0];
                vnDuration = parseFloat(parts[1]);
            } else {
                content = rawVn;
            }
        } else if (text.startsWith("[IMG]")) {
            type = "img";
            const rawImg = text.substring(5).trim();
            const firstSpace = rawImg.indexOf(' ');
            const firstNewline = rawImg.indexOf('\n');
            
            let splitIndex = -1;
            if (firstSpace !== -1 && firstNewline !== -1) splitIndex = Math.min(firstSpace, firstNewline);
            else if (firstSpace !== -1) splitIndex = firstSpace;
            else if (firstNewline !== -1) splitIndex = firstNewline;
            
            if (splitIndex !== -1) {
                const url = rawImg.substring(0, splitIndex);
                const caption = rawImg.substring(splitIndex).trim();
                content = `${url}\n${caption}`;
            } else {
                content = rawImg;
            }
        } else if (text.startsWith("GAME ")) {
            type = "game";
        }

        return { isVO, replyData, type, content, originalText: rawText, vnDuration, isEdited };
    },

    getPreview: (rawText: string, encKey?: string): string => {
        if (!rawText) return "";
        let currentText = rawText;
        try {
            const key = encKey || localStorage.getItem('enc_key') || '';
            currentText = CryptoUtils.decrypt(currentText, key);
        } catch (e) {}

        while (currentText.endsWith("[EDITED]")) {
            currentText = currentText.substring(0, currentText.length - 8).trim();
        }

        while (true) {
            let changed = false;
            if (currentText.startsWith("[VO]")) {
                currentText = currentText.substring(4);
                changed = true;
            }
            const replyMatch = currentText.match(/^\[REPLY:(.+?)\](.*)$/s);
            if (replyMatch) {
                currentText = replyMatch[2];
                changed = true;
            }
            if (!changed) break;
        }
        currentText = currentText.trim();
        if (currentText.startsWith('{')) {
            try {
                const parsed = JSON.parse(currentText);
                if (parsed.content) currentText = parsed.content;
            } catch (e) {}
        }
        if (currentText.startsWith("[VN]")) return "🎤 Voice Note";
        if (currentText.startsWith("[IMG]")) return "🖼️ Image";
        if (currentText.startsWith("GAME ")) {
             const parts = currentText.split(":");
             if (parts.length > 1) {
                 const type = parts[0].replace("GAME ", "");
                 const content = parts.slice(1).join(":").trim();
                 return `🔮 ${type}: ${content}`;
             }
             return "🔮 Oracle Card";
        }
        return currentText.length > 50 ? currentText.substring(0, 50) + "..." : currentText;
    },

    parseVoiceNote: (rawText: string, encKey?: string) => {
        if (!rawText) return null;
        let text = rawText;
        try {
            const key = encKey || localStorage.getItem('enc_key') || '';
            text = CryptoUtils.decrypt(text, key);
        } catch (e) {}

        if (!text.startsWith("[VN]")) return null;
        const rawContent = text.substring(4).trim();
        let url = rawContent;
        let duration: number | null = null;
        if (rawContent.includes('|')) {
            const parts = rawContent.split('|');
            url = parts[0];
            const parsedDuration = parseFloat(parts[1]);
            if (!isNaN(parsedDuration)) duration = parsedDuration;
        }
        return { url, duration };
    },

    createReplyContext: (messageObj: any, encKey?: string): ReplyData => {
        const name = messageObj.nama.split('|')[0];
        let text = messageObj.teks;
        try {
            const key = encKey || localStorage.getItem('enc_key') || '';
            text = CryptoUtils.decrypt(text, key);
        } catch (e) {}

        let currentText = text;
        while (currentText.endsWith("[EDITED]")) {
            currentText = currentText.substring(0, currentText.length - 8).trim();
        }

        while (true) {
            let changed = false;
            if (currentText.startsWith("[VO]")) {
                currentText = currentText.substring(4);
                changed = true;
            }
            const replyMatch = currentText.match(/^\[REPLY:(.+?)\](.*)$/s);
            if (replyMatch) {
                currentText = replyMatch[2];
                changed = true;
            }
            if (!changed) break;
        }
        currentText = currentText.trim();
        if (currentText.startsWith('{')) {
            try {
                const parsed = JSON.parse(currentText);
                if (parsed.content) currentText = parsed.content;
            } catch (e) {}
        }
        if (currentText.startsWith("[VN]")) {
            currentText = "🎤 Voice Note";
        } else if (currentText.startsWith("[IMG]")) {
            const rawImg = currentText.substring(5).trim();
            const firstSpace = rawImg.indexOf(' ');
            const firstNewline = rawImg.indexOf('\n');
            let splitIndex = -1;
            if (firstSpace !== -1 && firstNewline !== -1) splitIndex = Math.min(firstSpace, firstNewline);
            else if (firstSpace !== -1) splitIndex = firstSpace;
            else if (firstNewline !== -1) splitIndex = firstNewline;
            if (splitIndex !== -1) {
                const caption = rawImg.substring(splitIndex).trim();
                currentText = `🖼️ ${caption}`;
            } else {
                currentText = "🖼️ Image";
            }
        } else if (currentText.startsWith("GAME ")) {
             const parts = currentText.split(":");
             currentText = parts.length > 1 ? `🔮 ${parts[0].replace("GAME ", "")}: ${parts.slice(1).join(":").trim()}` : "🔮 Oracle Card";
        }
        if (currentText.length > 100) currentText = currentText.substring(0, 100) + "...";
        return { id: messageObj.id, name, text: currentText };
    }
};
