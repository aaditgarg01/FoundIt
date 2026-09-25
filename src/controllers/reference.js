const referenceService = require('../services/reference');

async function getAll(req, res, next) {
  try {
    const data = await referenceService.getCache();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function invalidate(req, res, next) {
  try {
    await referenceService.reloadCache();
    res.json({ message: 'Cache reloaded successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  invalidate
};
