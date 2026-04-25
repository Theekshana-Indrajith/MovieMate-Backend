const mongoose = require('mongoose');

const seatCategorySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Normal', 'VIP'],
        required: true,
        unique: true
    },
    image: {
        type: String,
        default: 'default-seat.jpg'
    },
    description: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('SeatCategory', seatCategorySchema);
