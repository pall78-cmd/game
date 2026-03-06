export class BGMManager {
    private tracks: string[] = [
        "https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/HINDIA%20FULL%20ALBUM%20_%207%20BEST%20SONG%20OF%20HINDIA%20_%20DANIEL%20BASKARA%20PUTRA(MP3_128K).mp3",
        "https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/Tarot%20-%20.Feast%20_%20Lirik%20Lagu(MP3_320K).mp3"
    ];
    private audio: HTMLAudioElement;
    private currentTrackIndex: number = 0;
    private isPlaying: boolean = false;
    private userVolume: number = 0.3;
    private isMuted: boolean = false;
    private fadeInterval: any = null;
    private lastErrorTime: number = 0;
    private autoplayFailed: boolean = false;

    constructor() {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('error', () => {
            const now = Date.now();
            if (this.lastErrorTime && (now - this.lastErrorTime < 1000)) {
                this.isPlaying = false;
                return;
            }
            this.lastErrorTime = now;
            this.nextTrack();
        });
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
            this.audio.volume = 0;
        } else {
            if (this.isPlaying) {
                this.audio.volume = this.userVolume;
            }
        }
    }

    play() {
        if (this.isPlaying) return;
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentTrackIndex];
        }
        this.audio.volume = this.isMuted ? 0 : 0;
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                this.autoplayFailed = false;
                if (!this.isMuted) this.fadeIn();
            }).catch(() => {
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
        if (this.isMuted) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.fadeOut(() => {
                this.audio.pause();
                this.isPlaying = false;
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
        this.fadeInterval = setInterval(() => {
            let current = this.audio.volume;
            if (Math.abs(current - targetVolume) < step) {
                this.audio.volume = targetVolume;
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (callback) callback();
            } else {
                if (current < targetVolume) {
                    this.audio.volume = Math.min(1, current + step);
                } else {
                    this.audio.volume = Math.max(0, current - step);
                }
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

    onFateCardDraw() {
        this.pause();
        setTimeout(() => this.play(), 5000);
    }

    onImageSend() {
        this.pause();
        setTimeout(() => this.play(), 2000);
    }

    onVoiceNoteStart() {
        this.pause();
    }

    onVoiceNoteStop() {
        this.play();
    }
    
    onVoiceNotePlay() {
        this.pause();
    }
    
    onVoiceNoteEnd() {
        this.play();
    }
}

export const bgmManager = new BGMManager();
