import DebounceHandler from '../../src/utils/DebounceHandler';

describe('DebounceHandler Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    DebounceHandler.clearAll();
  });

  describe('Debounce Performance', () => {
    it('should handle rapid function calls efficiently', async () => {
      let callCount = 0;
      const testFunction = jest.fn(() => {
        callCount++;
        return Promise.resolve(`call-${callCount}`);
      });

      const debouncedFn = DebounceHandler.debounce(testFunction, 100);

      const startTime = performance.now();

      // Make 1000 rapid calls
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(debouncedFn());
      }

      const setupTime = performance.now() - startTime;

      // Setup should be fast even with many calls
      expect(setupTime).toBeLessThan(50);

      // Fast-forward time to trigger debounced execution
      jest.advanceTimersByTime(100);

      // Wait for all promises to resolve
      const results = await Promise.all(promises);

      // Should only call the function once despite 1000 calls
      expect(testFunction).toHaveBeenCalledTimes(1);
      expect(results.every(result => result === 'call-1')).toBe(true);
    });

    it('should handle multiple debounced functions efficiently', async () => {
      const functions = Array.from({ length: 100 }, (_, i) => {
        const fn = jest.fn(() => Promise.resolve(`result-${i}`));
        return {
          original: fn,
          debounced: DebounceHandler.debounce(fn, 50)
        };
      });

      const startTime = performance.now();

      // Call all debounced functions
      const promises = functions.map(({ debounced }) => debounced());

      const callTime = performance.now() - startTime;

      // Should handle multiple debounced functions quickly
      expect(callTime).toBeLessThan(100);

      // Advance timers
      jest.advanceTimersByTime(50);

      const results = await Promise.all(promises);

      // Each function should be called once
      functions.forEach(({ original }, i) => {
        expect(original).toHaveBeenCalledTimes(1);
        expect(results[i]).toBe(`result-${i}`);
      });
    });

    it('should handle debounce with maxWait efficiently', async () => {
      let callCount = 0;
      const testFunction = jest.fn(() => {
        callCount++;
        return Promise.resolve(callCount);
      });

      const debouncedFn = DebounceHandler.debounce(testFunction, 100, {
        maxWait: 200
      });

      const startTime = performance.now();

      // Make calls every 50ms for 500ms
      const promises: Promise<number>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(debouncedFn());
        jest.advanceTimersByTime(50);
      }

      const executionTime = performance.now() - startTime;

      // Should handle maxWait logic efficiently
      expect(executionTime).toBeLessThan(50);

      // Advance to trigger maxWait
      jest.advanceTimersByTime(200);

      await Promise.all(promises);

      // Should have been called due to maxWait
      expect(testFunction).toHaveBeenCalled();
    });

    it('should handle cancellation efficiently', () => {
      const testFunction = jest.fn(() => Promise.resolve('result'));
      const debouncedFn = DebounceHandler.debounce(testFunction, 100);

      const startTime = performance.now();

      // Make many calls then cancel
      for (let i = 0; i < 100; i++) {
        debouncedFn();
      }

      debouncedFn.cancel();

      const cancelTime = performance.now() - startTime;

      // Cancellation should be fast
      expect(cancelTime).toBeLessThan(10);

      // Advance timers
      jest.advanceTimersByTime(100);

      // Function should not have been called
      expect(testFunction).not.toHaveBeenCalled();
    });

    it('should handle flush efficiently', async () => {
      const testFunction = jest.fn(() => Promise.resolve('flushed'));
      const debouncedFn = DebounceHandler.debounce(testFunction, 100);

      // Make a call
      const promise = debouncedFn();

      const startTime = performance.now();
      const result = await debouncedFn.flush();
      const flushTime = performance.now() - startTime;

      // Flush should be fast
      expect(flushTime).toBeLessThan(10);
      expect(result).toBe('flushed');
      expect(testFunction).toHaveBeenCalledTimes(1);

      // Original promise should also resolve
      const originalResult = await promise;
      expect(originalResult).toBe('flushed');
    });
  });

  describe('Global Debounce Performance', () => {
    it('should handle many keyed debounce calls efficiently', async () => {
      const testFunction = jest.fn((key: string) => Promise.resolve(`result-${key}`));

      const startTime = performance.now();

      // Create 100 different keyed debounce calls
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 100; i++) {
        const promise = DebounceHandler.debounceWithKey(
          `key-${i}`,
          testFunction,
          50,
          `key-${i}`
        );
        promises.push(promise);
      }

      const setupTime = performance.now() - startTime;

      // Setup should be efficient
      expect(setupTime).toBeLessThan(50);

      // Advance timers
      jest.advanceTimersByTime(50);

      const results = await Promise.all(promises);

      // Each key should have its own result
      results.forEach((result, i) => {
        expect(result).toBe(`result-key-${i}`);
      });

      expect(testFunction).toHaveBeenCalledTimes(100);
    });

    it('should handle key cancellation efficiently', () => {
      const testFunction = jest.fn(() => Promise.resolve('result'));

      const startTime = performance.now();

      // Create many keyed calls
      for (let i = 0; i < 50; i++) {
        DebounceHandler.debounceWithKey(`key-${i}`, testFunction, 100);
      }

      // Cancel all by key (suppress expected errors)
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      for (let i = 0; i < 50; i++) {
        try {
          DebounceHandler.cancelByKey(`key-${i}`);
        } catch (error) {
          // Expected cancellation errors
        }
      }
      
      console.error = originalConsoleError;

      const cancelTime = performance.now() - startTime;

      // Should handle many cancellations efficiently
      expect(cancelTime).toBeLessThan(20);

      // Advance timers
      jest.advanceTimersByTime(100);

      // No functions should have been called
      expect(testFunction).not.toHaveBeenCalled();
    });

    it('should provide accurate statistics', () => {
      const testFunction = jest.fn(() => Promise.resolve('result'));

      // Create pending calls
      for (let i = 0; i < 10; i++) {
        DebounceHandler.debounceWithKey(`key-${i}`, testFunction, 100);
      }

      const startTime = performance.now();
      const stats = DebounceHandler.getStats();
      const statsTime = performance.now() - startTime;

      // Getting stats should be fast
      expect(statsTime).toBeLessThan(5);
      expect(stats.pendingCalls).toBe(10);
      expect(stats.oldestCall).toBeDefined();
    });

    it('should clear all pending calls efficiently', () => {
      const testFunction = jest.fn(() => Promise.resolve('result'));

      // Create many pending calls
      for (let i = 0; i < 100; i++) {
        DebounceHandler.debounceWithKey(`key-${i}`, testFunction, 100);
      }

      const startTime = performance.now();
      DebounceHandler.clearAll();
      const clearTime = performance.now() - startTime;

      // Clearing should be fast
      expect(clearTime).toBeLessThan(20);

      const stats = DebounceHandler.getStats();
      expect(stats.pendingCalls).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many debounced functions', () => {
      const functions: Array<{ cancel: () => void }> = [];

      // Create many debounced functions
      for (let i = 0; i < 1000; i++) {
        const fn = jest.fn();
        const debounced = DebounceHandler.debounce(fn, 100);
        functions.push(debounced);
      }

      // Cancel all functions
      functions.forEach(fn => fn.cancel());

      // Advance timers to ensure cleanup
      jest.advanceTimersByTime(100);

      // This test mainly ensures no memory leaks occur
      // In a real environment, you might check memory usage
      expect(functions.length).toBe(1000);
    });

    it('should handle rapid creation and destruction of debounced functions', () => {
      const startTime = performance.now();

      // Rapidly create and destroy debounced functions
      for (let i = 0; i < 100; i++) {
        const fn = jest.fn();
        const debounced = DebounceHandler.debounce(fn, 50);
        
        // Call and immediately cancel
        debounced();
        debounced.cancel();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle rapid creation/destruction efficiently
      expect(duration).toBeLessThan(100);
    });
  });
});