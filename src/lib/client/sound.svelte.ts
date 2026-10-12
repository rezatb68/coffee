const SETTINGS_KEY = 'cm-alert-v1';

export type AlertSettings = { enabled: boolean; volume: number; repeat: boolean; repeatSeconds: number; synthVoice: boolean; callSound: boolean };

const DEFAULTS: AlertSettings = { enabled: true, volume: 0.8, repeat: true, repeatSeconds: 30, synthVoice: false, callSound: true };

function loadSettings(): AlertSettings {
	if (typeof localStorage === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AlertSettings>) } : DEFAULTS;
	} catch {
		return DEFAULTS;
	}
}

class AlertSound {
	settings = $state<AlertSettings>(loadSettings());
	/** True after the user has enabled sound with a click; browsers block audio before that. */
	unlocked = $state(false);
	wakeLockActive = $state(false);

	private audio: HTMLAudioElement | null = null;
	private callAudio: HTMLAudioElement | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private wakeLock: WakeLockSentinel | null = null;

	private getAudio(): HTMLAudioElement {
		if (!this.audio) this.audio = new Audio('/sounds/new-order.wav');
		this.audio.volume = this.settings.volume;
		return this.audio;
	}

	private getCallAudio(): HTMLAudioElement {
		if (!this.callAudio) this.callAudio = new Audio('/sounds/call.wav');
		this.callAudio.volume = Math.min(1, this.settings.volume + 0.1);
		return this.callAudio;
	}

	/** Must be called from a user gesture (click or tap). */
	async unlock(): Promise<void> {
		const audio = this.getAudio();
		try {
			await audio.play();
			audio.pause();
			audio.currentTime = 0;
			this.unlocked = true;
		} catch {
			this.unlocked = false;
		}
		await this.keepAwake();
	}

	play(): void {
		if (!this.settings.enabled || !this.unlocked) return;
		const audio = this.getAudio();
		audio.currentTime = 0;
		audio.play().catch(() => {});
	}

	alertNewOrder(): void {
		this.play();
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
		if (this.settings.synthVoice && 'speechSynthesis' in window) {
			try {
				const utter = new SpeechSynthesisUtterance('سفارش جدید');
				utter.lang = 'fa-IR';
				utter.volume = this.settings.volume;
				speechSynthesis.speak(utter);
			} catch {
				/* no TTS available for fa */
			}
		}
	}

	/** Waiter/bill request: a distinct, slightly higher-pitched alert (falls back to the main sound). */
	alertCall(): void {
		if (!this.settings.enabled || !this.unlocked) return;
		try {
			this.getCallAudio().play().catch(() => this.play());
		} catch {
			this.play();
		}
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([80, 60, 80, 60, 80]);
	}

	update(patch: Partial<AlertSettings>): void {
		this.settings = { ...this.settings, ...patch };
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
		} catch {
			// ignore storage errors
		}
		if (this.audio) this.audio.volume = this.settings.volume;
	}

	/** Starts or stops the repeat reminder while there are unseen orders. */
	syncRepeat(hasUnseen: boolean): void {
		const shouldRun = hasUnseen && this.settings.enabled && this.settings.repeat && this.unlocked;
		if (shouldRun && !this.timer) {
			this.timer = setInterval(() => this.play(), this.settings.repeatSeconds * 1000);
		} else if (!shouldRun && this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async keepAwake(): Promise<void> {
		try {
			if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
			this.wakeLock = await navigator.wakeLock.request('screen');
			this.wakeLockActive = true;
			this.wakeLock.addEventListener('release', () => (this.wakeLockActive = false));
		} catch {
			this.wakeLockActive = false;
		}
	}

	reacquireWakeLock(): void {
		if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.unlocked && !this.wakeLockActive) {
			void this.keepAwake();
		}
	}
}

export const alertSound = new AlertSound();
