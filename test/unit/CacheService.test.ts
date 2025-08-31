import { CacheService } from '../../src/services/CacheService';
import { FeatureFlag } from '../../src/types';

describe('CacheService', () => {
  let cacheService: CacheService;
  
  const mockFeatureFlag: FeatureFlag = {
    id: 'flag-1',
    name: 'test-flag',
    description: 'Test flag',
    enabled: true,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    linkedWorkItems: [123]
  };

  beforeEach(() => {
    cacheService = new CacheService({ defaultTtl: 1000, maxSize: 10 });
  });

  afterEach(() => {
    cacheService.clear();
  });

  describe('Feature Flag Caching', () => {
    it('should cache and retrieve feature flags by project', () => {
      const flags = [mockFeatureFlag];
      
      cacheService.setFeatureFlags('project-1', flags);
      const cachedFlags = cacheService.getFeatureFlags('project-1');
      
      expect(cachedFlags).toEqual(flags);
    });

    it('should return null for non-existent project', () => {
      const cachedFlags = cacheService.getFeatureFlags('non-existent');
      expect(cachedFlags).toBeNull();
    });

    it('should cache individual feature flags', () => {
      cacheService.setFeatureFlag('flag-1', mockFeatureFlag);
      const cachedFlag = cacheService.getFeatureFlag('flag-1');
      
      expect(cachedFlag).toEqual(mockFeatureFlag);
    });

    it('should update feature flag in project cache', () => {
      const flags = [mockFeatureFlag];
      cacheService.setFeatureFlags('project-1', flags);
      
      cacheService.updateFeatureFlagInCache('project-1', 'flag-1', { enabled: false });
      
      const updatedFlags = cacheService.getFeatureFlags('project-1');
      expect(updatedFlags![0].enabled).toBe(false);
      expect(updatedFlags![0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Cache Expiration', () => {
    it('should expire cache entries after TTL', async () => {
      const shortTtlCache = new CacheService({ defaultTtl: 50 });
      const flags = [mockFeatureFlag];
      
      shortTtlCache.setFeatureFlags('project-1', flags);
      expect(shortTtlCache.getFeatureFlags('project-1')).toEqual(flags);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(shortTtlCache.getFeatureFlags('project-1')).toBeNull();
    });

    it('should clean up expired entries', async () => {
      const shortTtlCache = new CacheService({ defaultTtl: 50 });
      const flags = [mockFeatureFlag];
      
      shortTtlCache.setFeatureFlags('project-1', flags);
      shortTtlCache.setFeatureFlags('project-2', flags);
      
      expect(shortTtlCache.getStats().size).toBe(2);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      
      shortTtlCache.cleanup();
      expect(shortTtlCache.getStats().size).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate project cache', () => {
      const flags = [mockFeatureFlag];
      cacheService.setFeatureFlags('project-1', flags);
      cacheService.setFeatureFlag('flag-1', mockFeatureFlag);
      
      cacheService.invalidateProject('project-1');
      
      expect(cacheService.getFeatureFlags('project-1')).toBeNull();
      expect(cacheService.getFeatureFlag('flag-1')).toBeNull();
    });

    it('should invalidate specific feature flag', () => {
      const flags = [mockFeatureFlag];
      cacheService.setFeatureFlags('project-1', flags);
      cacheService.setFeatureFlag('flag-1', mockFeatureFlag);
      
      cacheService.invalidateFeatureFlag('flag-1', 'project-1');
      
      expect(cacheService.getFeatureFlag('flag-1')).toBeNull();
      
      const projectFlags = cacheService.getFeatureFlags('project-1');
      expect(projectFlags).toEqual([]);
    });
  });

  describe('Cache Size Management', () => {
    it('should enforce maximum cache size', () => {
      const smallCache = new CacheService({ maxSize: 2 });
      
      smallCache.setFeatureFlags('project-1', [mockFeatureFlag]);
      expect(smallCache.getStats().size).toBe(1);
      
      smallCache.setFeatureFlags('project-2', [mockFeatureFlag]);
      expect(smallCache.getStats().size).toBe(2);
      
      smallCache.setFeatureFlags('project-3', [mockFeatureFlag]);
      expect(smallCache.getStats().size).toBe(2);
      
      // The oldest entry (project-1) should be evicted
      expect(smallCache.getFeatureFlags('project-1')).toBeNull();
      expect(smallCache.getFeatureFlags('project-2')).not.toBeNull();
      expect(smallCache.getFeatureFlags('project-3')).not.toBeNull();
    });

    it('should provide cache statistics', () => {
      cacheService.setFeatureFlags('project-1', [mockFeatureFlag]);
      
      const stats = cacheService.getStats();
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(10);
    });
  });

  describe('Cache Operations', () => {
    it('should check if cache has entry', () => {
      expect(cacheService.has('feature-flags:project-1')).toBe(false);
      
      cacheService.setFeatureFlags('project-1', [mockFeatureFlag]);
      expect(cacheService.has('feature-flags:project-1')).toBe(true);
    });

    it('should clear all cache entries', () => {
      cacheService.setFeatureFlags('project-1', [mockFeatureFlag]);
      cacheService.setFeatureFlag('flag-1', mockFeatureFlag);
      
      expect(cacheService.getStats().size).toBe(2);
      
      cacheService.clear();
      expect(cacheService.getStats().size).toBe(0);
    });
  });
});