const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * API versioning middleware and utilities
 */
class ApiVersioning {
  constructor() {
    this.supportedVersions = ['1.0', '1.1'];
    this.defaultVersion = '1.0';
    this.deprecatedVersions = [];
    this.versionMappings = new Map();
    this.initialized = false;
  }

  /**
   * Initialize API versioning
   */
  init() {
    // Set up version mappings
    this.versionMappings.set('1.0', {
      features: ['basic-auth', 'notes-crud', 'groups-crud', 'history'],
      deprecatedFeatures: [],
      breaking_changes: []
    });

    this.versionMappings.set('1.1', {
      features: ['basic-auth', 'notes-crud', 'groups-crud', 'history', 'advanced-search', 'bulk-operations'],
      deprecatedFeatures: [],
      breaking_changes: []
    });

    this.initialized = true;
    logger.info('API versioning initialized', {
      supportedVersions: this.supportedVersions,
      defaultVersion: this.defaultVersion
    });
  }

  /**
   * Version detection middleware
   */
  detectVersion() {
    return (req, res, next) => {
      if (!this.initialized) {
        this.init();
      }

      let version = this.defaultVersion;

      // Check version from different sources (in order of priority)
      // 1. Accept header (Accept: application/vnd.api+json;version=1.1)
      const acceptHeader = req.get('Accept');
      if (acceptHeader) {
        const versionMatch = acceptHeader.match(/version=([0-9.]+)/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }

      // 2. Custom header (API-Version: 1.1)
      const apiVersionHeader = req.get('API-Version');
      if (apiVersionHeader) {
        version = apiVersionHeader;
      }

      // 3. Query parameter (?version=1.1)
      if (req.query.version) {
        version = req.query.version;
      }

      // 4. URL path (/api/v1.1/notes)
      const pathVersionMatch = req.path.match(/^\/api\/v([0-9.]+)\//);
      if (pathVersionMatch) {
        version = pathVersionMatch[1];
        // Remove version from path for downstream processing
        req.url = req.url.replace(`/v${version}`, '');
        req.path = req.path.replace(`/v${version}`, '');
      }

      // Validate version
      if (!this.isVersionSupported(version)) {
        return next(new ValidationError(`API version ${version} is not supported`, {
          supportedVersions: this.supportedVersions,
          requestedVersion: version
        }));
      }

      // Check for deprecated version
      if (this.isVersionDeprecated(version)) {
        res.set('Warning', `299 - "API version ${version} is deprecated. Please upgrade to version ${this.getLatestVersion()}"`);
        logger.warn('Deprecated API version used', {
          version,
          path: req.path,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }

      // Set version info on request
      req.apiVersion = {
        version,
        features: this.getVersionFeatures(version),
        isDeprecated: this.isVersionDeprecated(version),
        isLatest: version === this.getLatestVersion()
      };

      // Set response headers
      res.set('API-Version', version);
      res.set('API-Supported-Versions', this.supportedVersions.join(', '));

      logger.debug('API version detected', {
        version,
        path: req.path,
        method: req.method
      });

      next();
    };
  }

  /**
   * Feature gate middleware
   */
  requireFeature(featureName) {
    return (req, res, next) => {
      if (!req.apiVersion) {
        return next(new Error('API version not detected. Ensure version detection middleware is applied first.'));
      }

      const features = req.apiVersion.features;
      if (!features.includes(featureName)) {
        return next(new ValidationError(`Feature '${featureName}' is not available in API version ${req.apiVersion.version}`, {
          availableFeatures: features,
          requiredFeature: featureName,
          version: req.apiVersion.version
        }));
      }

      next();
    };
  }

  /**
   * Version-specific response transformation
   */
  transformResponse() {
    return (req, res, next) => {
      if (!req.apiVersion) {
        return next();
      }

      const originalJson = res.json;

      res.json = (data) => {
        // Transform response based on API version
        const transformedData = this.transformResponseData(data, req.apiVersion.version, req.path);
        return originalJson.call(res, transformedData);
      };

      next();
    };
  }

  /**
   * Transform response data based on version
   */
  transformResponseData(data, version, path) {
    // Version-specific transformations
    switch (version) {
      case '1.0':
        return this.transformToV10(data, path);
      case '1.1':
        return this.transformToV11(data, path);
      default:
        return data;
    }
  }

  /**
   * Transform to v1.0 format
   */
  transformToV10(data, path) {
    // Remove v1.1+ features from response
    if (data && typeof data === 'object') {
      // Remove advanced search metadata
      if (data.searchMetadata) {
        delete data.searchMetadata;
      }

      // Remove bulk operation results
      if (data.bulkResults) {
        delete data.bulkResults;
      }

      // Transform notes to v1.0 format
      if (data.data && Array.isArray(data.data.items)) {
        data.data.items = data.data.items.map(item => this.transformNoteToV10(item));
      } else if (data.data && data.data.id) {
        data.data = this.transformNoteToV10(data.data);
      }
    }

    return data;
  }

  /**
   * Transform to v1.1 format
   */
  transformToV11(data, path) {
    // v1.1 includes all features, no transformation needed
    return data;
  }

  /**
   * Transform note to v1.0 format
   */
  transformNoteToV10(note) {
    if (!note || typeof note !== 'object') {
      return note;
    }

    // Remove v1.1+ fields
    const v10Note = { ...note };
    delete v10Note.tags;
    delete v10Note.attachments;
    delete v10Note.collaborators;

    return v10Note;
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version) {
    return this.deprecatedVersions.includes(version);
  }

  /**
   * Get latest version
   */
  getLatestVersion() {
    return this.supportedVersions[this.supportedVersions.length - 1];
  }

  /**
   * Get version features
   */
  getVersionFeatures(version) {
    const versionInfo = this.versionMappings.get(version);
    return versionInfo ? versionInfo.features : [];
  }

  /**
   * Add new version
   */
  addVersion(version, features = [], breakingChanges = []) {
    if (this.supportedVersions.includes(version)) {
      throw new Error(`Version ${version} already exists`);
    }

    this.supportedVersions.push(version);
    this.supportedVersions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart !== bPart) {
          return aPart - bPart;
        }
      }
      
      return 0;
    });

    this.versionMappings.set(version, {
      features,
      deprecatedFeatures: [],
      breaking_changes: breakingChanges
    });

    logger.info(`API version ${version} added`, { features, breakingChanges });
  }

