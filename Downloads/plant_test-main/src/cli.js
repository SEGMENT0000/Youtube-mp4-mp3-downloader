const readline = require('readline');
const PlantDiagnosisEngine = require('./diagnosis-engine');
const Logger = require('./logger');

class PlantHelperCLI {
  constructor() {
    this.engine = new PlantDiagnosisEngine();
    this.logger = new Logger(this.engine.config);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  formatConfidence(confidence) {
    return `${Math.round(confidence * 100)}%`;
  }

  formatDiagnosis(diagnosis, index) {
    const confidence = this.formatConfidence(diagnosis.confidence);
    const actions = diagnosis.actions.map((action, i) => `${i + 1}) ${action}`).join('\n   ');
    
    return `
${index + 1}. ${diagnosis.cause.label} (Confidence: ${confidence})
   Why: ${diagnosis.why}
   Actions:
   ${actions}
   🌱 Eco Tip: ${diagnosis.eco_tip}`;
  }

  displayResults(result) {
    console.log('\n' + '='.repeat(60));
    console.log(`🌿 PLANT HELPER DIAGNOSIS RESULTS`);
    console.log('='.repeat(60));
    
    console.log(`\n📋 Plant Detected: ${result.plantName}`);
    console.log(`🎯 Match Score: ${this.formatConfidence(result.plantMatchScore)}`);
    console.log(`🔍 Detection Method: ${result.detectionMethod}`);
    
    if (result.diagnoses.length === 0) {
      console.log('\n❌ No specific diagnoses found. Try providing more details about your plant\'s symptoms.');
      return;
    }
    
    console.log(`\n🔬 DIAGNOSES (${result.diagnoses.length} found):`);
    result.diagnoses.forEach((diagnosis, index) => {
      console.log(this.formatDiagnosis(diagnosis, index));
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`💡 Remember: These are suggestions based on your description.`);
    console.log(`   If symptoms persist, consider consulting a local plant expert.`);
    console.log('='.repeat(60) + '\n');
  }

  async promptUser() {
    return new Promise((resolve) => {
      this.rl.question('\n🌱 Describe your plant problem (or type "quit" to exit): ', (input) => {
        resolve(input.trim());
      });
    });
  }

  async run() {
    console.log('🌿 Welcome to Plant Helper CLI! 🌿');
    console.log('I\'ll help diagnose your plant problems with some sassy but helpful advice.');
    console.log('Type "quit" at any time to exit.\n');

    while (true) {
      try {
        const input = await this.promptUser();
        
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
          console.log('\n👋 Thanks for using Plant Helper! Keep your plants happy! 🌱');
          break;
        }
        
        if (input.length === 0) {
          console.log('🤔 Please describe your plant\'s problem or type "quit" to exit.');
          continue;
        }
        
        console.log('\n🔍 Analyzing your plant problem...');
        
        const result = this.engine.diagnose(input);
        this.logger.logInteraction(result);
        this.displayResults(result);
        
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        console.log('Please try again or type "quit" to exit.\n');
      }
    }
    
    this.rl.close();
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new PlantHelperCLI();
  cli.run().catch(console.error);
}

module.exports = PlantHelperCLI;
