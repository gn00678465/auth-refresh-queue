import { describe, it, expect, vi } from 'vitest';
import { RequestQueue } from '../../src/core/RequestQueue';

describe('RequestQueue', () => {
  it('should add tasks to the queue', () => {
    const queue = new RequestQueue();
    const task = { resolve: vi.fn(), reject: vi.fn() };
    queue.add(task);
    // Since queue is private, we can't check it directly easily without exposing it or checking side effects.
    // But we can check if process calls it.
    queue.process();
    expect(task.resolve).toHaveBeenCalled();
  });

  it('should clear the queue', () => {
    const queue = new RequestQueue();
    const task = { resolve: vi.fn(), reject: vi.fn() };
    queue.add(task);
    queue.clear();
    queue.process();
    expect(task.resolve).not.toHaveBeenCalled();
  });

  it('should process all tasks', () => {
    const queue = new RequestQueue();
    const task1 = { resolve: vi.fn(), reject: vi.fn() };
    const task2 = { resolve: vi.fn(), reject: vi.fn() };
    queue.add(task1);
    queue.add(task2);
    queue.process();
    expect(task1.resolve).toHaveBeenCalled();
    expect(task2.resolve).toHaveBeenCalled();
  });

  it('should reject all tasks', () => {
    const queue = new RequestQueue();
    const task1 = { resolve: vi.fn(), reject: vi.fn() };
    const task2 = { resolve: vi.fn(), reject: vi.fn() };
    const error = new Error('Failed');
    queue.add(task1);
    queue.add(task2);
    queue.rejectAll(error);
    expect(task1.reject).toHaveBeenCalledWith(error);
    expect(task2.reject).toHaveBeenCalledWith(error);
    expect(task1.resolve).not.toHaveBeenCalled();
  });
});
