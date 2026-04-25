const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    showtime: {
        type: mongoose.Schema.ObjectId,
        ref: 'Showtime',
        required: true
    },
    time: {
        type: String,
        required: true
    },
    seats: [{
        type: String, // Just storing seat numbers for simplicity (e.g., 'A1', 'A2')
        required: true
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled'],
        default: 'Pending'
    },
    paymentSlip: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
