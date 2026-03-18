export const AVAILABLE_BGMS = [
    { id: 'hindia', name: 'Hindia - Full Album', url: 'https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/HINDIA%20FULL%20ALBUM%20_%207%20BEST%20SONG%20OF%20HINDIA%20_%20DANIEL%20BASKARA%20PUTRA(MP3_128K).mp3' },
    { id: 'westlife', name: 'Westlife - Greatest Hits', url: 'https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/Best%20Hits%20of%20WESTLIFE%20_%20The%20Greatest%20Hits%20of%20Westlife(MP3_128K).mp3' }
];

export class BGMManager {
    private tracks: string[] = AVAILABLE_BGMS.map(b => b.url);
    public audio: HTMLAudioElement;
    private currentTrackIndex: number = 0;
    public isPlaying: boolean = false;
    private userVolume: number = 0.3;
    public isMuted: boolean = false;
    private fadeInterval: any = null;
    private lastErrorTime: number = 0;
    private autoplayFailed: boolean = false;
    private activeInteractions: Set<string> = new Set();

    constructor() {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.loop = true; // Loop the selected track
        this.audio.addEventListener('error', () => {
            const now = Date.now();
            if (this.lastErrorTime && (now - this.lastErrorTime < 1000)) {
                this.isPlaying = false;
                return;
            }
            this.lastErrorTime = now;
            // Retry playing
            if (this.isPlaying) {
                this.audio.play().catch(() => {});
            }
        });
        
        // Load saved track
        try {
            const savedTrack = localStorage.getItem('oracle_bgm_track');
            if (savedTrack !== null) {
                const idx = parseInt(savedTrack);
                if (!isNaN(idx) && idx >= 0 && idx < this.tracks.length) {
                    this.currentTrackIndex = idx;
                }
            }
        } catch (e) {}
    }

    setTrack(index: number) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentTrackIndex = index;
            try {
                localStorage.setItem('oracle_bgm_track', index.toString());
            } catch (e) {}
            
            const wasPlaying = this.isPlaying;
            this.audio.src = this.tracks[this.currentTrackIndex];
            if (wasPlaying) {
                this.audio.play().catch(e => console.error("Track switch play failed:", e));
            }
        }
    }

    getTrackIndex() {
        return this.currentTrackIndex;
    }

    setVolume(vol: number) {
        this.userVolume = Math.max(0, Math.min(1, vol));
        if (!this.isMuted && this.isPlaying) {
            if (!this.fadeInterval) {
                this.audio.volume = this.userVolume;
            }
        }
    }

    mute(muted: boolean) {
        this.isMuted = muted;
        if (this.isMuted) {
            try { this.audio.volume = 0; } catch(e) {}
        } else {
            if (this.isPlaying) {
                try { this.audio.volume = this.userVolume; } catch(e) {}
            }
        }
    }

    play() {
        if (this.activeInteractions.size > 0) return;
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentTrackIndex];
        }
        
        // Start from 0 to fade in smoothly
        try { this.audio.volume = 0; } catch(e) {}
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.autoplayFailed = false;
                if (!this.isMuted && this.isPlaying) {
                    this.fadeIn();
                }
            }).catch(() => {
                this.isPlaying = false;
                this.autoplayFailed = true;
                const unlock = () => {
                    this.play();
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('keydown', unlock);
                    document.removeEventListener('touchstart', unlock);
                };
                document.addEventListener('click', unlock, { once: true });
                document.addEventListener('keydown', unlock, { once: true });
                document.addEventListener('touchstart', unlock, { once: true });
            });
        }
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        if (this.isMuted) {
            this.audio.pause();
        } else {
            this.fadeOut(() => {
                // Only pause if it's still supposed to be paused
                if (!this.isPlaying) {
                    this.audio.pause();
                }
            });
        }
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        this.audio.src = this.tracks[this.currentTrackIndex];
        if (this.isPlaying) {
            this.audio.play().catch(e => console.error("Next track play failed:", e));
        }
    }

    fadeIn() {
        if (this.isMuted) return;
        this.fadeTo(this.userVolume);
    }

    fadeOut(callback?: () => void) {
        this.fadeTo(0, callback);
    }

    private fadeTo(targetVolume: number, callback?: () => void) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        const step = 0.02;
        const intervalTime = 50;
        let current = this.audio.volume;
        this.fadeInterval = setInterval(() => {
            if (Math.abs(current - targetVolume) < step) {
                current = targetVolume;
                try { this.audio.volume = current; } catch(e) {}
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (callback) callback();
            } else {
                if (current < targetVolume) {
                    current = Math.min(1, current + step);
                } else {
                    current = Math.max(0, current - step);
                }
                try { this.audio.volume = current; } catch(e) {}
            }
        }, intervalTime);
    }

    duck() {
        if (this.isMuted) return;
        this.fadeTo(Math.min(0.05, this.userVolume));
    }

    unduck() {
        if (this.isMuted) return;
        this.fadeTo(this.userVolume);
    }

    addInteraction(id: string) {
        this.activeInteractions.add(id);
        this.pause();
    }

    removeInteraction(id: string) {
        this.activeInteractions.delete(id);
        if (this.activeInteractions.size === 0) {
            this.play();
        }
    }

    onFateCardDraw() {
        const id = 'fate_' + Date.now();
        this.addInteraction(id);
        setTimeout(() => this.removeInteraction(id), 5000);
    }

    onImageSend() {
        const id = 'img_send_' + Date.now();
        this.addInteraction(id);
        setTimeout(() => this.removeInteraction(id), 2000);
    }

    onImageOpen() {
        this.addInteraction('img_open');
    }

    onImageClose() {
        this.removeInteraction('img_open');
    }

    onVoiceNoteStart() {
        this.addInteraction('vn_record');
    }

    onVoiceNoteStop() {
        this.removeInteraction('vn_record');
    }
    
    onVoiceNotePlay() {
        this.addInteraction('vn_play');
    }
    
    onVoiceNoteEnd() {
        this.removeInteraction('vn_play');
    }
}

export const bgmManager = new BGMManager();
