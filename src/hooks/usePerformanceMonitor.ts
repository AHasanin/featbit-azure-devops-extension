import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  apiCallCount: number;
  lastUpdate: Date;
}

interface PerformanceMonitorOptions {
  trackRenders?: boolean;
  trackApiCalls?: boolean;
  logThreshold?: number; // Log if render time exceeds this (ms)
}

/**
 * Hook for monitoring component performance metrics
 */
export const usePerformanceMonitor = (
  componentName: string,
  options: PerformanceMonitorOptions = {}
) => {
  const {
    trackRenders = true,
    trackApiCalls = true,
    logThreshold = 16 // 16ms = 60fps threshold
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    apiCallCount: 0,
    lastUpdate: new Date()
  });

  const renderStartRef = useRef<number>(0);
  const apiCallCountRef = useRef<number>(0);

  // Start render timing
  const startRenderTiming = useCallback(() => {
    if (trackRenders) {
      renderStartRef.current = performance.now();
    }
  }, [trackRenders]);

  // End render timing
  const endRenderTiming = useCallback(() => {
    if (trackRenders && renderStartRef.current > 0) {
      const renderTime = performance.now() - renderStartRef.current;
      metricsRef.current.renderTime = renderTime;
      metricsRef.current.lastUpdate = new Date();

      // Log slow renders
      if (renderTime > logThreshold) {
        console.warn(
          `[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms (threshold: ${logThreshold}ms)`
        );
      }

      renderStartRef.current = 0;
    }
  }, [trackRenders, componentName, logThreshold]);

  // Track API calls
  const trackApiCall = useCallback(() => {
    if (trackApiCalls) {
      apiCallCountRef.current++;
      metricsRef.current.apiCallCount = apiCallCountRef.current;
      metricsRef.current.lastUpdate = new Date();
    }
  }, [trackApiCalls]);



  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    return { ...metricsRef.current };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderTime: 0,
      apiCallCount: 0,
      lastUpdate: new Date()
    };
    apiCallCountRef.current = 0;
  }, []);

  // Log performance summary
  const logPerformanceSummary = useCallback(() => {
    const metrics = getMetrics();
    console.group(`[Performance Summary] ${componentName}`);
    console.log(`Last Render Time: ${metrics.renderTime.toFixed(2)}ms`);
    console.log(`API Calls: ${metrics.apiCallCount}`);
    console.log(`Last Update: ${metrics.lastUpdate.toISOString()}`);
    console.groupEnd();
  }, [componentName, getMetrics]);

  // Note: Automatic render timing removed for simplicity
  // Components should manually call startRenderTiming/endRenderTiming if needed

  return {
    startRenderTiming,
    endRenderTiming,
    trackApiCall,
    getMetrics,
    resetMetrics,
    logPerformanceSummary
  };
};

export default usePerformanceMonitor;