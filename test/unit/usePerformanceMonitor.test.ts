import { renderHook, act } from '@testing-library/react';
import usePerformanceMonitor from '../../src/hooks/usePerformanceMonitor';

// Mock performance.now()
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow
  }
});

describe('usePerformanceMonitor', () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleGroupSpy: jest.SpyInstance;
  let consoleGroupEndSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReset();
    
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
    consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  describe('Render Timing', () => {
    it('should track render times', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackRenders: true })
      );

      // Mock performance.now() to return specific values
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 10; // First call returns 0, second returns 10
      });

      // Start timing
      act(() => {
        result.current.startRenderTiming();
      });

      // End timing
      act(() => {
        result.current.endRenderTiming();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.renderTime).toBe(10);
    });

    it('should warn about slow renders', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { 
          trackRenders: true, 
          logThreshold: 5 
        })
      );

      // Mock performance.now() for slow render
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 20; // First call returns 0, second returns 20 (slow render)
      });

      act(() => {
        result.current.startRenderTiming();
      });

      act(() => {
        result.current.endRenderTiming();
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('TestComponent render took 20.00ms')
      );
    });

    it('should not track renders when disabled', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackRenders: false })
      );

      act(() => {
        result.current.startRenderTiming();
        result.current.endRenderTiming();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.renderTime).toBe(0);
    });
  });

  describe('API Call Tracking', () => {
    it('should track API calls', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackApiCalls: true })
      );

      act(() => {
        result.current.trackApiCall();
        result.current.trackApiCall();
        result.current.trackApiCall();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.apiCallCount).toBe(3);
    });

    it('should not track API calls when disabled', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackApiCalls: false })
      );

      act(() => {
        result.current.trackApiCall();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.apiCallCount).toBe(0);
    });
  });

  describe('Cache Hit Rate Tracking', () => {
    it('should calculate cache hit rate', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackCacheHits: true })
      );

      act(() => {
        // 3 hits, 1 miss = 75% hit rate
        result.current.trackCacheHit();
        result.current.trackCacheHit();
        result.current.trackCacheHit();
        result.current.trackCacheMiss();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.cacheHitRate).toBe(75);
    });

    it('should handle zero cache requests', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackCacheHits: true })
      );

      const metrics = result.current.getMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should not track cache hits when disabled', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackCacheHits: false })
      );

      act(() => {
        result.current.trackCacheHit();
        result.current.trackCacheMiss();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('Metrics Management', () => {
    it('should reset metrics', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent')
      );

      // Set some metrics
      act(() => {
        result.current.trackApiCall();
        result.current.trackCacheHit();
      });

      let metrics = result.current.getMetrics();
      expect(metrics.apiCallCount).toBe(1);
      expect(metrics.cacheHitRate).toBe(100);

      // Reset metrics
      act(() => {
        result.current.resetMetrics();
      });

      metrics = result.current.getMetrics();
      expect(metrics.apiCallCount).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.renderTime).toBe(0);
    });

    it('should log performance summary', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackRenders: true })
      );

      // Mock performance.now() for logging test
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 15; // First call returns 0, second returns 15
      });

      act(() => {
        result.current.startRenderTiming();
      });

      act(() => {
        result.current.endRenderTiming();
        result.current.trackApiCall();
        result.current.trackCacheHit();
        result.current.trackCacheMiss();
      });

      act(() => {
        result.current.logPerformanceSummary();
      });

      expect(consoleGroupSpy).toHaveBeenCalledWith('[Performance Summary] TestComponent');
      expect(consoleLogSpy).toHaveBeenCalledWith('Last Render Time: 15.00ms');
      expect(consoleLogSpy).toHaveBeenCalledWith('API Calls: 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('Cache Hit Rate: 50.0%');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Last Update: \d{4}-\d{2}-\d{2}T/));
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });
  });

  describe('Automatic Render Timing', () => {
    it('should provide timing functions for manual use', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent', { trackRenders: true })
      );

      // Manual timing should work with proper mock
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 12; // First call returns 0, second returns 12
      });

      act(() => {
        result.current.startRenderTiming();
      });

      act(() => {
        result.current.endRenderTiming();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.renderTime).toBe(12);
    });
  });

  describe('Default Options', () => {
    it('should use default options when none provided', () => {
      const { result } = renderHook(() => 
        usePerformanceMonitor('TestComponent')
      );

      // Should be able to track all metrics with defaults
      act(() => {
        result.current.trackApiCall();
        result.current.trackCacheHit();
      });

      const metrics = result.current.getMetrics();
      expect(metrics.apiCallCount).toBe(1);
      expect(metrics.cacheHitRate).toBe(100);
    });
  });
});