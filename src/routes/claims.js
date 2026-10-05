const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const claimsController = require('../controllers/claims');

const router = express.Router();

// T3.5 Claim creation
router.post('/', requireAuth, claimsController.createClaim);

// T3.6, T3.7 Approval / Rejection
router.post('/:id/approve', requireAuth, claimsController.approveClaim);
router.post('/:id/reject', requireAuth, claimsController.rejectClaim);

// T3.8 Handover
router.post('/:id/handover', requireAuth, claimsController.completeHandover);

// T3.11 Timeline
router.get('/timeline/:id', requireAuth, claimsController.getTimeline);

module.exports = router;
