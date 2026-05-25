import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sendNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/vite.svg" });
  }
}

export function playThreeBeeps() {
  // Use Web Audio API first to guarantee audio sound synthesis even offline or with network blocks
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const playBeepAtTime = (delayMs: number) => {
        setTimeout(() => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime); // Clean beautiful tone
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
          } catch (e) {
            console.error("Synthetic beep failure:", e);
          }
        }, delayMs);
      };
      playBeepAtTime(0);
      playBeepAtTime(450);
      playBeepAtTime(900);
    }
  } catch (err) {
    console.error("Synthetic AudioContext failure:", err);
  }

  // Also trigger traditional Audio player
  const audioUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
  const playBeep = (count: number) => {
    if (count <= 0) return;
    const audio = new Audio(audioUrl);
    audio.play()
      .then(() => {
        setTimeout(() => playBeep(count - 1), 800);
      })
      .catch(e => {
        console.log("Audio play blocked:", e);
      });
  };
  playBeep(3);
}
