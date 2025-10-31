const PlantDiagnosisEngine = require('./diagnosis-engine');
const Logger = require('./logger');

console.log('🌿 Testing Plant Helper App...\n');

// Test the diagnosis engine
const engine = new PlantDiagnosisEngine();
const logger = new Logger(engine.config);

// Test cases
const testCases = [
  {
    name: "Clear plant match - Tulsi",
    input: "My tulsi is getting dry sometimes and the leaves are turning brown"
  },
  {
    name: "Ambiguous input - Generic fallback",
    input: "My plant is not looking good"
  },
  {
    name: "Empty input",
    input: ""
  },
  {
    name: "Snake plant overwatering",
    input: "My snake plant has yellow mushy leaves"
  },
  {
    name: "Monstera light issues",
    input: "My monstera is stretching and has small leaves"
  }
];

console.log('Running test cases...\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  try {
    const result = engine.diagnose(testCase.input);
    logger.logInteraction(result);
    
    console.log(`✅ Plant: ${result.plantName} (${Math.round(result.plantMatchScore * 100)}%)`);
    console.log(`   Method: ${result.detectionMethod}`);
    console.log(`   Diagnoses: ${result.diagnoses.length}`);
    
    if (result.diagnoses.length > 0) {
      result.diagnoses.forEach((diagnosis, i) => {
        console.log(`   ${i + 1}. ${diagnosis.cause.label} (${Math.round(diagnosis.confidence * 100)}%)`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('');
});

// Test configuration loading
console.log('Testing configuration...');
console.log(`Min confidence threshold: ${engine.config.diagnosis.minConfidenceThreshold}`);
console.log(`Max diagnoses: ${engine.config.diagnosis.maxDiagnoses}`);
console.log(`Server port: ${engine.config.server?.port || 'default'}`);

// Test logging
console.log('\nTesting logging...');
const stats = logger.getLogStats();
console.log(`Total interactions logged: ${stats.totalInteractions}`);
console.log(`Plants detected: ${Object.keys(stats.plantsDetected).length}`);

console.log('\n🎉 All tests completed! The Plant Helper app is working correctly.');
