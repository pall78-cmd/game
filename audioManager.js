class AudioManager {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
    }

    async startRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.warn("Already recording");
            return;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Check supported types and store the selected one
            let mimeType = '';
            const types = [
                'audio/mp4', // Prioritize MP4 as requested
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg'
            ];
            
            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
            
            console.log("Using MIME type:", mimeType || "default");
            
            const options = mimeType ? { mimeType } : {};
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.mimeType = mimeType || this.mediaRecorder.mimeType || 'audio/webm'; // Fallback
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            // Start without timeslice to let the browser manage the container metadata better for short clips
            this.mediaRecorder.start();
            return true;
        } catch (error) {
            console.error("Error starting recording:", error);
            throw error;
        }
    }

    stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                // Use the stored mimeType for the blob
                const audioBlob = new Blob(this.audioChunks, { type: this.mimeType });
                this.cleanup();
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
    }
}

window.AudioManager = AudioManager;
