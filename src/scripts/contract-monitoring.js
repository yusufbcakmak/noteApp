#!/usr/bin/env node

/**
 * CLI script for API contract monitoring and alerting
 */

const ContractMonitoring = require('../utils/contractMonitoring');
const logger = require('../utils/logger');

/**
 * CLI command handler for contract monitoring
 */
class ContractMonitoringCLI {
  constructor() {
    this.monitoring = null;
  }

  /**
   * Start monitoring daemon
   */
  async startMonitoring(options = {}) {
    try {
      logger.info('Starting contract monitoring daemon...');

      const monitoringOptions = {
        checkInterval: parseInt(options.interval) || 60000, // 1 minute default
        alertThreshold: parseInt(options.threshold) || 5,
        enableAlerts: options.alerts !== 'false',
        enableReports: options.reports !== 'false',
        webhookUrl: options.webhook,
        slackWebhook: options.slack,
        ...options
      };

      this.monitoring = new ContractMonitoring(monitoringOptions);

      // Set up event listeners
      this.setupEventListeners();

      // Initialize and start monitoring
      await this.monitoring.init();
      await this.monitoring.startMonitoring();

      logger.info('Contract monitoring daemon started successfully');
      logger.info(`Check interval: ${monitoringOptions.checkInterval}ms`);
      logger.info(`Alert threshold: ${monitoringOptions.alertThreshold} violations`);

      // Keep process alive
      process.on('SIGINT', async () => {
        logger.info('Shutting down contract monitoring...');
        this.monitoring.stopMonitoring();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Shutting down contract monitoring...');
        this.monitoring.stopMonitoring();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});

    } catch (error) {
      logger.error('Failed to start contract monitoring:', error);
      process.exit(1);
    }
  }

