export class AudioManager {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private mimeType: string = '';

    async startRecording(): Promise<boolean> {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            return false;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let options: MediaRecorderOptions = {};
            this.mimeType = 'audio/webm';
            
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                const types = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/ogg;codecs=opus',
                    'audio/ogg',
                    'audio/mp4'
                ];
                for (const type of types) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        this.mimeType = type;
                        options.mimeType = type;
                        break;
                    }
                }
            } else {
                this.mimeType = 'audio/mp4';
            }
            
            try {
                this.mediaRecorder = new MediaRecorder(this.stream, options);
            } catch (e) {
                this.mediaRecorder = new MediaRecorder(this.stream);
                this.mimeType = this.mediaRecorder.mimeType || 'audio/mp4';
            }
            
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(250); // timeslice to ensure data is collected
            return true;
        } catch (error) {
            console.error("Error starting recording:", error);
            this.cleanup();
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
                else if (this.mimeType.includes('wav')) ext = 'wav';
                
                this.cleanup();
                
                if (audioBlob.size > 0) {
                    resolve({ blob: audioBlob, ext });
                } else {
                    resolve(null);
                }
            };

            try {
                this.mediaRecorder.stop();
            } catch (e) {
                this.cleanup();
                resolve(null);
            }
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