  /**
   * Deprecate version
   */
  deprecateVersion(version, reason = '') {
    if (!this.supportedVersions.includes(version)) {
      throw new Error(`Version ${version} does not exist`);
    }

    if (!this.deprecatedVersions.includes(version)) {
      this.deprecatedVersions.push(version);
      logger.info(`API version ${version} deprecated`, { reason });
    }
  }

  /**
   * Remove version
   */
  removeVersion(version) {
    const index = this.supportedVersions.indexOf(version);
    if (index > -1) {
      this.supportedVersions.splice(index, 1);
      this.versionMappings.delete(version);
      
      const depIndex = this.deprecatedVersions.indexOf(version);
      if (depIndex > -1) {
        this.deprecatedVersions.splice(depIndex, 1);
      }

      logger.info(`API version ${version} removed`);
    }
  }

  /**
   * Get version info
   */
  getVersionInfo(version) {
    if (!this.isVersionSupported(version)) {
      return null;
    }

    return {
      version,
      supported: true,
      deprecated: this.isVersionDeprecated(version),
      latest: version === this.getLatestVersion(),
      features: this.getVersionFeatures(version),
      ...this.versionMappings.get(version)
    };
  }

  /**
   * Get all versions info
   */
  getAllVersionsInfo() {
    return {
      supportedVersions: this.supportedVersions,
      deprecatedVersions: this.deprecatedVersions,
      defaultVersion: this.defaultVersion,
      latestVersion: this.getLatestVersion(),
      versions: Object.fromEntries(
        this.supportedVersions.map(version => [
          version,
          this.getVersionInfo(version)
        ])
      )
    };
  }

  /**
   * Generate version compatibility report
   */
  generateCompatibilityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      versions: this.getAllVersionsInfo(),
      compatibility: {}
    };

    // Check compatibility between versions
    for (let i = 0; i < this.supportedVersions.length - 1; i++) {
      const currentVersion = this.supportedVersions[i];
      const nextVersion = this.supportedVersions[i + 1];
      
      const currentFeatures = this.getVersionFeatures(currentVersion);
      const nextFeatures = this.getVersionFeatures(nextVersion);
      
      const addedFeatures = nextFeatures.filter(f => !currentFeatures.includes(f));
      const removedFeatures = currentFeatures.filter(f => !nextFeatures.includes(f));
      
      report.compatibility[`${currentVersion} -> ${nextVersion}`] = {
        backwardCompatible: removedFeatures.length === 0,
        addedFeatures,
        removedFeatures,
        breakingChanges: this.versionMappings.get(nextVersion)?.breaking_changes || []
      };
    }

    return report;
  }

  /**
   * Middleware to add version info to OpenAPI spec
   */
  addVersionToSpec() {
    return (req, res, next) => {
      if (req.path === '/api/openapi.json') {
        const originalJson = res.json;
        
        res.json = (spec) => {
          // Add version info to spec
          if (spec && spec.info) {
            spec.info['x-api-versions'] = this.getAllVersionsInfo();
          }
          
          return originalJson.call(res, spec);
        };
      }
      
      next();
    };
  }
}

module.exports = ApiVersioning;