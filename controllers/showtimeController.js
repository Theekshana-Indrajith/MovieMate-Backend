const Showtime = require('../models/Showtime');

// @desc    Get all showtimes (optionally for a specific movie)
// @route   GET /api/showtimes
// @route   GET /api/movies/:movieId/showtimes
// @access  Public
exports.getShowtimes = async (req, res, next) => {
    try {
        let query;
        if (req.params.movieId) {
            query = Showtime.find({ movie: req.params.movieId }).populate('movie', 'title genre duration poster');
        } else {
            query = Showtime.find().populate('movie', 'title genre duration poster');
        }

        const showtimes = await query;
        res.status(200).json({ success: true, count: showtimes.length, data: showtimes });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// Helper function to check overlap
const checkOverlap = async (checkingDate, checkingTimes, excludeId = null) => {
    // We normalize to ignore time parts in the DB check
    const d = new Date(checkingDate);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    let query = { date: { $gte: startOfDay, $lte: endOfDay } };
    if (excludeId) query._id = { $ne: excludeId };

    const existingShowtimes = await Showtime.find(query);

    for (let st of existingShowtimes) {
        for (let t of checkingTimes) {
            if (st.times.includes(t)) {
                return { hasOverlap: true, time: t, date: d.toDateString() };
            }
        }
    }
    return { hasOverlap: false };
};

// @desc    Create new showtime (Supports date ranges)
// @route   POST /api/showtimes
// @access  Private (Admin)
exports.createShowtime = async (req, res, next) => {
    try {
        if (req.file) {
            req.body.image = req.file.filename;
        }

        const { movie, date, endDate, times, ticketPrice, image } = req.body;

        if (endDate) {
            let currentDate = new Date(date);
            const stopDate = new Date(endDate);
            let showtimesToCreate = [];

            // 1. Verify all dates have no overlap first
            let tempDate = new Date(date);
            while (tempDate <= stopDate) {
                const overlap = await checkOverlap(tempDate, times);
                if (overlap.hasOverlap) {
                    return res.status(400).json({ success: false, error: `Time slot ${overlap.time} is already booked for another movie on ${overlap.date}` });
                }
                tempDate.setDate(tempDate.getDate() + 1);
            }

            // 2. If all completely safe, build payload
            while (currentDate <= stopDate) {
                showtimesToCreate.push({
                    movie,
                    date: new Date(currentDate),
                    times,
                    ticketPrice,
                    image
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            const showtimes = await Showtime.insertMany(showtimesToCreate);
            return res.status(201).json({ success: true, count: showtimes.length, data: showtimes });
        } else {
            // Check overlap for single creation
            const overlap = await checkOverlap(date, times);
            if (overlap.hasOverlap) {
                return res.status(400).json({ success: false, error: `Time slot ${overlap.time} is already booked for another movie on ${overlap.date}` });
            }

            const showtime = await Showtime.create(req.body);
            return res.status(201).json({ success: true, data: showtime });
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update showtime
// @route   PUT /api/showtimes/:id
// @access  Private (Admin)
exports.updateShowtime = async (req, res, next) => {
    try {
        if (req.file) {
            req.body.image = req.file.filename;
        }

        const { endDate, ...updateData } = req.body;
        const currentShowtime = await Showtime.findById(req.params.id);
        
        if (!currentShowtime) return res.status(404).json({ success: false, error: 'Showtime not found' });

        const dateToCheck = updateData.date || currentShowtime.date;
        const timesToCheck = updateData.times || currentShowtime.times;

        // 1. Check overlap for the primary update date
        const overlap = await checkOverlap(dateToCheck, timesToCheck, req.params.id);
        if (overlap.hasOverlap) {
            return res.status(400).json({ success: false, error: `Time slot ${overlap.time} is already booked for another movie on ${overlap.date}` });
        }

        // Generate extra showtimes if admin provided an end date to extend from this edit
        if (endDate) {
            let currentDate = new Date(dateToCheck);
            currentDate.setDate(currentDate.getDate() + 1); // Start from the day after
            const stopDate = new Date(endDate);
            let showtimesToCreate = [];

            // 2. Validate all extension dates
            let tempDate = new Date(currentDate);
            while (tempDate <= stopDate) {
                const extendOverlap = await checkOverlap(tempDate, timesToCheck);
                if (extendOverlap.hasOverlap) {
                    return res.status(400).json({ success: false, error: `Extended time slot ${extendOverlap.time} is already booked on ${extendOverlap.date}. Update cancelled.` });
                }
                tempDate.setDate(tempDate.getDate() + 1);
            }

            // If completely safe, build payload
            while (currentDate <= stopDate) {
                showtimesToCreate.push({
                    movie: updateData.movie || currentShowtime.movie,
                    date: new Date(currentDate),
                    times: timesToCheck,
                    ticketPrice: updateData.ticketPrice || currentShowtime.ticketPrice,
                    image: updateData.image || currentShowtime.image
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (showtimesToCreate.length > 0) {
                await Showtime.insertMany(showtimesToCreate);
            }
        }

        // Apply primary update
        const updatedShowtime = await Showtime.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: updatedShowtime });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete showtime
// @route   DELETE /api/showtimes/:id
// @access  Private (Admin)
exports.deleteShowtime = async (req, res, next) => {
    try {
        const showtime = await Showtime.findById(req.params.id);
        if (!showtime) return res.status(404).json({ success: false, error: 'Showtime not found' });

        // Check if the showtime is in the future
        const today = new Date();
        today.setHours(0,0,0,0);
        const isFutureShow = new Date(showtime.date) >= today;

        const Booking = require('../models/Booking');
        const activeBookings = await Booking.find({ showtime: req.params.id, status: 'Confirmed' });
        
        // Block ONLY if it is a future showtime with confirmed bookings
        if (isFutureShow && activeBookings.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete future showtime. Users have already bought ${activeBookings.length} tickets for this time.` 
            });
        }

        // Safe to delete - delete cancelled/old bookings if any, then showtime
        await Booking.deleteMany({ showtime: req.params.id });
        await showtime.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get booked seats for a specific showtime
// @route   GET /api/showtimes/:id/booked-seats
// @access  Public
exports.getBookedSeats = async (req, res, next) => {
    try {
        const Booking = require('../models/Booking'); 
        const bookings = await Booking.find({ showtime: req.params.id, status: 'Confirmed' });
        
        let bookedSeats = [];
        bookings.forEach(booking => {
            bookedSeats = bookedSeats.concat(booking.seats);
        });

        res.status(200).json({ success: true, count: bookedSeats.length, data: bookedSeats });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

