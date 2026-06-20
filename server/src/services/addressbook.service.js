const AddressBook = require('../models/addressbook.model');

class AddressBookService {
  async getAddressBook(userId) {
    try {
      const entries = await AddressBook.find({ userId }).sort({ createdAt: -1 });
      return entries;
    } catch (error) {
      console.error('Error fetching address book:', error);
      throw error;
    }
  }

  async addAddress(userId, addressData) {
    try {
      // Check if address already exists for this user
      const existing = await AddressBook.findOne({
        userId,
        address: addressData.address
      });

      if (existing) {
        throw new Error('Address already exists in your address book');
      }

      const entry = new AddressBook({
        userId,
        ...addressData
      });

      await entry.save();
      return entry;
    } catch (error) {
      console.error('Error adding address:', error);
      throw error;
    }
  }

  async updateAddress(userId, addressId, updateData) {
    try {
      const entry = await AddressBook.findOneAndUpdate(
        { _id: addressId, userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!entry) {
        throw new Error('Address not found');
      }

      return entry;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }

  async deleteAddress(userId, addressId) {
    try {
      const result = await AddressBook.findOneAndDelete({
        _id: addressId,
        userId
      });

      if (!result) {
        throw new Error('Address not found');
      }

      return result;
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  }
}

module.exports = new AddressBookService();
