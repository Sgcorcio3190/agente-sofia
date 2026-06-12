// Runs the COMPRASAL agent once, then exits.
// Use this for Railway cron jobs.

const { runOnce } = require('./index');

runOnce()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FALLO CRITICO:', err.message);
    process.exit(1);
  });
