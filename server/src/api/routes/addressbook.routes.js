const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const addressBookController = require('../controllers/addressbook.controller');
const { addressBookSchemas } = require('../validators/addressbook.validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all address book entries
router.get('/',
  addressBookController.getAddressBook
);

// Add new address
router.post('/',
  validateRequest(addressBookSchemas.addAddress),
  addressBookController.addAddress
);

// Update address
router.patch('/:id',
  validateRequest(addressBookSchemas.updateAddress),
  addressBookController.updateAddress
);

// Delete address
router.delete('/:id',
  validateRequest(addressBookSchemas.deleteAddress),
  addressBookController.deleteAddress
);

module.exports = router;
