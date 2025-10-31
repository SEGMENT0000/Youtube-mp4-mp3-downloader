const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config = {}) {
    this.config = config;
    this.memoryLogs = [];
    this.maxMemoryLogs = 250;
    this.isReadOnlyEnvironment = this.detectReadOnlyEnvironment();

    if (!this.config.logging) {
      this.config.logging = { enabled: false };
    }

    if (this.isReadOnlyEnvironment) {
      this.config.logging.enabled = false;
    }

    this.logsDir = this.resolveLogsDirectory();

    if (this.config.logging.enabled && this.logsDir) {
      this.ensureLogsDirectory();
    }
  }

  detectReadOnlyEnvironment() {
    return Boolean(
      process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_REGION ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.GAE_ENV
    );
  }

  resolveLogsDirectory() {
    if (!this.config.logging.directory) {
      return null;
    }

    if (path.isAbsolute(this.config.logging.directory)) {
      return this.config.logging.directory;
    }

    return path.join(process.cwd(), this.config.logging.directory);
  }

  ensureLogsDirectory() {
    if (!this.logsDir) {
      return;
    }

    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.warn(`Logging disabled: Unable to create logs directory at ${this.logsDir}. ${error.message}`);
      this.config.logging.enabled = false;
    }
  }

  getLogFilename() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `plant-helper-${dateStr}.json`;
  }

  loadTodayLogs() {
    if (!this.config.logging.enabled || !this.logsDir) {
      return [...this.memoryLogs];
    }

    const filename = this.getLogFilename();
    const filepath = path.join(this.logsDir, filename);
    
    try {
      if (fs.existsSync(filepath)) {
        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`Warning: Could not load existing log file ${filename}: ${error.message}`);
    }
    
    return [];
  }

  saveLogs(logs) {
    if (!this.config.logging.enabled || !this.logsDir) {
      return;
    }

    const filename = this.getLogFilename();
    const filepath = path.join(this.logsDir, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error(`Error saving logs to ${filename}: ${error.message}`);
    }
  }

  logInteraction(diagnosisResult) {
    const logEntry = {
      timestamp: diagnosisResult.timestamp,
      originalInput: diagnosisResult.originalInput,
      detectedPlant: diagnosisResult.detectedPlant,
      plantName: diagnosisResult.plantName,
      plantMatchScore: diagnosisResult.plantMatchScore,
      detectionMethod: diagnosisResult.detectionMethod,
      diagnoses: diagnosisResult.diagnoses.map(d => ({
        cause: d.cause,
        confidence: d.confidence,
        why: d.why,
        actions: d.actions,
        eco_tip: d.eco_tip
      }))
    };

    this.memoryLogs.push(logEntry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }

    if (!this.config.logging.enabled || !this.logsDir) {
      return;
    }

    const logs = this.loadTodayLogs();
    logs.push(logEntry);
    this.saveLogs(logs);
  }

  getLogStats() {
    const logs = this.loadTodayLogs();
    const stats = {
      totalInteractions: logs.length,
      plantsDetected: {},
      averageConfidence: 0,
      mostCommonIssues: {}
    };

    if (logs.length === 0) {
      return stats;
    }

    let totalConfidence = 0;
    
    logs.forEach(log => {
      // Count plant detections
      const plantName = log.plantName;
      stats.plantsDetected[plantName] = (stats.plantsDetected[plantName] || 0) + 1;
      
      // Calculate average confidence
      if (log.diagnoses && log.diagnoses.length > 0) {
        const maxConfidence = Math.max(...log.diagnoses.map(d => d.confidence));
        totalConfidence += maxConfidence;
      }
      
      // Count common issues
      log.diagnoses.forEach(diagnosis => {
        const causeId = diagnosis.cause.id;
        stats.mostCommonIssues[causeId] = (stats.mostCommonIssues[causeId] || 0) + 1;
      });
    });

    stats.averageConfidence = totalConfidence / logs.length;

    return stats;
  }
}

module.exports = Logger;
