import { describe, expect, it, vi } from 'vitest'
import { RequestQueue } from '../../src/core/RequestQueue'

describe('requestQueue', () => {
  it('should add tasks to the queue', () => {
    const queue = new RequestQueue()
    const task = { resolve: vi.fn(), reject: vi.fn() }
    queue.add(task)
    // Since queue is private, we can't check it directly easily without exposing it or checking side effects.
    // But we can check if process calls it.
    queue.process()
    expect(task.resolve).toHaveBeenCalled()
  })

  it('should clear the queue', () => {
    const queue = new RequestQueue()
    const task = { resolve: vi.fn(), reject: vi.fn() }
    queue.add(task)
    queue.clear()
    queue.process()
    expect(task.resolve).not.toHaveBeenCalled()
  })

  it('should process all tasks', () => {
    const queue = new RequestQueue()
    const task1 = { resolve: vi.fn(), reject: vi.fn() }
    const task2 = { resolve: vi.fn(), reject: vi.fn() }
    queue.add(task1)
    queue.add(task2)
    queue.process()
    expect(task1.resolve).toHaveBeenCalled()
    expect(task2.resolve).toHaveBeenCalled()
  })

  it('should reject all tasks', () => {
    const queue = new RequestQueue()
    const task1 = { resolve: vi.fn(), reject: vi.fn() }
    const task2 = { resolve: vi.fn(), reject: vi.fn() }
    const error = new Error('Failed')
    queue.add(task1)
    queue.add(task2)
    queue.rejectAll(error)
    expect(task1.reject).toHaveBeenCalledWith(error)
    expect(task2.reject).toHaveBeenCalledWith(error)
    expect(task1.resolve).not.toHaveBeenCalled()
  })

  it('should enforce default max queue size of 100', () => {
    const queue = new RequestQueue()
    const task = { resolve: vi.fn(), reject: vi.fn() }

    // Add 100 tasks - should succeed
    for (let i = 0; i < 100; i++) {
      queue.add(task)
    }

    // 101st task should throw
    expect(() => queue.add(task)).toThrow('Queue overflow: maximum size of 100 exceeded')
  })

  it('should enforce custom max queue size', () => {
    const queue = new RequestQueue(5)
    const task = { resolve: vi.fn(), reject: vi.fn() }

    // Add 5 tasks - should succeed
    for (let i = 0; i < 5; i++) {
      queue.add(task)
    }

    // 6th task should throw
    expect(() => queue.add(task)).toThrow('Queue overflow: maximum size of 5 exceeded')
  })

  it('should throw error with descriptive message on overflow', () => {
    const queue = new RequestQueue(10)
    const task = { resolve: vi.fn(), reject: vi.fn() }

    for (let i = 0; i < 10; i++) {
      queue.add(task)
    }

    expect(() => queue.add(task)).toThrow(/Queue overflow/)
    expect(() => queue.add(task)).toThrow(/maximum size of 10/)
  })

  it('should return accurate queue size via size() method', () => {
    const queue = new RequestQueue()
    const task = { resolve: vi.fn(), reject: vi.fn() }

    expect(queue.size()).toBe(0)

    queue.add(task)
    expect(queue.size()).toBe(1)

    queue.add(task)
    queue.add(task)
    expect(queue.size()).toBe(3)

    queue.process()
    expect(queue.size()).toBe(0)
  })

  it('should resolve queued promises with true on process()', () => {
    const queue = new RequestQueue()
    const task1 = { resolve: vi.fn(), reject: vi.fn() }
    const task2 = { resolve: vi.fn(), reject: vi.fn() }

    queue.add(task1)
    queue.add(task2)
    queue.process()

    expect(task1.resolve).toHaveBeenCalledWith(true)
    expect(task2.resolve).toHaveBeenCalledWith(true)
  })
})
