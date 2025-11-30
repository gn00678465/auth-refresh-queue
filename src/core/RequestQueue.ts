import type { Task } from './types'

export class RequestQueue {
  private queue: Task[] = []

  add(task: Task): void {
    this.queue.push(task)
  }

  clear(): void {
    this.queue = []
  }

  process(): void {
    this.queue.forEach((task) => {
      task.resolve()
    })
    this.clear()
  }

  rejectAll(error: unknown): void {
    this.queue.forEach((task) => {
      task.reject(error)
    })
    this.clear()
  }
}
