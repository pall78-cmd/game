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
            // Request high quality audio constraints
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000, // High quality sample rate
                    channelCount: 2    // Stereo if possible
                } 
            });
            
            let options: MediaRecorderOptions = {
                audioBitsPerSecond: 128000 // 128kbps for better quality
            };
            this.mimeType = 'audio/webm';
            
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                // Prioritize formats with better quality/compression ratios
                const types = [
                    'audio/webm;codecs=opus',
                    'audio/ogg;codecs=opus',
                    'audio/mp4;codecs=mp4a.40.2', // AAC is generally higher quality than basic webm
                    'audio/webm',
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
                // Fallback without bitrate options if it fails
                try {
                    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
                } catch (e2) {
                    this.mediaRecorder = new MediaRecorder(this.stream);
                }
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
