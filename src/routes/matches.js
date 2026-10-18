const express = require("express");
const matchesController = require("../controllers/matches");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/lost/:lost_id", requireAuth, matchesController.getMatchesForLost);
router.get("/:match_id", requireAuth, matchesController.getMatchDetail);
router.post("/:match_id/dismiss", requireAuth, matchesController.dismissMatch);

router.post("/:match_id/restore", requireAuth, matchesController.undoDismiss);
module.exports = router;
