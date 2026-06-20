const mongoose = require('mongoose');

const addressBookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  network: {
    type: String,
    required: true,
    default: 'Ethereum'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
addressBookSchema.index({ userId: 1, address: 1 });
addressBookSchema.index({ userId: 1 });

const AddressBook = mongoose.model('AddressBook', addressBookSchema);

module.exports = AddressBook;
