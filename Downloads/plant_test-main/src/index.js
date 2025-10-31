const express = require('express');
const cors = require('cors');
const path = require('path');
const PlantDiagnosisEngine = require('./diagnosis-engine');
const Logger = require('./logger');

class PlantHelperAPI {
  constructor() {
    this.app = express();
    this.engine = new PlantDiagnosisEngine();
    this.logger = new Logger(this.engine.config);
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // Main diagnosis endpoint
    this.app.post('/api/diagnose', (req, res) => {
      try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
          return res.status(400).json({
            error: 'Invalid input',
            message: 'Please provide a text field with your plant problem description'
          });
        }

        const result = this.engine.diagnose(text);
        this.logger.logInteraction(result);
        
        res.json(result);
      } catch (error) {
        console.error('Diagnosis error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process diagnosis request'
        });
      }
    });

    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Stats endpoint
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = this.logger.getLogStats();
        res.json(stats);
      } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve statistics'
        });
      }
    });

    // Serve web interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  start() {
    const port = this.engine.config.server?.port || 3000;
    const host = this.engine.config.server?.host || 'localhost';
    
    this.app.listen(port, host, () => {
      console.log(`🌿 Plant Helper API running at http://${host}:${port}`);
      console.log(`📱 Web interface: http://${host}:${port}`);
      console.log(`🔗 API endpoint: http://${host}:${port}/api/diagnose`);
      console.log(`📊 Stats endpoint: http://${host}:${port}/api/stats`);
      console.log('\nPress Ctrl+C to stop the server');
    });
  }
}

// Run server if this file is executed directly
if (require.main === module) {
  const api = new PlantHelperAPI();
  api.start();
}

module.exports = PlantHelperAPI;