  /**
   * Run single check
   */
  async runCheck(options = {}) {
    try {
      logger.info('Running single contract monitoring check...');

      const monitoringOptions = {
        enableAlerts: options.alerts !== 'false',
        enableReports: false, // Don't generate reports for single checks
        ...options
      };

      this.monitoring = new ContractMonitoring(monitoringOptions);
      await this.monitoring.init();

      // Perform single check
      await this.monitoring.performCheck();

      const status = this.monitoring.getStatus();
      
      logger.info('Contract monitoring check completed');
      logger.info(`Violations detected: ${status.recentViolations.length}`);
      logger.info(`System health: ${status.systemHealth.status} (${status.systemHealth.score}/100)`);

      // Output results
      console.log(JSON.stringify(status, null, 2));

      return status;
    } catch (error) {
      logger.error('Contract monitoring check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Get monitoring status
   */
  async getStatus() {
    try {
      // Try to connect to running monitoring instance
      // For now, just read persisted data
      const fs = require('fs').promises;
      const path = require('path');

      try {
        const dataFile = 'data/contract-monitoring.json';
        const data = await fs.readFile(dataFile, 'utf8');
        const parsed = JSON.parse(data);

        const status = {
          isRunning: false, // Can't determine if daemon is running
          lastUpdated: parsed.lastUpdated,
          metrics: parsed.metrics,
          recentViolations: parsed.violations?.slice(-5) || [],
          recentAlerts: parsed.alerts?.slice(-3) || [],
          systemHealth: this.calculateSystemHealth(parsed.violations?.slice(-50) || [])
        };

        console.log(JSON.stringify(status, null, 2));
        return status;
      } catch (error) {
        logger.info('No monitoring data found');
        console.log(JSON.stringify({ status: 'no_data' }, null, 2));
        return { status: 'no_data' };
      }
    } catch (error) {
      logger.error('Failed to get monitoring status:', error);
      process.exit(1);
    }
  }

  /**
   * Generate monitoring report
   */
  async generateReport(options = {}) {
    try {
      logger.info('Generating contract monitoring report...');

      this.monitoring = new ContractMonitoring();
      await this.monitoring.init();

      const frequency = options.frequency || 'daily';
      const checkResults = { summary: { totalViolations: 0, criticalViolations: 0 } };
      
      const report = await this.monitoring.generateReport(frequency, checkResults);
      
      // Save report
      await this.monitoring.saveReport(report);

      logger.info(`${frequency} monitoring report generated`);
      logger.info(`Report ID: ${report.id}`);
      logger.info(`Violations in period: ${report.summary.totalViolations}`);

      console.log(JSON.stringify(report, null, 2));
      return report;
    } catch (error) {
      logger.error('Failed to generate monitoring report:', error);
      process.exit(1);
    }
  }

  /**
   * Test alert system
   */
  async testAlert(options = {}) {
    try {
      logger.info('Testing alert system...');

      const monitoringOptions = {
        enableAlerts: true,
        webhookUrl: options.webhook,
        slackWebhook: options.slack,
        ...options
      };

      this.monitoring = new ContractMonitoring(monitoringOptions);
      await this.monitoring.init();

      // Create test alert
      const testAlert = {
        id: `test_alert_${Date.now()}`,
        type: 'test_alert',
        severity: 'warning',
        title: 'Test Alert - API Contract Monitoring',
        message: 'This is a test alert to verify the alerting system is working correctly.',
        details: { test: true },
        timestamp: new Date().toISOString()
      };

      await this.monitoring.sendAlert(testAlert);

      logger.info('Test alert sent successfully');
      console.log(JSON.stringify(testAlert, null, 2));

      return testAlert;
    } catch (error) {
      logger.error('Failed to send test alert:', error);
      process.exit(1);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.monitoring) return;

    this.monitoring.on('monitoring_started', () => {
      logger.info('Contract monitoring started');
    });

    this.monitoring.on('monitoring_stopped', () => {
      logger.info('Contract monitoring stopped');
    });

    this.monitoring.on('check_completed', (results) => {
      logger.debug('Monitoring check completed', {
        violations: results.summary.totalViolations,
        critical: results.summary.criticalViolations
      });
    });

    this.monitoring.on('check_failed', (error) => {
      logger.error('Monitoring check failed', error);
    });

    this.monitoring.on('alert', (alert) => {
      logger.warn('Alert triggered', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });
    });

    this.monitoring.on('report_generated', (report) => {
      logger.info('Report generated', {
        id: report.id,
        frequency: report.frequency,
        violations: report.summary.totalViolations
      });
    });

    this.monitoring.on('error', (error) => {
      logger.error('Monitoring error:', error);
    });
  }

  /**
   * Calculate system health (duplicate from ContractMonitoring for CLI use)
   */
  calculateSystemHealth(violations) {
    if (violations.length === 0) {
      return { score: 100, status: 'excellent' };
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    let score = 100;
    score -= criticalCount * 20;
    score -= warningCount * 5;
    score = Math.max(0, score);

    let status;
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'fair';
    else if (score >= 25) status = 'poor';
    else status = 'critical';

    return { score, status };
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const cli = new ContractMonitoringCLI();

  try {
    switch (command) {
      case 'start':
        await cli.startMonitoring({
          interval: args[1],
          threshold: args[2],
          alerts: args[3],
          webhook: process.env.WEBHOOK_URL,
          slack: process.env.SLACK_WEBHOOK
        });
        break;
        
      case 'check':
        await cli.runCheck({
          alerts: args[1] || 'true'
        });
        break;
        
      case 'status':
        await cli.getStatus();
        break;
        
      case 'report':
        await cli.generateReport({
          frequency: args[1] || 'daily'
        });
        break;
        
      case 'test-alert':
        await cli.testAlert({
          webhook: process.env.WEBHOOK_URL,
          slack: process.env.SLACK_WEBHOOK
        });
        break;
        
      default:
        console.log('Usage:');
        console.log('  start [interval] [threshold] [alerts] - Start monitoring daemon');
        console.log('  check [alerts] - Run single monitoring check');
        console.log('  status - Get current monitoring status');
        console.log('  report [frequency] - Generate monitoring report');
        console.log('  test-alert - Test alert system');
        console.log('');
        console.log('Environment variables:');
        console.log('  WEBHOOK_URL - Webhook URL for alerts');
        console.log('  SLACK_WEBHOOK - Slack webhook URL for alerts');
        break;
    }
  } catch (error) {
    logger.error('Command failed:', error);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = ContractMonitoringCL