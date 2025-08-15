const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const ApiConsistencyValidator = require('./apiConsistencyValidator');
const RuntimeValidation = require('./runtimeValidation');
const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');

/**
 * Contract monitoring and alerting system
 */
class ContractMonitoring extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      checkInterval: options.checkInterval || 60000, // 1 minute
      alertThreshold: options.alertThreshold || 5, // 5 violations before alert
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      enableAlerts: options.enableAlerts !== false,
      enableReports: options.enableReports !== false,
      ...options
    };

    this.consistencyValidator = new ApiConsistencyValidator();
    this.runtimeValidation = new RuntimeValidation();
    this.swaggerConfig = new SwaggerConfig();
    
    this.violations = [];
    this.alerts = [];
    this.reports = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastCheck = null;
    this.metrics = {
      totalChecks: 0,
      violationsDetected: 0,
      alertsSent: 0,
      reportsGenerated: 0
    };
  }

  /**
   * Initialize contract monitoring
   */
  async init() {
    await this.consistencyValidator.init();
    await this.runtimeValidation.init();
    
    // Load existing violations and alerts
    await this.loadPersistedData();
    
    logger.info('Contract monitoring initialized', {
      options: this.options,
      metrics: this.metrics
    });
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Contract monitoring is already running');
      return;
    }

    if (!this.consistencyValidator.initialized) {
      await this.init();
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performCheck().catch(error => {
        logger.error('Contract monitoring check failed:', error);
        this.emit('error', error);
      });
    }, this.options.checkInterval);

    // Perform initial check
    await this.performCheck();

    logger.info('Contract monitoring started', {
      interval: this.options.checkInterval
    });

    this.emit('monitoring_started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info('Contract monitoring stopped');
    this.emit('monitoring_stopped');
  }

  /**
   * Perform monitoring check
   */
  async performCheck() {
    const checkId = `check_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    logger.debug('Performing contract monitoring check', { checkId });

    try {
      this.metrics.totalChecks++;
      this.lastCheck = timestamp;

      // Check API consistency
      const consistencyResults = await this.checkApiConsistency();
      
      // Check runtime validation stats
      const validationResults = await this.checkRuntimeValidation();
      
      // Check schema synchronization
      const schemaResults = await this.checkSchemaSynchronization();

      // Combine results
      const checkResults = {
        checkId,
        timestamp,
        consistency: consistencyResults,
        validation: validationResults,
        schema: schemaResults,
        summary: {
          totalViolations: consistencyResults.violations.length + 
                          validationResults.violations.length + 
                          schemaResults.violations.length,
          criticalViolations: 0,
          warningViolations: 0
        }
      };

      // Count violation severities
      const allViolations = [
        ...consistencyResults.violations,
        ...validationResults.violations,
        ...schemaResults.violations
      ];

      checkResults.summary.criticalViolations = allViolations.filter(v => v.severity === 'critical').length;
      checkResults.summary.warningViolations = allViolations.filter(v => v.severity === 'warning').length;

      // Store violations
      if (allViolations.length > 0) {
        this.violations.push(...allViolations);
        this.metrics.violationsDetected += allViolations.length;
        
        // Clean up old violations
        this.cleanupOldViolations();
      }

      // Check for alert conditions
      await this.checkAlertConditions(checkResults);

      // Generate reports if needed
      if (this.options.enableReports) {
        await this.generatePeriodicReports(checkResults);
      }

      // Persist data
      await this.persistData();

      this.emit('check_completed', checkResults);
      
      logger.debug('Contract monitoring check completed', {
        checkId,
        violations: checkResults.summary.totalViolations
      });

    } catch (error) {
      logger.error('Contract monitoring check failed:', error);
      this.emit('check_failed', { checkId, error: error.message });
      throw error;
    }
  }

  /**
   * Check API consistency
   */
  async checkApiConsistency() {
    try {
      // Scan frontend for API calls
      await this.consistencyValidator.scanFrontendApiCalls('frontend/src');
      
      // Validate consistency
      const inconsistencies = await this.consistencyValidator.validateConsistency();
      
      const violations = inconsistencies.map(inconsistency => ({
        id: `consistency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'api_consistency',
        subtype: inconsistency.type,
        severity: inconsistency.severity === 'error' ? 'critical' : 'warning',
        message: inconsistency.message,
        details: inconsistency,
        timestamp: new Date().toISOString(),
        source: 'consistency_validator'
      }));

      return {
        status: violations.length === 0 ? 'healthy' : 'issues_detected',
        violations,
        summary: {
          frontendApiCalls: this.consistencyValidator.frontendApiCalls.size,
          backendEndpoints: this.consistencyValidator.backendEndpoints.size,
          inconsistencies: inconsistencies.length
        }
      };
    } catch (error) {
      logger.error('API consistency check failed:', error);
      return {
        status: 'check_failed',
        violations: [{
          id: `consistency_error_${Date.now()}`,
          type: 'monitoring_error',
          severity: 'critical',
          message: `API consistency check failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          source: 'consistency_validator'
        }],
        summary: { error: error.message }
      };
    }
  }

  /**
   * Check runtime validation
   */
  async checkRuntimeValidation() {
    try {
      const stats = this.runtimeValidation.getValidationStats();
      const violations = [];

      // Check for high failure rates
      const requestFailureRate = stats.totalRequests > 0 
        ? (stats.invalidRequests / stats.totalRequests) * 100 
        : 0;

      const responseFailureRate = stats.totalResponses > 0 
        ? (stats.invalidResponses / stats.totalResponses) * 100 
        : 0;

      if (requestFailureRate > 10) { // More than 10% failure rate
        violations.push({
          id: `validation_request_${Date.now()}`,
          type: 'runtime_validation',
          subtype: 'high_request_failure_rate',
          severity: 'warning',
          message: `High request validation failure rate: ${requestFailureRate.toFixed(2)}%`,
          details: { failureRate: requestFailureRate, stats },
          timestamp: new Date().toISOString(),
          source: 'runtime_validation'
        });
      }

      if (responseFailureRate > 5) { // More than 5% failure rate
        violations.push({
          id: `validation_response_${Date.now()}`,
          type: 'runtime_validation',
          subtype: 'high_response_failure_rate',
          severity: 'critical',
          message: `High response validation failure rate: ${responseFailureRate.toFixed(2)}%`,
          details: { failureRate: responseFailureRate, stats },
          timestamp: new Date().toISOString(),
          source: 'runtime_validation'
        });
      }

      // Check for recent errors
      const recentErrors = stats.recentErrors || [];
      if (recentErrors.length > this.options.alertThreshold) {
        violations.push({
          id: `validation_errors_${Date.now()}`,
          type: 'runtime_validation',
          subtype: 'high_error_volume',
          severity: 'warning',
          message: `High volume of validation errors: ${recentErrors.length} recent errors`,
          details: { recentErrors: recentErrors.slice(0, 5) }, // Include first 5 errors
          timestamp: new Date().toISOString(),
          source: 'runtime_validation'
        });
      }

      return {
        status: violations.length === 0 ? 'healthy' : 'issues_detected',
        violations,
        summary: {
          requestFailureRate: `${requestFailureRate.toFixed(2)}%`,
          responseFailureRate: `${responseFailureRate.toFixed(2)}%`,
          totalRequests: stats.totalRequests,
          totalResponses: stats.totalResponses,
          recentErrorCount: recentErrors.length
        }
      };
    } catch (error) {
      logger.error('Runtime validation check failed:', error);
      return {
        status: 'check_failed',
        violations: [{
          id: `validation_error_${Date.now()}`,
          type: 'monitoring_error',
          severity: 'critical',
          message: `Runtime validation check failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          source: 'runtime_validation'
        }],
        summary: { error: error.message }
      };
    }
  }

  /**
   * Check schema synchronization
   */
  async checkSchemaSynchronization() {
    try {
      const violations = [];
      const spec = this.swaggerConfig.getSpec();

      // Check if OpenAPI spec is valid
      if (!spec || !spec.paths) {
        violations.push({
          id: `schema_invalid_${Date.now()}`,
          type: 'schema_synchronization',
          subtype: 'invalid_spec',
          severity: 'critical',
          message: 'OpenAPI specification is invalid or missing',
          timestamp: new Date().toISOString(),
          source: 'schema_validator'
        });
      }

      // Check for missing descriptions (documentation quality)
      if (spec && spec.paths) {
        let missingDescriptions = 0;
        
        for (const [pathPattern, pathItem] of Object.entries(spec.paths)) {
          for (const [method, operation] of Object.entries(pathItem)) {
            if (typeof operation === 'object' && method !== 'parameters') {
              if (!operation.summary && !operation.description) {
                missingDescriptions++;
              }
            }
          }
        }

        if (missingDescriptions > 0) {
          violations.push({
            id: `schema_docs_${Date.now()}`,
            type: 'schema_synchronization',
            subtype: 'missing_documentation',
            severity: 'warning',
            message: `${missingDescriptions} endpoints are missing documentation`,
            details: { missingDescriptions },
            timestamp: new Date().toISOString(),
            source: 'schema_validator'
          });
        }
      }

      // Check for schema version mismatches
      const currentVersion = spec?.info?.version;
      const expectedVersion = process.env.API_VERSION || '1.0.0';
      
      if (currentVersion !== expectedVersion) {
        violations.push({
          id: `schema_version_${Date.now()}`,
          type: 'schema_synchronization',
          subtype: 'version_mismatch',
          severity: 'warning',
          message: `Schema version mismatch: expected ${expectedVersion}, got ${currentVersion}`,
          details: { currentVersion, expectedVersion },
          timestamp: new Date().toISOString(),
          source: 'schema_validator'
        });
      }

      return {
        status: violations.length === 0 ? 'healthy' : 'issues_detected',
        violations,
        summary: {
          specValid: !!spec,
          pathCount: spec?.paths ? Object.keys(spec.paths).length : 0,
          schemaCount: spec?.components?.schemas ? Object.keys(spec.components.schemas).length : 0,
          currentVersion
        }
      };
    } catch (error) {
      logger.error('Schema synchronization check failed:', error);
      return {
        status: 'check_failed',
        violations: [{
          id: `schema_error_${Date.now()}`,
          type: 'monitoring_error',
          severity: 'critical',
          message: `Schema synchronization check failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          source: 'schema_validator'
        }],
        summary: { error: error.message }
      };
    }
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions(checkResults) {
    if (!this.options.enableAlerts) {
      return;
    }

    const criticalViolations = checkResults.summary.criticalViolations;
    const totalViolations = checkResults.summary.totalViolations;

    // Alert on critical violations
    if (criticalViolations > 0) {
      await this.sendAlert({
        id: `alert_critical_${Date.now()}`,
        type: 'critical_violations',
        severity: 'critical',
        title: `${criticalViolations} Critical API Contract Violations Detected`,
        message: `Critical violations detected in API contract monitoring. Immediate attention required.`,
        details: checkResults,
        timestamp: new Date().toISOString()
      });
    }

    // Alert on high violation count
    if (totalViolations >= this.options.alertThreshold) {
      await this.sendAlert({
        id: `alert_threshold_${Date.now()}`,
        type: 'violation_threshold',
        severity: 'warning',
        title: `High Number of API Contract Violations (${totalViolations})`,
        message: `${totalViolations} violations detected, exceeding threshold of ${this.options.alertThreshold}.`,
        details: checkResults,
        timestamp: new Date().toISOString()
      });
    }

    // Alert on monitoring failures
    const failedChecks = [
      checkResults.consistency.status === 'check_failed',
      checkResults.validation.status === 'check_failed',
      checkResults.schema.status === 'check_failed'
    ].filter(Boolean).length;

    if (failedChecks > 0) {
      await this.sendAlert({
        id: `alert_monitoring_${Date.now()}`,
        type: 'monitoring_failure',
        severity: 'critical',
        title: `API Contract Monitoring Failures (${failedChecks} checks failed)`,
        message: `Some monitoring checks failed to complete. System health may be compromised.`,
        details: checkResults,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send alert
   */
  async sendAlert(alert) {
    this.alerts.push(alert);
    this.metrics.alertsSent++;

    logger.warn('API contract alert sent', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title
    });

    // Emit alert event
    this.emit('alert', alert);

    // Send to external systems (webhook, email, etc.)
    await this.sendExternalAlert(alert);

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  /**
   * Send alert to external systems
   */
  async sendExternalAlert(alert) {
    try {
      // Webhook notification
      if (this.options.webhookUrl) {
        await this.sendWebhookAlert(alert);
      }

      // Email notification
      if (this.options.emailConfig) {
        await this.sendEmailAlert(alert);
      }

      // Slack notification
      if (this.options.slackWebhook) {
        await this.sendSlackAlert(alert);
      }

    } catch (error) {
      logger.error('Failed to send external alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    try {
      const response = await fetch(this.options.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert,
          service: 'api-contract-monitoring',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      logger.debug('Webhook alert sent successfully', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const color = alert.severity === 'critical' ? 'danger' : 'warning';
      const payload = {
        text: alert.title,
        attachments: [{
          color,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: true
            }
          ]
        }]
      };

      const response = await fetch(this.options.slackWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook request failed: ${response.status}`);
      }

      logger.debug('Slack alert sent successfully', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Generate periodic reports
   */
  async generatePeriodicReports(checkResults) {
    const now = new Date();
    const lastReport = this.reports[this.reports.length - 1];
    
    // Generate daily report
    if (!lastReport || this.shouldGenerateReport(lastReport.timestamp, now, 'daily')) {
      const report = await this.generateReport('daily', checkResults);
      this.reports.push(report);
      this.metrics.reportsGenerated++;
      
      this.emit('report_generated', report);
      
      // Save report to file
      await this.saveReport(report);
    }
  }

  /**
   * Check if report should be generated
   */
  shouldGenerateReport(lastReportTime, currentTime, frequency) {
    const lastReport = new Date(lastReportTime);
    const timeDiff = currentTime - lastReport;
    
    switch (frequency) {
      case 'hourly':
        return timeDiff >= 60 * 60 * 1000; // 1 hour
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return false;
    }
  }

  /**
   * Generate monitoring report
   */
  async generateReport(frequency, checkResults) {
    const now = new Date();
    const reportPeriod = this.getReportPeriod(frequency, now);
    
    // Filter violations for report period
    const periodViolations = this.violations.filter(v => {
      const violationTime = new Date(v.timestamp);
      return violationTime >= reportPeriod.start && violationTime <= reportPeriod.end;
    });

    // Filter alerts for report period
    const periodAlerts = this.alerts.filter(a => {
      const alertTime = new Date(a.timestamp);
      return alertTime >= reportPeriod.start && alertTime <= reportPeriod.end;
    });

    const report = {
      id: `report_${frequency}_${Date.now()}`,
      type: 'monitoring_report',
      frequency,
      period: reportPeriod,
      timestamp: now.toISOString(),
      summary: {
        totalViolations: periodViolations.length,
        criticalViolations: periodViolations.filter(v => v.severity === 'critical').length,
        warningViolations: periodViolations.filter(v => v.severity === 'warning').length,
        totalAlerts: periodAlerts.length,
        monitoringChecks: this.metrics.totalChecks,
        systemHealth: this.calculateSystemHealth(periodViolations)
      },
      violations: periodViolations,
      alerts: periodAlerts,
      trends: this.calculateTrends(periodViolations, frequency),
      recommendations: this.generateRecommendations(periodViolations),
      latestCheck: checkResults
    };

    return report;
  }

  /**
   * Get report period
   */
  getReportPeriod(frequency, endTime) {
    const end = new Date(endTime);
    let start;

    switch (frequency) {
      case 'hourly':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case 'daily':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /**
   * Calculate system health score
   */
  calculateSystemHealth(violations) {
    if (violations.length === 0) {
      return { score: 100, status: 'excellent' };
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    // Calculate score (100 - penalties)
    let score = 100;
    score -= criticalCount * 20; // 20 points per critical violation
    score -= warningCount * 5;   // 5 points per warning violation

    score = Math.max(0, score); // Minimum score is 0

    let status;
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'fair';
    else if (score >= 25) status = 'poor';
    else status = 'critical';

    return { score, status };
  }

  /**
   * Calculate trends
   */
  calculateTrends(violations, frequency) {
    // Simple trend calculation - could be enhanced
    const now = new Date();
    const halfPeriod = frequency === 'daily' ? 12 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const midPoint = new Date(now.getTime() - halfPeriod);

    const firstHalf = violations.filter(v => new Date(v.timestamp) < midPoint);
    const secondHalf = violations.filter(v => new Date(v.timestamp) >= midPoint);

    const trend = secondHalf.length > firstHalf.length ? 'increasing' : 
                  secondHalf.length < firstHalf.length ? 'decreasing' : 'stable';

    return {
      trend,
      firstHalfCount: firstHalf.length,
      secondHalfCount: secondHalf.length,
      changePercent: firstHalf.length > 0 
        ? ((secondHalf.length - firstHalf.length) / firstHalf.length * 100).toFixed(1)
        : '0'
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(violations) {
    const recommendations = [];
    const violationTypes = {};

    // Count violation types
    violations.forEach(v => {
      const key = `${v.type}_${v.subtype}`;
      violationTypes[key] = (violationTypes[key] || 0) + 1;
    });

    // Generate recommendations based on common violations
    for (const [type, count] of Object.entries(violationTypes)) {
      if (count >= 3) { // 3 or more of the same type
        recommendations.push({
          type: 'frequent_violation',
          priority: 'high',
          message: `Frequent ${type.replace('_', ' ')} violations detected (${count} occurrences). Consider reviewing and fixing the root cause.`
        });
      }
    }

    // General recommendations
    if (violations.length > 10) {
      recommendations.push({
        type: 'high_violation_count',
        priority: 'medium',
        message: 'High number of violations detected. Consider implementing automated contract validation in your CI/CD pipeline.'
      });
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push({
        type: 'critical_violations',
        priority: 'high',
        message: `${criticalCount} critical violations require immediate attention to maintain API reliability.`
      });
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    try {
      const reportsDir = 'reports/contract-monitoring';
      await fs.mkdir(reportsDir, { recursive: true });

      const filename = `${report.frequency}-report-${report.id}.json`;
      const filepath = path.join(reportsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');
      
      logger.info('Monitoring report saved', { 
        reportId: report.id, 
        filepath,
        violations: report.summary.totalViolations 
      });
    } catch (error) {
      logger.error('Failed to save monitoring report:', error);
    }
  }

  /**
   * Clean up old violations
   */
  cleanupOldViolations() {
    const cutoffTime = new Date(Date.now() - this.options.retentionPeriod);
    const initialCount = this.violations.length;
    
    this.violations = this.violations.filter(v => 
      new Date(v.timestamp) > cutoffTime
    );

    const removedCount = initialCount - this.violations.length;
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old violations`);
    }
  }

  /**
   * Clean up old alerts
   */
  cleanupOldAlerts() {
    const cutoffTime = new Date(Date.now() - this.options.retentionPeriod);
    const initialCount = this.alerts.length;
    
    this.alerts = this.alerts.filter(a => 
      new Date(a.timestamp) > cutoffTime
    );

    const removedCount = initialCount - this.alerts.length;
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old alerts`);
    }
  }

  /**
   * Load persisted data
   */
  async loadPersistedData() {
    try {
      const dataFile = 'data/contract-monitoring.json';
      const data = await fs.readFile(dataFile, 'utf8');
      const parsed = JSON.parse(data);

      this.violations = parsed.violations || [];
      this.alerts = parsed.alerts || [];
      this.reports = parsed.reports || [];
      this.metrics = { ...this.metrics, ...parsed.metrics };

      logger.debug('Loaded persisted monitoring data', {
        violations: this.violations.length,
        alerts: this.alerts.length,
        reports: this.reports.length
      });
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      logger.debug('No persisted monitoring data found, starting fresh');
    }
  }

  /**
   * Persist data
   */
  async persistData() {
    try {
      const dataDir = 'data';
      await fs.mkdir(dataDir, { recursive: true });

      const data = {
        violations: this.violations,
        alerts: this.alerts,
        reports: this.reports.slice(-10), // Keep only last 10 reports
        metrics: this.metrics,
        lastUpdated: new Date().toISOString()
      };

      const dataFile = path.join(dataDir, 'contract-monitoring.json');
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      logger.error('Failed to persist monitoring data:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastCheck: this.lastCheck,
      metrics: this.metrics,
      recentViolations: this.violations.slice(-5),
      recentAlerts: this.alerts.slice(-3),
      systemHealth: this.calculateSystemHealth(this.violations.slice(-50)) // Last 50 violations
    };
  }

  /**
   * Get detailed monitoring report
   */
  getDetailedReport() {
    return {
      status: this.getStatus(),
      violations: this.violations,
      alerts: this.alerts,
      reports: this.reports,
      configuration: this.options
    };
  }
}

module.exports = ContractMonitoring;