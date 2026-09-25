const express = require('express');
const referenceController = require('../controllers/reference');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', referenceController.getAll);
router.post('/invalidate', requireAuth, requireRole(['ADMIN', 'STAFF']), referenceController.invalidate);

module.exports = router;
