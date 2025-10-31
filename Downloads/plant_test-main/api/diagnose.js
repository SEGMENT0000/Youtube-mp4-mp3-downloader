const { getEngine, getLogger } = require('./_shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'method_not_allowed',
      message: 'Use POST to analyze plant data.'
    });
    return;
  }

  let payload = req.body;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      res.status(400).json({
        error: 'invalid_json',
        message: 'Unable to parse request body as JSON.'
      });
      return;
    }
  }

  const text = payload?.text;

  if (!text || typeof text !== 'string') {
    res.status(400).json({
      error: 'invalid_input',
      message: 'Provide a text field describing your plant condition.'
    });
    return;
  }

  try {
    const engine = getEngine();
    const logger = getLogger();

    const result = engine.diagnose(text);
    logger.logInteraction(result);

    res.status(200).json(result);
  } catch (error) {
    console.error('Diagnosis error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to process diagnosis request.'
    });
  }
};

