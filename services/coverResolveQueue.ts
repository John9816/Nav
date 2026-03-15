type Task = () => Promise<void>;

/**
 * A tiny concurrency-limited async task queue.
 * Used to avoid flooding 3rd-party APIs (e.g. cover resolving) which causes slow UI.
 */
export class AsyncTaskQueue {
  private concurrency: number;
  private running = 0;
  private queue: Task[] = [];

  constructor(concurrency = 4) {
    this.concurrency = Math.max(1, concurrency);
  }

  push(task: Task) {
    this.queue.push(task);
    this.drain();
  }

  private drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running += 1;
      Promise.resolve()
        .then(task)
        .catch(() => {
          // swallow task errors; caller should handle inside task
        })
        .finally(() => {
          this.running -= 1;
          this.drain();
        });
    }
  }
}
