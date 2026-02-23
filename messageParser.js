
/**
 * Message Parser Utility for ORACLE
 * Handles parsing of message content, nested replies, and special tags ([VO], [VN], [IMG], [REPLY]).
 */

const MessageParser = {
    /**
     * Parses a raw message string into a structured object.
     * Handles nested replies by extracting the innermost content or the immediate parent content depending on needs.
     * 
     * @param {string} rawText - The raw text from the database.
     * @returns {object} - { isVO, replyData, type, content, originalText, vnDuration }
     */
    parse: (rawText) => {
        if (!rawText) return { isVO: false, replyData: null, type: 'text', content: '', originalText: '', vnDuration: null };

        let text = rawText;
        let isVO = false;
        let replyData = null;

        // 1. Check for View Once [VO]
        if (text.startsWith("[VO]")) {
            isVO = true;
            text = text.substring(4);
        }

        // 2. Check for Reply [REPLY:{...}]
        // We look for the outermost reply wrapper.
        const replyMatch = text.match(/^\[REPLY:(.+?)\](.*)$/s);
        if (replyMatch) {
            try {
                // Attempt to parse the JSON content
                const jsonStr = replyMatch[1];
                replyData = JSON.parse(jsonStr);
                
                // The content of the message itself (the reply text)
                text = replyMatch[2]; 
            } catch (e) {
                console.warn("Failed to parse reply JSON:", e);
                // If parsing fails, treat it as normal text or broken reply
            }
        }

        // 3. Determine Type and Clean Content
        let type = "text";
        let content = text;
        let vnDuration = null;

        if (text.startsWith("[VN]")) {
            type = "vn";
            const rawVn = text.substring(4).trim();
            // Handle [VN]URL|DURATION format
            if (rawVn.includes('|')) {
                const parts = rawVn.split('|');
                content = parts[0];
                vnDuration = parseFloat(parts[1]);
            } else {
                content = rawVn;
            }
        } else if (text.startsWith("[IMG]")) {
            type = "img";
            // Extract URL and potential caption
            // Format could be: [IMG]url.jpg or [IMG]url.jpg\nCaption or [IMG]url.jpg Caption
            const rawImg = text.substring(5).trim();
            
            // Simple heuristic: URL usually doesn't have spaces, but caption might.
            // However, the uploadImage function in index.html returns just the URL.
            // If the user adds text, it might be appended.
            // Let's assume the first "word" is the URL.
            
            const firstSpace = rawImg.indexOf(' ');
            const firstNewline = rawImg.indexOf('\n');
            
            let splitIndex = -1;
            if (firstSpace !== -1 && firstNewline !== -1) splitIndex = Math.min(firstSpace, firstNewline);
            else if (firstSpace !== -1) splitIndex = firstSpace;
            else if (firstNewline !== -1) splitIndex = firstNewline;
            
            if (splitIndex !== -1) {
                const url = rawImg.substring(0, splitIndex);
                const caption = rawImg.substring(splitIndex).trim();
                content = `${url}\n${caption}`; // Normalize to newline separator for MessageContent
            } else {
                content = rawImg;
            }
        } else if (text.startsWith("GAME ")) {
            type = "game";
            // Content is kept as is for game parser to handle
        }

        return {
            isVO,
            replyData, // Object { name, text }
            type,
            content, // The actual message content (URL or Text)
            originalText: rawText,
            vnDuration
        };
    },

    /**
     * Generates a preview string for a message, suitable for displaying inside a reply bubble.
     * Converts special tags like [VN] to readable text.
     * 
     * @param {string} text - The raw message text (potentially containing [REPLY], [VN], etc.)
     * @returns {string} - Human readable preview
     */
    getPreview: (text) => {
        if (!text) return "";
        
        // Recursive parsing to get to the "real" content.
        let currentText = text;
        
        // Loop to strip multiple layers if necessary
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

        // Check if the content is JSON (Oracle format)
        if (currentText.startsWith('{')) {
            try {
                const parsed = JSON.parse(currentText);
                if (parsed.content) {
                    currentText = parsed.content;
                }
            } catch (e) {
                // Not valid JSON, continue as is
            }
        }

        if (currentText.startsWith("[VN]")) return "🎤 Voice Note";
        if (currentText.startsWith("[IMG]")) return "🖼️ Image";
        if (currentText.startsWith("GAME ")) {
             const parts = currentText.split(":");
             // e.g. GAME LIGHT TRUTH:Content...
             // We want to show: "🔮 LIGHT TRUTH: Content..."
             if (parts.length > 1) {
                 const type = parts[0].replace("GAME ", "");
                 const content = parts.slice(1).join(":").trim();
                 return `🔮 ${type}: ${content}`;
             }
             return "🔮 Oracle Card";
        }

        // Truncate if too long
        return currentText.length > 50 ? currentText.substring(0, 50) + "..." : currentText;
    },

    /**
     * Parses a Voice Note string into an object with URL and duration.
     * Format: [VN]URL|DURATION or just [VN]URL
     * 
     * @param {string} text - The raw text starting with [VN]
     * @returns {object|null} - { url, duration } or null if not a VN
     */
    parseVoiceNote: (text) => {
        if (!text || !text.startsWith("[VN]")) return null;
        
        const rawContent = text.substring(4).trim();
        let url = rawContent;
        let duration = null;

        if (rawContent.includes('|')) {
            const parts = rawContent.split('|');
            url = parts[0];
            const parsedDuration = parseFloat(parts[1]);
            if (!isNaN(parsedDuration)) {
                duration = parsedDuration;
            }
        }

        return { url, duration };
    },

    /**
     * Prepares text for sending as a reply.
     * Ensures we don't nest the entire raw JSON of the previous message.
     * Instead, we extract only the relevant content for the context.
     * 
     * @param {object} messageObj - The message object being replied to (from DB)
     * @returns {object} - The clean context object { name, text } to be stringified
     */
    createReplyContext: (messageObj) => {
        const name = messageObj.nama.split('|')[0];
        let text = messageObj.teks;

        // Recursive parsing to get to the "real" content.
        let currentText = text;
        
        // Loop to strip multiple layers if necessary
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

        // Check if the content is JSON (Oracle format)
        if (currentText.startsWith('{')) {
            try {
                const parsed = JSON.parse(currentText);
                if (parsed.content) {
                    currentText = parsed.content;
                }
            } catch (e) {
                // Not valid JSON, continue as is
            }
        }

        // Format content based on type for the reply context
        if (currentText.startsWith("[VN]")) {
            currentText = "🎤 Voice Note";
        } else if (currentText.startsWith("[IMG]")) {
            // Check if there is a caption
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
             // e.g. GAME LIGHT TRUTH:Content... -> returns "TRUTH" or "Content"
             currentText = parts.length > 1 ? `🔮 ${parts[0].replace("GAME ", "")}: ${parts.slice(1).join(":").trim()}` : "🔮 Oracle Card";
        }

        // Truncate if too long for the context storage (optional, but good for DB size)
        // But for context we might want a bit more than preview. 
        // Let's keep it reasonable.
        if (currentText.length > 100) {
            currentText = currentText.substring(0, 100) + "...";
        }

        return {
            id: messageObj.id,
            name,
            text: currentText
        };
    }
};

window.MessageParser = MessageParser;
