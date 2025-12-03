import type { Task } from './types'

export class RequestQueue {
  private queue: Task[] = []
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  add(task: Task): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error(`Queue overflow: maximum size of ${this.maxSize} exceeded`)
    }
    this.queue.push(task)
  }

  clear(): void {
    this.queue = []
  }

  size(): number {
    return this.queue.length
  }

  process(): void {
    this.queue.forEach((task) => {
      task.resolve(true)
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
