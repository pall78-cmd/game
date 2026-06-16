// StreakManager.ts - Utility to manage word game streaks, weekly stats, and notifications.

export interface StreakState {
    streakCount: number;
    lastPlayedDate: string | null; // Format: YYYY-MM-DD
    allPlayedDates: string[]; // List of YYYY-MM-DD dates
    bestStreak: number;
    reminderTime: string; // e.g. "20:00"
    reminderEnabled: boolean;
}

const STORAGE_KEY = 'tebak_kata_streak_v1';

const getTodayString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
};

const getYesterdayString = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
};

export const StreakManager = {
    getInitialState(): StreakState {
        return {
            streakCount: 0,
            lastPlayedDate: null,
            allPlayedDates: [],
            bestStreak: 0,
            reminderTime: "19:00",
            reminderEnabled: true,
        };
    },

    load(): StreakState {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                const initial = this.getInitialState();
                this.save(initial);
                return initial;
            }
            const data = JSON.parse(stored) as StreakState;
            // Validate dates and verify if the streak is broken (more than 1 day since last play)
            const updated = this.validateAndRepairStreak(data);
            this.save(updated);
            return updated;
        } catch (e) {
            console.error("Gagal membaca StreakState:", e);
            return this.getInitialState();
        }
    },

    save(state: StreakState) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error("Gagal menyimpan StreakState:", e);
        }
    },

    validateAndRepairStreak(state: StreakState): StreakState {
        if (!state.lastPlayedDate) return state;

        const today = getTodayString();
        const yesterday = getYesterdayString();

        // If last played date isn't today and isn't yesterday, streak is lost.
        if (state.lastPlayedDate !== today && state.lastPlayedDate !== yesterday) {
            state.streakCount = 0;
        }
        return state;
    },

    /**
     * Records that the player played today.
     * Returns true if a milestone has been newly unlocked, along with the action type.
     */
    recordPlayToday(): { isNewMilestone: boolean; milestoneCount: number; state: StreakState } {
        const state = this.load();
        const today = getTodayString();
        const yesterday = getYesterdayString();

        if (state.lastPlayedDate === today) {
            // Already played today, no change to streak count
            // Ensure today is in allPlayedDates
            if (!state.allPlayedDates.includes(today)) {
                state.allPlayedDates.push(today);
            }
            this.save(state);
            return { isNewMilestone: false, milestoneCount: state.streakCount, state };
        }

        let isNewMilestone = false;
        if (state.lastPlayedDate === yesterday) {
            // Consecutive play!
            state.streakCount += 1;
            isNewMilestone = true; // Trigger milestone popup on every streak increment to celebrate!
        } else {
            // Cold start or broken streak
            state.streakCount = 1;
            isNewMilestone = true; // First day is also a milestone to showcase the visual!
        }

        state.lastPlayedDate = today;
        if (state.streakCount > state.bestStreak) {
            state.bestStreak = state.streakCount;
        }

        if (!state.allPlayedDates.includes(today)) {
            state.allPlayedDates.push(today);
        }

        this.save(state);
        this.triggerLocalNotification(state);
        return { isNewMilestone, milestoneCount: state.streakCount, state };
    },

    isCloseToLosingStreak(): boolean {
        const state = this.load();
        if (state.streakCount === 0 || !state.lastPlayedDate) return false;

        const today = getTodayString();
        const yesterday = getYesterdayString();

        // If last played was yesterday, they need to play today to maintain the streak.
        // If they haven't played today yet, they are indeed close to losing their streak.
        return state.lastPlayedDate === yesterday && state.lastPlayedDate !== today;
    },

    updateSettings(enabledOrObject: boolean | Partial<{ reminderEnabled: boolean; reminderTime: string }>, reminderTime?: string): StreakState {
        const state = this.load();
        if (typeof enabledOrObject === 'object' && enabledOrObject !== null) {
            if (enabledOrObject.reminderEnabled !== undefined) {
                state.reminderEnabled = enabledOrObject.reminderEnabled;
            }
            if (enabledOrObject.reminderTime !== undefined) {
                state.reminderTime = enabledOrObject.reminderTime;
            }
        } else {
            state.reminderEnabled = !!enabledOrObject;
            if (reminderTime !== undefined) {
                state.reminderTime = reminderTime;
            }
        }
        this.save(state);
        this.triggerLocalNotification(state);
        return state;
    },

    /**
     * Weekly activity charts formatting. Gives 7 days back from today.
     */
    getWeeklyActivityData() {
        const state = this.load();
        const dates: { label: string; dateStr: string; played: number; streak: number }[] = [];
        
        // Generate last 7 days labels
        const daysLabel = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${date}`;
            
            const isPlayed = state.allPlayedDates.includes(dateStr) ? 1 : 0;
            
            // Dynamic display for chart tracking
            dates.push({
                label: `${daysLabel[d.getDay()]} (${d.getDate()}/${d.getMonth()+1})`,
                dateStr,
                played: isPlayed,
                // Simple calculation of historical streak on that day
                streak: isPlayed ? Math.min(state.streakCount, 7 - i) : 0
            });
        }
        return dates;
    },

    triggerLocalNotification(state: StreakState) {
        if (!state.reminderEnabled) return;

        // Simulate local notification scheduling or trigger actual Browser Web Push Notifications if permission is granted
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                this.scheduleBrowserNotification(state);
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }
    },

    scheduleBrowserNotification(state: StreakState) {
        if (!state.reminderEnabled) return;

        // Parse reminder time "HH:MM"
        const [hours, minutes] = state.reminderTime.split(":").map(Number);
        const now = new Date();
        const reminderTimeToday = new Date();
        reminderTimeToday.setHours(hours, minutes, 0, 0);

        let delayMs = reminderTimeToday.getTime() - now.getTime();
        // If the scheduled time is in the past for today, schedule it for tomorrow
        if (delayMs < 0) {
            delayMs += 24 * 60 * 60 * 1000;
        }

        // Keep inside a window ref or timeout
        const win = window as any;
        if (win._streakNotificationTimeout) {
            clearTimeout(win._streakNotificationTimeout);
        }

        win._streakNotificationTimeout = setTimeout(() => {
            const freshState = StreakManager.load();
            if (StreakManager.isCloseToLosingStreak()) {
                new Notification("Sistem Oracle: Jaga Streak Anda!", {
                    body: `Streak harian ${freshState.streakCount} Hari Anda hampir hangus! Yuk main Tebak Kata sekarang untuk menjaganya.`,
                    icon: "https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/notification.mp3" // Fallback icon
                });
            }
            // Reschedule after execution
            StreakManager.scheduleBrowserNotification(state);
        }, delayMs);
    }
};
