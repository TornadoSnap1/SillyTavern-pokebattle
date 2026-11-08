export class BattlePlayback {
  constructor(onError = () => {}) { this.onError = onError; this.queue = []; this.running = false; this.cancelled = false; this.speed = 1; this.idle = []; this.wake = null; }
  enqueue(action, delay = 0) { if (this.cancelled) return; this.queue.push({ action, delay }); void this.drain().catch(error => { this.cancel(); this.onError(error); }); }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length && !this.cancelled) {
        const { action, delay } = this.queue.shift();
        action();
        const duration = delay / this.speed;
        if (duration > 0) await new Promise(resolve => {
          const timer = setTimeout(() => { this.wake = null; resolve(); }, duration);
          this.wake = () => { clearTimeout(timer); this.wake = null; resolve(); };
        });
      }
    } finally {
      this.running = false;
      if (!this.cancelled && !this.queue.length) for (const resolve of this.idle.splice(0)) resolve();
    }
  }
  whenIdle() { return !this.cancelled && (this.running || this.queue.length) ? new Promise(resolve => this.idle.push(resolve)) : Promise.resolve(); }
  setSpeed(speed) { this.speed = speed; this.wake?.(); }
  skip() { this.speed = Infinity; this.wake?.(); }
  cancel() { this.cancelled = true; this.queue = []; this.wake?.(); for (const resolve of this.idle.splice(0)) resolve(); }
}
