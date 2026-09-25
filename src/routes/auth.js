const express = require('express');
const authController = require('../controllers/auth');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', authController.refresh);

// Protected route for testing
router.get('/me', requireAuth, authController.me);

module.exports = router;
