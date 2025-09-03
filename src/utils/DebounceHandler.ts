/**
 * Debounce function type
 */
type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
  cancel: () => void;
  flush: () => Promise<ReturnType<T> | undefined>;
};

/**
 * Debounce configuration options
 */
interface DebounceOptions {
  leading?: boolean; // Execute on the leading edge
  trailing?: boolean; // Execute on the trailing edge
  maxWait?: number; // Maximum time to wait before forcing execution
}

/**
 * Utility class for debouncing function calls to prevent rapid API requests
 */
export class DebounceHandler {
  private static pendingCalls = new Map<string, {
    timeoutId: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    func: Function;
    args: any[];
    lastCallTime: number;
    maxWaitTimeoutId?: number;
  }>();

  /**
   * Create a debounced version of a function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    options: DebounceOptions = {}
  ): DebouncedFunction<T> {
    const { leading = false, trailing = true, maxWait } = options;
    let timeoutId: number | null = null;
    let maxWaitTimeoutId: number | null = null;
    let lastCallTime = 0;
    let lastArgs: Parameters<T>;
    let pendingPromises: Array<{ resolve: (value: any) => void; reject: (error: any) => void }> = [];

    const debounced = (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve, reject) => {
        const now = Date.now();
        lastArgs = args;
        lastCallTime = now;

        // Add this promise to the pending list
        pendingPromises.push({ resolve, reject });

        const invokeFunc = async () => {
          try {
            const result = await func(...lastArgs);
            // Resolve all pending promises with the same result
            const promises = [...pendingPromises];
            pendingPromises = [];
            promises.forEach(p => p.resolve(result));
          } catch (error) {
            // Reject all pending promises with the same error
            const promises = [...pendingPromises];
            pendingPromises = [];
            promises.forEach(p => p.reject(error));
          }
        };

        const shouldCallLeading = leading && !timeoutId;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Only set maxWait timer if it doesn't exist and maxWait is specified
        if (maxWait && !maxWaitTimeoutId) {
          maxWaitTimeoutId = setTimeout(async () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            maxWaitTimeoutId = null;
            await invokeFunc();
          }, maxWait) as any;
        }

        timeoutId = setTimeout(async () => {
          timeoutId = null;
          maxWaitTimeoutId = null; // Clear maxWait timer when normal delay completes
          if (trailing) {
            await invokeFunc();
          }
        }, delay) as any;

        if (shouldCallLeading) {
          invokeFunc();
        }
      });
    };

    debounced.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (maxWaitTimeoutId) {
        clearTimeout(maxWaitTimeoutId);
        maxWaitTimeoutId = null;
      }
      // Clear pending promises without rejecting to avoid unhandled rejections
      pendingPromises = [];
    };

    debounced.flush = async (): Promise<ReturnType<T> | undefined> => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        if (maxWaitTimeoutId) {
          clearTimeout(maxWaitTimeoutId);
          maxWaitTimeoutId = null;
        }
        try {
          const result = await func(...lastArgs);
          // Resolve all pending promises
          const promises = [...pendingPromises];
          pendingPromises = [];
          promises.forEach(p => p.resolve(result));
          return result;
        } catch (error) {
          // Reject all pending promises
          const promises = [...pendingPromises];
          pendingPromises = [];
          promises.forEach(p => p.reject(error));
          throw error;
        }
      }
      return undefined;
    };

    return debounced;
  }

  /**
   * Create a debounced version of a function with a unique key for global debouncing
   */
  static debounceWithKey<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      // Cancel existing call with the same key
      const existing = this.pendingCalls.get(key);
      if (existing) {
        clearTimeout(existing.timeoutId);
        if (existing.maxWaitTimeoutId) {
          clearTimeout(existing.maxWaitTimeoutId);
        }
        // Reject the previous promise
        existing.reject(new Error('Debounced call cancelled by newer call'));
      }

      const timeoutId = setTimeout(async () => {
        const call = this.pendingCalls.get(key);
        if (call) {
          this.pendingCalls.delete(key);
          try {
            const result = await call.func(...call.args);
            call.resolve(result);
          } catch (error) {
            call.reject(error);
          }
        }
      }, delay);

      this.pendingCalls.set(key, {
        timeoutId,
        resolve,
        reject,
        func,
        args,
        lastCallTime: Date.now()
      });
    });
  }

  /**
   * Cancel a debounced call by key
   */
  static cancelByKey(key: string): void {
    const call = this.pendingCalls.get(key);
    if (call) {
      clearTimeout(call.timeoutId);
      if (call.maxWaitTimeoutId) {
        clearTimeout(call.maxWaitTimeoutId);
      }
      call.reject(new Error('Debounced call cancelled'));
      this.pendingCalls.delete(key);
    }
  }

  /**
   * Flush a debounced call by key (execute immediately)
   */
  static async flushByKey(key: string): Promise<any> {
    const call = this.pendingCalls.get(key);
    if (call) {
      clearTimeout(call.timeoutId);
      if (call.maxWaitTimeoutId) {
        clearTimeout(call.maxWaitTimeoutId);
      }
      this.pendingCalls.delete(key);

      try {
        const result = await call.func(...call.args);
        call.resolve(result);
        return result;
      } catch (error) {
        call.reject(error);
        throw error;
      }
    }
    return undefined;
  }

  /**
   * Get statistics about pending debounced calls
   */
  static getStats(): { pendingCalls: number; oldestCall?: number } {
    const now = Date.now();
    let oldestCall: number | undefined;

    for (const call of this.pendingCalls.values()) {
      if (!oldestCall || call.lastCallTime < oldestCall) {
        oldestCall = call.lastCallTime;
      }
    }

    return {
      pendingCalls: this.pendingCalls.size,
      oldestCall: oldestCall ? now - oldestCall : undefined
    };
  }

  /**
   * Clear all pending debounced calls
   */
  static clearAll(): void {
    for (const call of this.pendingCalls.values()) {
      clearTimeout(call.timeoutId);
      if (call.maxWaitTimeoutId) {
        clearTimeout(call.maxWaitTimeoutId);
      }
      // Don't reject promises during cleanup to avoid unhandled rejections in tests
      // call.reject(new Error('All debounced calls cleared'));
    }
    this.pendingCalls.clear();
  }
}

export default DebounceHandler;