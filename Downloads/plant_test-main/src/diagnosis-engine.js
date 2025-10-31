const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

class PlantDiagnosisEngine {
  constructor(configPath = './config.json') {
    this.config = this.loadConfig(configPath);
    this.plants = this.loadPlantData();
    this.fuse = this.initializeFuzzySearch();
  }

  loadConfig(configPath) {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(`Warning: Could not load config from ${configPath}, using defaults`);
      return {
        diagnosis: {
          minConfidenceThreshold: 0.3,
          maxDiagnoses: 3,
          plantMatchWeight: 0.4,
          symptomMatchWeight: 0.6,
          fuzzyThreshold: 0.6
        },
        ui: {
          tone: 'friendly-sassy',
          maxInputLength: 500
        }
      };
    }
  }

  loadPlantData() {
    try {
      const dataPath = path.join(__dirname, '../data/plants.json');
      const plantData = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(plantData);
    } catch (error) {
      throw new Error(`Failed to load plant data: ${error.message}`);
    }
  }

  initializeFuzzySearch() {
    const searchOptions = {
      keys: ['name', 'aliases'],
      threshold: this.config.diagnosis.fuzzyThreshold,
      includeScore: true,
      minMatchCharLength: 2
    };
    return new Fuse(this.plants, searchOptions);
  }

  detectPlant(inputText) {
    const text = inputText.toLowerCase();
    const words = text.split(/\s+/);
    
    // First try exact plant name matching (prioritize plant names over symptoms)
    for (const plant of this.plants) {
      const plantName = plant.name.toLowerCase();
      const plantWords = plantName.split(/\s+/);
      
      // Check if plant name appears as complete words in the input
      const plantNameMatch = plantWords.every(plantWord => 
        words.some(word => word === plantWord || word.includes(plantWord))
      );
      
      if (plantNameMatch && plantWords.length > 0) {
        return {
          plant: plant,
          score: 1.0,
          method: 'plant_name_match'
        };
      }
    }
    
    // Then try alias matching with word boundaries
    for (const plant of this.plants) {
      for (const alias of plant.aliases) {
        const aliasLower = alias.toLowerCase();
        if (aliasLower.length > 2 && text.includes(aliasLower)) {
          const aliasWords = aliasLower.split(/\s+/);
          
          // Check if alias appears as complete words
          const aliasMatch = aliasWords.every(aliasWord => 
            words.some(word => word === aliasWord || word.includes(aliasWord))
          );
          
          if (aliasMatch) {
            return {
              plant: plant,
              score: 0.9,
              method: 'alias_match'
            };
          }
        }
      }
    }

    // Fall back to fuzzy matching
    const fuzzyResults = this.fuse.search(inputText);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score < this.config.diagnosis.fuzzyThreshold) {
      return {
        plant: fuzzyResults[0].item,
        score: 1 - fuzzyResults[0].score, // Convert Fuse score to confidence
        method: 'fuzzy_match'
      };
    }

    // Return generic plant if no match found
    const genericPlant = this.plants.find(p => p.id === 'generic');
    return {
      plant: genericPlant,
      score: 0.1, // Low confidence for generic
      method: 'generic_fallback'
    };
  }

  extractSymptoms(inputText, plant) {
    const text = inputText.toLowerCase();
    const plantSymptoms = plant.symptoms || [];
    const genericSymptoms = this.plants.find(p => p.id === 'generic').symptoms;
    
    const matchedSymptoms = [];
    
    // Neural network-style symptom detection with fuzzy matching
    const allSymptoms = [...plantSymptoms, ...genericSymptoms];
    
    for (const symptom of allSymptoms) {
      const symptomLower = symptom.toLowerCase();
      let matchScore = 0;
      let matchType = '';
      
      // Direct exact match
      if (text.includes(symptomLower)) {
        matchScore = 1.0;
        matchType = 'exact';
      }
      // Partial word matching
      else {
        const symptomWords = symptomLower.split(' ');
        const inputWords = text.split(' ');
        
        // Check for word-level matches
        for (const symptomWord of symptomWords) {
          if (symptomWord.length > 2) {
            for (const inputWord of inputWords) {
              if (inputWord.includes(symptomWord) || symptomWord.includes(inputWord)) {
                matchScore += 0.3;
                matchType = 'partial';
              }
            }
          }
        }
        
        // Check for substring matches
        for (const symptomWord of symptomWords) {
          if (symptomWord.length > 3 && text.includes(symptomWord)) {
            matchScore += 0.5;
            matchType = 'substring';
          }
        }
        
        // Check for semantic similarity (common plant problem words)
        const semanticMatches = this.getSemanticMatches(symptomLower, text);
        matchScore += semanticMatches * 0.4;
        if (semanticMatches > 0) {
          matchType = 'semantic';
        }
      }
      
      if (matchScore > 0.2) {
        matchedSymptoms.push({
          symptom: symptom,
          source: plantSymptoms.includes(symptom) ? 'plant_specific' : 'generic',
          weight: Math.min(matchScore, 1.0),
          matchType: matchType
        });
      }
    }
    
    // Remove duplicates and sort by weight
    const uniqueSymptoms = [];
    const seenSymptoms = new Set();
    
    matchedSymptoms
      .sort((a, b) => b.weight - a.weight)
      .forEach(symptom => {
        if (!seenSymptoms.has(symptom.symptom)) {
          seenSymptoms.add(symptom.symptom);
          uniqueSymptoms.push(symptom);
        }
      });
    
    return uniqueSymptoms.slice(0, 10); // Limit to top 10 matches
  }

  getSemanticMatches(symptom, inputText) {
    const semanticGroups = {
      'color_problems': ['yellow', 'brown', 'black', 'white', 'pale', 'faded', 'discolored'],
      'texture_problems': ['crispy', 'mushy', 'soft', 'hard', 'rough', 'smooth', 'sticky'],
      'shape_problems': ['drooping', 'wilting', 'curled', 'twisted', 'deformed', 'stunted'],
      'growth_problems': ['not growing', 'slow growth', 'small', 'tiny', 'weak', 'thin'],
      'water_problems': ['dry', 'wet', 'soggy', 'thirsty', 'parched', 'waterlogged'],
      'light_problems': ['pale', 'stretching', 'leggy', 'spindly', 'weak', 'thin'],
      'pest_problems': ['holes', 'spots', 'bugs', 'webs', 'sticky', 'powdery']
    };
    
    let matches = 0;
    
    for (const [group, keywords] of Object.entries(semanticGroups)) {
      const symptomInGroup = keywords.some(keyword => symptom.includes(keyword));
      const inputInGroup = keywords.some(keyword => inputText.includes(keyword));
      
      if (symptomInGroup && inputInGroup) {
        matches += 1;
      }
    }
    
    return matches;
  }

  calculateSymptomScore(symptoms) {
    if (symptoms.length === 0) return 0;
    
    const totalWeight = symptoms.reduce((sum, s) => sum + s.weight, 0);
    const maxPossibleWeight = Math.max(symptoms.length, 3); // Normalize to max 3 symptoms
    
    return Math.min(totalWeight / maxPossibleWeight, 1.0);
  }

  generateDiagnoses(plant, symptoms, inputText) {
    const diagnoses = [];
    const inputLower = inputText.toLowerCase();
    
    // Enhanced symptom detection - look for more patterns
    const enhancedSymptoms = this.enhancedSymptomDetection(inputLower, plant);
    
    // If no symptoms detected, provide generic guidance
    if (symptoms.length === 0 && enhancedSymptoms.length === 0) {
      return [{
        cause: {
          id: 'no_symptoms',
          label: 'Unclear Symptoms'
        },
        confidence: 0.2,
        why: "I couldn't detect specific symptoms in your description. Try mentioning specific issues like 'yellow leaves', 'drooping', or 'brown spots'.",
        actions: [
          "Provide more specific details about what you're seeing",
          "Mention the plant name if you know it",
          "Describe the symptoms more clearly",
          "Include information about watering, light, and recent changes"
        ],
        eco_tip: "When in doubt, less water is usually better than more water for most plants!"
      }];
    }

    // Generate diagnoses based on causes with enhanced matching
    for (const cause of plant.causes) {
      const causeKeywords = cause.keywords || [];
      const matchedKeywords = causeKeywords.filter(keyword => 
        inputLower.includes(keyword.toLowerCase())
      );
      
      // Enhanced keyword matching with partial matches
      const partialMatches = causeKeywords.filter(keyword => {
        const keywordLower = keyword.toLowerCase();
        return keywordLower.split(' ').some(word => 
          word.length > 2 && inputLower.includes(word)
        );
      });
      
      const allMatches = [...new Set([...matchedKeywords, ...partialMatches])];
      
      if (allMatches.length > 0 || plant.id === 'generic') {
        const confidence = this.calculateEnhancedConfidence(allMatches, causeKeywords.length, symptoms, enhancedSymptoms);
        
        if (confidence >= this.config.diagnosis.minConfidenceThreshold) {
          diagnoses.push({
            cause: cause,
            confidence: confidence,
            why: this.generateEnhancedWhyExplanation(allMatches, cause, inputText, enhancedSymptoms),
            actions: plant.solutions[cause.id] || plant.solutions['watering_issues'] || [
              "Check soil moisture with your finger",
              "Ensure proper drainage",
              "Adjust watering schedule",
              "Monitor plant response"
            ],
            eco_tip: plant.eco_tip
          });
        }
      }
    }

    // If still no diagnoses, provide a generic one based on common patterns
    if (diagnoses.length === 0) {
      const genericCause = this.detectGenericCause(inputLower, plant);
      if (genericCause) {
        diagnoses.push({
          cause: genericCause,
          confidence: 0.4,
          why: this.generateGenericWhyExplanation(inputLower, genericCause),
          actions: plant.solutions[genericCause.id] || plant.solutions['watering_issues'] || [
            "Check soil moisture with your finger",
            "Ensure proper drainage",
            "Adjust watering schedule",
            "Monitor plant response"
          ],
          eco_tip: plant.eco_tip
        });
      }
    }

    // Sort by confidence and limit results
    diagnoses.sort((a, b) => b.confidence - a.confidence);
    return diagnoses.slice(0, this.config.diagnosis.maxDiagnoses);
  }

  calculateCauseConfidence(matchedKeywords, totalKeywords, symptoms) {
    const keywordScore = matchedKeywords.length / Math.max(totalKeywords, 1);
    const symptomScore = this.calculateSymptomScore(symptoms);
    
    return Math.min(
      this.config.diagnosis.plantMatchWeight * keywordScore + 
      this.config.diagnosis.symptomMatchWeight * symptomScore,
      1.0
    );
  }

  calculateEnhancedConfidence(matchedKeywords, totalKeywords, symptoms, enhancedSymptoms) {
    const keywordScore = matchedKeywords.length / Math.max(totalKeywords, 1);
    const symptomScore = this.calculateSymptomScore(symptoms);
    const enhancedScore = this.calculateSymptomScore(enhancedSymptoms);
    
    // Combine all scores with weights
    const combinedScore = Math.min(
      this.config.diagnosis.plantMatchWeight * keywordScore + 
      this.config.diagnosis.symptomMatchWeight * (symptomScore + enhancedScore) / 2,
      1.0
    );
    
    return Math.max(combinedScore, 0.3); // Minimum confidence for detected patterns
  }

  enhancedSymptomDetection(inputText, plant) {
    const enhancedSymptoms = [];
    const plantSymptoms = plant.symptoms || [];
    
    // Look for symptom patterns in the input
    for (const symptom of plantSymptoms) {
      const symptomLower = symptom.toLowerCase();
      
      // Direct match
      if (inputText.includes(symptomLower)) {
        enhancedSymptoms.push({
          symptom: symptom,
          source: 'enhanced_direct',
          weight: 1.0
        });
      }
      // Partial word match
      else if (symptomLower.split(' ').some(word => 
        word.length > 2 && inputText.includes(word)
      )) {
        enhancedSymptoms.push({
          symptom: symptom,
          source: 'enhanced_partial',
          weight: 0.7
        });
      }
    }
    
    return enhancedSymptoms;
  }

  detectGenericCause(inputText, plant) {
    // Common patterns that suggest specific causes
    const patterns = {
      'underwatering': ['dry', 'crispy', 'brown', 'wilting', 'drooping', 'thirsty'],
      'overwatering': ['yellow', 'mushy', 'wet', 'soggy', 'dropping', 'falling'],
      'light_issues': ['pale', 'stretching', 'weak', 'small', 'not growing', 'leggy'],
      'pests': ['bugs', 'holes', 'spots', 'webs', 'tiny', 'insects']
    };
    
    for (const [causeId, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(keyword => inputText.includes(keyword));
      if (matches.length > 0) {
        return {
          id: causeId,
          label: this.getCauseLabel(causeId),
          keywords: keywords
        };
      }
    }
    
    return null;
  }

  getCauseLabel(causeId) {
    const labels = {
      'underwatering': 'Underwatering & Dehydration',
      'overwatering': 'Overwatering & Root Rot',
      'light_issues': 'Light Problems & Photosynthesis Issues',
      'pests': 'Pest Infestation & Disease'
    };
    return labels[causeId] || 'Plant Health Issue';
  }

  generateEnhancedWhyExplanation(matchedKeywords, cause, inputText, enhancedSymptoms) {
    if (matchedKeywords.length === 0 && enhancedSymptoms.length === 0) {
      return `Based on general plant care patterns, this could be a ${cause.label.toLowerCase()} issue.`;
    }
    
    const keywordList = matchedKeywords.slice(0, 3).join("', '");
    const symptomList = enhancedSymptoms.slice(0, 2).map(s => s.symptom).join("', '");
    
    let explanation = `Detected keywords: '${keywordList}'`;
    if (symptomList) {
      explanation += ` and symptoms: '${symptomList}'`;
    }
    explanation += ` suggesting ${cause.label.toLowerCase()}.`;
    
    return explanation;
  }

  generateGenericWhyExplanation(inputText, cause) {
    const commonWords = ['yellow', 'brown', 'dry', 'wet', 'pale', 'small', 'weak'];
    const foundWords = commonWords.filter(word => inputText.includes(word));
    
    if (foundWords.length > 0) {
      return `Detected common symptoms like '${foundWords.join("', '")}' suggesting ${cause.label.toLowerCase()}.`;
    }
    
    return `Based on the plant type and common issues, this appears to be a ${cause.label.toLowerCase()} problem.`;
  }

  generateWhyExplanation(matchedKeywords, cause, inputText) {
    if (matchedKeywords.length === 0) {
      return `Based on general plant care patterns, this could be a ${cause.label.toLowerCase()} issue.`;
    }
    
    const keywordList = matchedKeywords.slice(0, 3).join("', '");
    return `Detected keywords: '${keywordList}' suggesting ${cause.label.toLowerCase()}.`;
  }

  diagnose(inputText) {
    if (!inputText || inputText.trim().length === 0) {
      return {
        plantName: 'generic',
        plantMatchScore: 0,
        diagnoses: [{
          cause: { id: 'empty_input', label: 'No Input Provided' },
          confidence: 0,
          why: "Please provide a description of your plant's problem.",
          actions: [
            "Describe what you're seeing (yellow leaves, drooping, etc.)",
            "Mention the plant name if you know it",
            "Include details about watering and light conditions",
            "Describe any recent changes to the plant's environment"
          ],
          eco_tip: "The more details you provide, the better I can help diagnose the issue!"
        }],
        timestamp: new Date().toISOString()
      };
    }

    // Truncate input if too long
    const truncatedInput = inputText.length > this.config.ui.maxInputLength 
      ? inputText.substring(0, this.config.ui.maxInputLength) + '...'
      : inputText;

    const plantDetection = this.detectPlant(truncatedInput);
    const symptoms = this.extractSymptoms(truncatedInput, plantDetection.plant);
    const diagnoses = this.generateDiagnoses(plantDetection.plant, symptoms, truncatedInput);

    return {
      plantName: plantDetection.plant.name,
      plantMatchScore: plantDetection.score,
      diagnoses: diagnoses,
      timestamp: new Date().toISOString(),
      originalInput: truncatedInput,
      detectedPlant: plantDetection.plant.id,
      detectionMethod: plantDetection.method
    };
  }

  // Method to add new plants (for future extensibility)
  addPlant(plantData) {
    this.plants.push(plantData);
    this.fuse = this.initializeFuzzySearch(); // Reinitialize fuzzy search
    this.savePlantData();
  }

  savePlantData() {
    try {
      const dataPath = path.join(__dirname, '../data/plants.json');
      fs.writeFileSync(dataPath, JSON.stringify(this.plants, null, 2));
    } catch (error) {
      console.error(`Failed to save plant data: ${error.message}`);
    }
  }
}

module.exports = PlantDiagnosisEngine;
