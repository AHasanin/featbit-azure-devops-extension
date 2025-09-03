import DebounceHandler from '../../src/utils/DebounceHandler';

describe('DebounceHandler', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    DebounceHandler.clearAll();
  });

  describe('Basic Debouncing', () => {
    it('should debounce function calls', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const debouncedFn = DebounceHandler.debounce(mockFn, 100);

      // Call multiple times rapidly
      const promise1 = debouncedFn('arg1');
      const promise2 = debouncedFn('arg2');
      const promise3 = debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(100);

      await Promise.all([promise1, promise2, promise3]);

      // Should only be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should handle async functions', async () => {
      const asyncFn = jest.fn().mockImplementation(async (value: string) => {
        return `processed-${value}`;
      });

      const debouncedFn = DebounceHandler.debounce(asyncFn, 50);

      const promise = debouncedFn('test');
      jest.advanceTimersByTime(50);

      const result = await promise;
      expect(result).toBe('processed-test');
      expect(asyncFn).toHaveBeenCalledWith('test');
    });

    it('should handle function errors', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const debouncedFn = DebounceHandler.debounce(errorFn, 50);

      const promise = debouncedFn('test');
      jest.advanceTimersByTime(50);

      await expect(promise).rejects.toThrow('Test error');
    });
  });

  describe('Debounce Options', () => {
    it('should support leading edge execution', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const debouncedFn = DebounceHandler.debounce(mockFn, 100, { leading: true, trailing: false });

      const promise = debouncedFn('arg1');
      
      // Should be called immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      await promise;
    });

    it('should support maxWait option', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const debouncedFn = DebounceHandler.debounce(mockFn, 100, { maxWait: 150 });

      // Call repeatedly
      debouncedFn('arg1');
      jest.advanceTimersByTime(50);
      
      debouncedFn('arg2');
      jest.advanceTimersByTime(50);
      
      debouncedFn('arg3');
      jest.advanceTimersByTime(50); // Total 150ms, should trigger maxWait

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });
  });

  describe('Debounce Control', () => {
    it('should cancel debounced calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = DebounceHandler.debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn.cancel();

      jest.advanceTimersByTime(100);

      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should flush debounced calls', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const debouncedFn = DebounceHandler.debounce(mockFn, 100);

      debouncedFn('arg1');
      const result = await debouncedFn.flush();

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });
  });

  describe('Key-based Debouncing', () => {
    it('should debounce by key', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const promise1 = DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      const promise2 = DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg2');

      jest.advanceTimersByTime(100);

      // First promise should be rejected, second should resolve
      await expect(promise1).rejects.toThrow('Debounced call cancelled by newer call');
      await expect(promise2).resolves.toBe('result');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });

    it('should handle different keys independently', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const promise1 = DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      const promise2 = DebounceHandler.debounceWithKey('key2', mockFn, 100, 'arg2');

      jest.advanceTimersByTime(100);

      await Promise.all([promise1, promise2]);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg1');
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });

    it('should cancel by key', async () => {
      const mockFn = jest.fn();

      const promise = DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      DebounceHandler.cancelByKey('key1');

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Debounced call cancelled');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should flush by key', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      const result = await DebounceHandler.flushByKey('key1');

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });
  });

  describe('Statistics and Management', () => {
    it('should provide statistics', () => {
      const mockFn = jest.fn();
      
      DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      DebounceHandler.debounceWithKey('key2', mockFn, 100, 'arg2');

      // Wait a moment to ensure timestamp difference
      const startTime = Date.now();
      
      // Sleep for 10ms to ensure oldestCall has a measurable value
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return sleep(10).then(() => {
        const stats = DebounceHandler.getStats();
        expect(stats.pendingCalls).toBe(2);
        expect(stats.oldestCall).toBeGreaterThanOrEqual(10);
      });
    });

    it('should clear all pending calls', () => {
      const mockFn = jest.fn();

      DebounceHandler.debounceWithKey('key1', mockFn, 100, 'arg1');
      DebounceHandler.debounceWithKey('key2', mockFn, 100, 'arg2');

      expect(DebounceHandler.getStats().pendingCalls).toBe(2);

      DebounceHandler.clearAll();

      expect(DebounceHandler.getStats().pendingCalls).toBe(0);
      
      jest.advanceTimersByTime(100);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});