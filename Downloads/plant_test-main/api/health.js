module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'method_not_allowed',
      message: 'Use GET to check health status.'
    });
    return;
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'node'
  });
};

