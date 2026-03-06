export class AudioManager {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private mimeType: string = '';

    async startRecording(): Promise<boolean> {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.warn("Already recording");
            return false;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let mimeType = '';
            const types = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/mp4'
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
            this.mimeType = mimeType || this.mediaRecorder.mimeType || 'audio/webm';
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            return true;
        } catch (error) {
            console.error("Error starting recording:", error);
            throw error;
        }
    }

    stopRecording(): Promise<{ blob: Blob, ext: string } | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: this.mimeType });
                
                let ext = 'webm';
                if (this.mimeType.includes('mp4')) ext = 'mp4';
                else if (this.mimeType.includes('ogg')) ext = 'ogg';
                
                this.cleanup();
                resolve({ blob: audioBlob, ext });
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
