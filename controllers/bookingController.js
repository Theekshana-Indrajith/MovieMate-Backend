const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');

// @desc    Get user's bookings (or all if admin)
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        let query;

        // If admin, can see all bookings. If user, only their own.
        if (req.user.role === 'admin') {
            query = Booking.find().populate('user', 'name email').populate({
                path: 'showtime',
                populate: { path: 'movie', select: 'title poster duration' }
            });
        } else {
            query = Booking.find({ user: req.user.id }).populate({
                path: 'showtime',
                populate: { path: 'movie', select: 'title poster duration' }
            });
        }

        const bookings = await query;
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (User)
exports.createBooking = async (req, res, next) => {
    try {
        console.log('--- NEW BOOKING REQUEST ---');
        console.log('Body:', req.body);
        console.log('File:', req.file);

        let { showtime, time, seats, totalAmount } = req.body;

        if (!time) {
            return res.status(400).json({ success: false, error: 'Time slot is required' });
        }

        // Robust Seat Parsing
        let parsedSeats = [];
        if (typeof seats === 'string') {
            try {
                parsedSeats = JSON.parse(seats);
            } catch (e) {
                parsedSeats = seats.split(',').map(s => s.trim());
            }
        } else if (Array.isArray(seats)) {
            parsedSeats = seats;
        } else {
            parsedSeats = [seats]; // Single seat case
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Payment slip file is missing in the request' });
        }

        const paymentSlip = req.file.filename;

        // VALIDATION: Prevent booking for past showtimes
        const showtimeObj = await Showtime.findById(showtime);
        if (!showtimeObj) return res.status(404).json({ success: false, error: 'Showtime not found' });

        const showDate = new Date(showtimeObj.date);
        let showHours = 8, showMinutes = 0;
        const timeParts = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
            showHours = parseInt(timeParts[1], 10);
            showMinutes = parseInt(timeParts[2], 10);
            const ampm = timeParts[3].toUpperCase();
            if (ampm === 'PM' && showHours < 12) showHours += 12;
            if (ampm === 'AM' && showHours === 12) showHours = 0;
        }
        showDate.setHours(showHours, showMinutes, 0, 0);

        if (showDate < new Date()) {
            return res.status(400).json({ success: false, error: 'This showtime has already passed and cannot be booked.' });
        }

        // DOUBLE-BOOKING PREVENTION
        const existingBookings = await Booking.find({ 
            showtime: showtime, 
            time: time, 
            status: { $in: ['Confirmed', 'Pending'] } 
        });
        
        let takenSeats = [];
        existingBookings.forEach(b => {
            takenSeats = takenSeats.concat(b.seats);
        });

        for (let seat of parsedSeats) {
            if (takenSeats.includes(seat)) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Seat ${seat} is already held or booked. Please try again.` 
                });
            }
        }

        // Create the record
        const booking = await Booking.create({
            user: req.user.id,
            showtime,
            time,
            seats: parsedSeats,
            totalAmount: Number(totalAmount),
            paymentSlip,
            status: 'Pending'
        });

        res.status(201).json({ success: true, data: booking });
    } catch (err) {
        console.error('Booking Creation Error DETAILED:', err);
        // If it's a Mongoose validation error, get more details
        const message = err.name === 'ValidationError' 
            ? Object.values(err.errors).map(val => val.message).join(', ')
            : err.message;

        res.status(400).json({ success: false, error: message });
    }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (User/Admin)
exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('showtime');
        
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, error: 'Not authorized to cancel this booking' });
        }

        if (booking.status === 'Cancelled') {
            return res.status(400).json({ success: false, error: 'Booking is already cancelled' });
        }

        // Logic: 4 hours before the actual showtime starts
        const showDate = new Date(booking.showtime.date);
        let hours = 8; // fallback
        let minutes = 0;

        if (booking.time) {
            // Parse "02:30 PM", "10:00 AM" etc.
            const timeParts = booking.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeParts) {
                hours = parseInt(timeParts[1], 10);
                minutes = parseInt(timeParts[2], 10);
                const ampm = timeParts[3].toUpperCase();
                
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
            }
        }

        showDate.setHours(hours, minutes, 0, 0);

        // Subtract 4 hours to get the deadline
        const cancelDeadline = new Date(showDate.getTime() - (4 * 60 * 60 * 1000));
        const now = new Date();

        if (now > cancelDeadline && req.user.role !== 'admin') {
            return res.status(400).json({ 
                success: false, 
                error: `Cancellations are only allowed 4 hours before the showtime starts (Deadline was ${cancelDeadline.toLocaleTimeString()}).` 
            });
        }

        booking.status = 'Cancelled';
        await booking.save();

        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Verify/Confirm a booking
// @route   PUT /api/bookings/:id/verify
// @access  Private (Admin)
exports.verifyBooking = async (req, res) => {
    try {
        const { status } = req.body; // 'Confirmed' or 'Cancelled' (Rejected)

        if (!['Confirmed', 'Cancelled'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status update' });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        booking.status = status;
        await booking.save();

        res.status(200).json({ 
            success: true, 
            message: `Booking has been ${status === 'Confirmed' ? 'confirmed' : 'rejected'}.`,
            data: booking 
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get Admin Dashboard Stats
// @route   GET /api/bookings/admin/stats
// @access  Private (Admin)
exports.getAdminStats = async (req, res) => {
    try {
        // Only count revenue from confirmed bookings
        const bookings = await Booking.find({ status: 'Confirmed' }).populate({
            path: 'showtime',
            populate: { path: 'movie', select: 'title' }
        });

        let totalRevenue = 0;
        let todayRevenue = 0;
        const today = new Date().toISOString().split('T')[0];
        const moviesRev = {};

        bookings.forEach(b => {
            totalRevenue += b.totalAmount;
            
            // Check if booking was created today
            if (new Date(b.createdAt).toISOString().split('T')[0] === today) {
                todayRevenue += b.totalAmount;
            }

            // Movie revenue logic
            const movieTitle = b.showtime?.movie?.title || 'Unknown';
            moviesRev[movieTitle] = (moviesRev[movieTitle] || 0) + b.totalAmount;
        });

        // Convert moviesRev to array and sort
        const topMovies = Object.keys(moviesRev).map(title => ({
            title,
            revenue: moviesRev[title]
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Also get pending booking count
        const pendingCount = await Booking.countDocuments({ status: 'Pending' });

        res.status(200).json({
            success: true,
            data: {
                totalRevenue,
                todayRevenue,
                totalBookings: bookings.length,
                pendingBookings: pendingCount,
                topMovies
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
