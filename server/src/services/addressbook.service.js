const AddressBook = require('../models/addressbook.model');

class AddressBookService {
  async getAddressBook(userId, options = {}) {
    try {
      const { limit = 50, skip = 0 } = options;
      const query = { userId };
      
      const total = await AddressBook.countDocuments(query);
      const entries = await AddressBook.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      return { items: entries, total };
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
