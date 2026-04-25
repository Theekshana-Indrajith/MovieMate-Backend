const mongoose = require('mongoose');

const snackSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a snack name'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please provide a description']
    },
    price: {
        type: Number,
        required: [true, 'Please provide a price'],
        min: [0, 'Price cannot be negative']
    },
    image: {
        type: String,
        default: 'default-snack.jpg'
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Snack', snackSchema);
