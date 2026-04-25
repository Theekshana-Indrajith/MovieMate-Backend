const mongoose = require('mongoose');

const seatRowSchema = new mongoose.Schema({
    rowCode: {
        type: String,
        required: [true, 'Please add a row code e.g. A, B, V'],
        unique: true,
        trim: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['Normal', 'VIP'],
        default: 'Normal'
    },
    seatsCount: {
        type: Number,
        required: [true, 'Please add number of seats'],
        min: [1, 'At least 1 seat required'],
        default: 6
    },
    extraPrice: {
        type: Number,
        required: [true, 'Please add extra price modifier'],
        min: [0, 'Extra price cannot be negative'],
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Maintenance'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('SeatRow', seatRowSchema);
