import { FeatureFlag } from '../types';

/**
 * Cache entry with expiration timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration options
 */
interface CacheConfig {
  defaultTtl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
}

/**
 * Service for caching feature flag data with automatic expiration
 * Implements a simple in-memory cache with TTL (Time To Live) support
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100,
      ...config
    };
  }

  /**
   * Store feature flags in cache with project-specific key
   */
  setFeatureFlags(projectId: string, flags: FeatureFlag[]): void {
    const key = `feature-flags:${projectId}`;
    this.set(key, flags);
  }

  /**
   * Retrieve cached feature flags for a project
   */
  getFeatureFlags(projectId: string): FeatureFlag[] | null {
    const key = `feature-flags:${projectId}`;
    return this.get(key);
  }

  /**
   * Store individual feature flag in cache
   */
  setFeatureFlag(flagId: string, flag: FeatureFlag): void {
    const key = `feature-flag:${flagId}`;
    this.set(key, flag);
  }

  /**
   * Retrieve individual cached feature flag
   */
  getFeatureFlag(flagId: string): FeatureFlag | null {
    const key = `feature-flag:${flagId}`;
    return this.get(key);
  }

  /**
   * Update a specific feature flag in the project cache
   */
  updateFeatureFlagInCache(projectId: string, flagId: string, updates: Partial<FeatureFlag>): void {
    const flags = this.getFeatureFlags(projectId);
    if (flags) {
      const updatedFlags = flags.map(flag => 
        flag.id === flagId ? { ...flag, ...updates, updatedAt: new Date().toISOString() } : flag
      );
      this.setFeatureFlags(projectId, updatedFlags);
    }

    // Also update individual flag cache
    const individualFlag = this.getFeatureFlag(flagId);
    if (individualFlag) {
      this.setFeatureFlag(flagId, { ...individualFlag, ...updates, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Invalidate cache entries for a specific project
   */
  invalidateProject(projectId: string): void {
    const projectKey = `feature-flags:${projectId}`;
    this.cache.delete(projectKey);

    // Also invalidate individual flags for this project
    for (const [key] of this.cache) {
      if (key.startsWith('feature-flag:')) {
        const flag = this.cache.get(key)?.data as FeatureFlag;
        if (flag && flag.projectId === projectId) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Invalidate a specific feature flag from cache
   */
  invalidateFeatureFlag(flagId: string, projectId?: string): void {
    const flagKey = `feature-flag:${flagId}`;
    this.cache.delete(flagKey);

    // If project ID is provided, also update the project cache
    if (projectId) {
      const flags = this.getFeatureFlags(projectId);
      if (flags) {
        const updatedFlags = flags.filter(flag => flag.id !== flagId);
        this.setFeatureFlags(projectId, updatedFlags);
      }
    }
  }

  /**
   * Generic cache set method
   */
  private set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.config.defaultTtl);

    // If key already exists, just update it
    if (this.cache.has(key)) {
      this.cache.set(key, {
        data,
        timestamp: now,
        expiresAt
      });
      return;
    }

    // Enforce cache size limit for new entries
    while (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    });
  }

  /**
   * Generic cache get method with expiration check
   */
  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if a cache entry exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize
    };
  }

  /**
   * Remove expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict the oldest cache entry to make room for new ones
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Export a singleton instance
export const cacheService = new CacheService();