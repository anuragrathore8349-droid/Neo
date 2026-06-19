const addressBookService = require('../../services/addressbook.service');

class AddressBookController {
  async getAddressBook(req, res, next) {
    try {
      const entries = await addressBookService.getAddressBook(req.user.userId);
      res.json({
        status: 'success',
        data: entries
      });
    } catch (error) {
      next(error);
    }
  }

  async addAddress(req, res, next) {
    try {
      const entry = await addressBookService.addAddress(
        req.user.userId,
        req.validatedData.body
      );
      res.status(201).json({
        status: 'success',
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAddress(req, res, next) {
    try {
      const entry = await addressBookService.updateAddress(
        req.user.userId,
        req.validatedData.params.id,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      await addressBookService.deleteAddress(
        req.user.userId,
        req.validatedData.params.id
      );
      res.json({
        status: 'success',
        message: 'Address removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AddressBookController();
