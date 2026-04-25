const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    snack: {
        type: mongoose.Schema.ObjectId,
        ref: 'Snack',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    } 
});

const snackOrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    booking: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        required: true
    },
    items: {
        type: [orderItemSchema],
        validate: [v => Array.isArray(v) && v.length > 0, 'At least one snack must be ordered']
    },
    totalAmount: {
        type: Number,
        required: true,
        min: [1, 'Total amount must be greater than 0']
    },
    deliveryMethod: {
        type: String,
        enum: ['In-Seat', 'Pickup'],
        required: true
    },
    seatNumber: {
        type: String,
        trim: true,
        uppercase: true,
        required: function() {
            return this.deliveryMethod === 'In-Seat';
        }
    },
    status: {
        type: String,
        enum: ['Pending', 'Preparing', 'Ready', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    proofImage: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SnackOrder', snackOrderSchema);
