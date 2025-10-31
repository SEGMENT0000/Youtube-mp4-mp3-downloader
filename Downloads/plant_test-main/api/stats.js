const { getLogger } = require('./_shared');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'method_not_allowed',
      message: 'Use GET to retrieve statistics.'
    });
    return;
  }

  try {
    const logger = getLogger();
    const stats = logger.getLogStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve statistics.'
    });
  }
};

