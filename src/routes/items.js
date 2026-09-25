const express = require('express');
const itemsController = require('../controllers/items');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/lost', requireAuth, itemsController.createLost);
router.post('/found', requireAuth, itemsController.createFound);

router.get('/lost', itemsController.browseLost);
router.get('/found', itemsController.browseFound);

router.get('/lost/:id', itemsController.getLost);
router.get('/found/:id', itemsController.getFound);

module.exports = router;
