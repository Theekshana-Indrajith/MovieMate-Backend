const mongoose = require('mongoose');

const showtimeSchema = new mongoose.Schema({
    movie: {
        type: mongoose.Schema.ObjectId,
        ref: 'Movie',
        required: [true, 'Please select a movie for this showtime']
    },
    date: {
        type: Date,
        required: [true, 'Please add a date for the showtime']
    },
    times: {
        type: [String], // Array of strings (e.g., ['10:30 AM', '02:30 PM', '06:30 PM'])
        required: [true, 'Please add at least one showtime']
    },
    ticketPrice: {
        type: Number,
        required: [true, 'Please add ticket price'],
        min: [0, 'Ticket price cannot be negative']
    },
    theater: {
        type: String,
        default: 'Main Hall'
    },
    image: {
        type: String, 
        default: 'default-theater.jpg'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Showtime', showtimeSchema);
