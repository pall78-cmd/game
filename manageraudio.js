/**
 * Manager Audio untuk BGM (Background Music)
 * Mengatur playlist, fade in/out, dan interaksi dengan event aplikasi.
 */

class BGMManager {
    constructor() {
        this.tracks = [
            "https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/HINDIA%20FULL%20ALBUM%20_%207%20BEST%20SONG%20OF%20HINDIA%20_%20DANIEL%20BASKARA%20PUTRA(MP3_128K).mp3",
            "https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/Tarot%20-%20.Feast%20_%20Lirik%20Lagu(MP3_320K).mp3"
        ];
        this.audio = new Audio();
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.userVolume = 0.3; // Volume set by user
        this.isMuted = false;  // Mute state
        this.fadeInterval = null;
        
        // Preload
        this.audio.preload = "auto";

        // Auto next track
        this.audio.addEventListener('ended', () => this.nextTrack());
        
        // Error handling
        this.audio.addEventListener('error', (e) => {
            const err = this.audio.error;
            console.warn(`BGM Error (Code ${err ? err.code : '?'})`, err);
            
            // Prevent infinite loop if all tracks are bad
            const now = Date.now();
            if (this.lastErrorTime && (now - this.lastErrorTime < 1000)) {
                console.error("Too many BGM errors, stopping BGM.");
                this.isPlaying = false;
                return;
            }
            this.lastErrorTime = now;

            this.nextTrack();
        });
    }

    // Set User Volume (0.0 - 1.0)
    setVolume(vol) {
        this.userVolume = Math.max(0, Math.min(1, vol));
        if (!this.isMuted && this.isPlaying) {
            // Update current volume immediately if not fading
            if (!this.fadeInterval) {
                this.audio.volume = this.userVolume;
            }
        }
    }

    // Set Mute State
    mute(muted) {
        this.isMuted = muted;
        if (this.isMuted) {
            this.audio.volume = 0;
        } else {
            if (this.isPlaying) {
                this.audio.volume = this.userVolume;
            }
        }
    }

    // Memulai pemutaran (dengan fade in)
    play() {
        if (this.isPlaying) return;
        
        // Set source if not set
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentTrackIndex];
        }

        if (this.isMuted) {
            this.audio.volume = 0;
        } else {
            // Mulai dari volume 0 untuk fade in
            this.audio.volume = 0; 
        }
        
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                if (!this.isMuted) this.fadeIn();
            }).catch(e => {
                console.error("BGM Play failed (Autoplay policy?):", e);
                // Kita bisa mencoba lagi nanti saat user interaksi
            });
        }
    }

    // Pause pemutaran (dengan fade out)
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

    // Pindah ke track berikutnya
    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        this.audio.src = this.tracks[this.currentTrackIndex];
        if (this.isPlaying) {
            this.audio.play().catch(e => console.error("Next track play failed:", e));
        }
    }

    // Fade In ke User Volume
    fadeIn() {
        if (this.isMuted) return;
        this.fadeTo(this.userVolume);
    }

    // Fade Out ke 0
    fadeOut(callback) {
        this.fadeTo(0, callback);
    }

    // Fungsi Fade Generik
    fadeTo(targetVolume, callback) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        
        const step = 0.02;
        const intervalTime = 50;

        this.fadeInterval = setInterval(() => {
            let current = this.audio.volume;
            
            // Cek apakah sudah cukup dekat dengan target
            if (Math.abs(current - targetVolume) < step) {
                this.audio.volume = targetVolume;
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (callback) callback();
            } else {
                // Bergerak menuju target
                if (current < targetVolume) {
                    this.audio.volume = Math.min(1, current + step);
                } else {
                    this.audio.volume = Math.max(0, current - step);
                }
            }
        }, intervalTime);
    }

    // Ducking: Menurunkan volume sementara (misal saat ada suara lain)
    duck() {
        if (this.isMuted) return;
        this.fadeTo(Math.min(0.05, this.userVolume));
    }

    // Unduck: Mengembalikan volume normal
    unduck() {
        if (this.isMuted) return;
        this.fadeTo(this.userVolume);
    }

    // --- Event Handlers untuk Integrasi ---

    // Dipanggil saat kartu takdir ditarik
    onFateCardDraw() {
        console.log("BGM: Fate Card Drawn - Pausing");
        this.pause();
        // Kembali normal setelah 5 detik (waktu membaca kartu)
        setTimeout(() => this.play(), 5000);
    }

    // Dipanggil saat mengirim gambar
    onImageSend() {
        console.log("BGM: Image Sent - Pausing");
        this.pause();
        setTimeout(() => this.play(), 2000);
    }

    // Dipanggil saat mulai merekam VN
    onVoiceNoteStart() {
        console.log("BGM: VN Recording Start - Pausing");
        this.pause();
    }

    // Dipanggil saat selesai merekam VN
    onVoiceNoteStop() {
        console.log("BGM: VN Recording Stop - Resuming");
        this.play();
    }
    
    // Dipanggil saat memutar VN orang lain
    onVoiceNotePlay() {
        console.log("BGM: VN Play - Pausing");
        this.pause();
    }
    
    // Dipanggil saat VN selesai diputar
    onVoiceNoteEnd() {
        console.log("BGM: VN End - Resuming");
        this.play();
    }
}

// Expose instance ke window agar bisa diakses global
window.BGMManager = new BGMManager();
