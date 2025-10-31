const path = require('path');
const PlantDiagnosisEngine = require('../src/diagnosis-engine');
const Logger = require('../src/logger');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

let engineInstance;
let loggerInstance;

function getEngine() {
  if (!engineInstance) {
    engineInstance = new PlantDiagnosisEngine(CONFIG_PATH);
  }
  return engineInstance;
}

function getLogger() {
  if (!loggerInstance) {
    const engine = getEngine();
    loggerInstance = new Logger(engine.config);
  }
  return loggerInstance;
}

module.exports = {
  getEngine,
  getLogger
};

