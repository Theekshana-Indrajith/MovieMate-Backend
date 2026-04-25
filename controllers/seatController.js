const SeatRow = require('../models/Seat');
const SeatCategory = require('../models/SeatCategory');

// @desc    Get all seat rows
// @route   GET /api/seats
// @access  Public
exports.getSeatRows = async (req, res, next) => {
    try {
        const rows = await SeatRow.find().sort({ rowCode: -1 }); // Basic sort
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create a new seat row
// @route   POST /api/seats
// @access  Private (Admin)
exports.createSeatRow = async (req, res, next) => {
    try {
        const row = await SeatRow.create(req.body);
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, error: 'Row code already exists' });
        }
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update a seat row
// @route   PUT /api/seats/:id
// @access  Private (Admin)
exports.updateSeatRow = async (req, res, next) => {
    try {
        const row = await SeatRow.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!row) return res.status(404).json({ success: false, error: 'Row not found' });
        res.status(200).json({ success: true, data: row });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, error: 'Row code already exists' });
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete a seat row
// @route   DELETE /api/seats/:id
// @access  Private (Admin)
exports.deleteSeatRow = async (req, res, next) => {
    try {
        const row = await SeatRow.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Row not found' });
        
        // Validation: Check if there are confirmed future bookings for this row
        const Showtime = require('../models/Showtime');
        const Booking = require('../models/Booking');
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Find all future showtimes
        const futureShowtimes = await Showtime.find({ date: { $gte: today } });
        const futureShowtimeIds = futureShowtimes.map(st => st._id);
        
        // Find bookings for those showtimes
        const confirmedBookings = await Booking.find({ 
            showtime: { $in: futureShowtimeIds }, 
            status: 'Confirmed' 
        });
        
        // Check if any booking has a seat from this row (e.g., "A-1")
        const rowPrefix = `${row.rowCode}-`;
        const hasActiveBookings = confirmedBookings.some(b => 
            b.seats.some(s => s.startsWith(rowPrefix))
        );

        if (hasActiveBookings) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete Row ${row.rowCode}. There are confirmed bookings for future showtimes in this row.` 
            });
        }

        await row.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get seat category settings (Photos for Normal/VIP)
// @route   GET /api/seats/categories
// @access  Public
exports.getSeatCategories = async (req, res) => {
    try {
        let categories = await SeatCategory.find();
        
        // Auto-seed if empty
        if (categories.length === 0) {
            categories = await SeatCategory.insertMany([
                { type: 'Normal', image: 'default-seat.jpg' },
                { type: 'VIP', image: 'default-seat-vip.jpg' }
            ]);
        }
        
        res.status(200).json({ success: true, data: categories });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update seat category photo
// @route   PUT /api/seats/categories/:type
// @access  Private (Admin)
exports.updateCategoryPhoto = async (req, res) => {
    try {
        const { type } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Please upload an image' });
        }

        const category = await SeatCategory.findOneAndUpdate(
            { type },
            { image: req.file.filename },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, data: category });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
