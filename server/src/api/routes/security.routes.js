const express             = require('express');
const { authMiddleware }  = require('../middlewares/auth.middleware');
const securityController  = require('../controllers/security.controller');

const router = express.Router();
router.use(authMiddleware);

router.get('/status',         securityController.getSecurityStatus);
router.get('/devices',        securityController.getDevices);
router.delete('/devices/:id', securityController.removeDevice);
router.get('/activity',       securityController.getActivityLog);    // ← ADD
router.post('/2fa/setup',     securityController.setup2FA);
router.post('/2fa/verify',    securityController.verify2FA);
router.post('/2fa/disable',   securityController.disable2FA);

module.exports = router;
