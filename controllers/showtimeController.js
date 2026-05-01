const Showtime = require('../models/Showtime');

// @desc    Get all showtimes (optionally for a specific movie)
// @route   GET /api/showtimes
// @route   GET /api/movies/:movieId/showtimes
// @access  Public
exports.getShowtimes = async (req, res, next) => {
    try {
        let query;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (req.params.movieId) {
            query = Showtime.find({ 
                movie: req.params.movieId,
                date: { $gte: startOfToday }
            }).populate('movie', 'title genre duration poster');
        } else {
            query = Showtime.find({
                date: { $gte: startOfToday }
            }).populate('movie', 'title genre duration poster');
        }

        let showtimes = await query;

        // Filter out past times for today's shows
        const filteredShowtimes = showtimes.map(st => {
            const stDate = new Date(st.date);
            const isToday = stDate.toDateString() === now.toDateString();

            if (isToday) {
                // Filter the 'times' array
                const validTimes = st.times.filter(t => {
                    const showDateTime = parseTimeString(t, st.date);
                    return showDateTime > now;
                });
                
                if (validTimes.length === 0) return null;
                
                // Return a copy with filtered times
                const stObj = st.toObject();
                stObj.times = validTimes;
                return stObj;
            }
            return st;
        }).filter(st => st !== null);

        res.status(200).json({ success: true, count: filteredShowtimes.length, data: filteredShowtimes });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// Helper function to parse '10:30 AM' or '14:30' style strings
const parseTimeString = (timeStr, baseDate) => {
    const match = timeStr.match(/(\d+)[:.](\d+)\s*(AM|PM)?/i);
    if (!match) throw new Error(`Invalid time format: ${timeStr}. Please use format like '10:30 AM'`);
    
    let [ , hours, minutes, modifier] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);

    if (modifier) {
        if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
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

        const rawTimes = req.body.times || req.body['times[]'];
        const times = Array.isArray(rawTimes) ? rawTimes : (typeof rawTimes === 'string' ? [rawTimes] : []);
        
        if (times.length === 0) {
            return res.status(400).json({ success: false, error: 'Showtimes are required' });
        }
        
        req.body.times = times; // FIX: Mongoose needs this in req.body

        const { movie, date, endDate, ticketPrice, image } = req.body;
        const now = new Date();
        const tenHoursFromNow = new Date(now.getTime() + 10 * 60 * 60 * 1000);

        const validateShowTime = (d, tList) => {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const checkDate = new Date(d);
            
            if (checkDate < startOfToday) {
                throw new Error(`Cannot add showtime for a past date: ${checkDate.toDateString()}`);
            }

            for (let t of tList) {
                const showDateTime = parseTimeString(t, d);
                if (showDateTime < tenHoursFromNow) {
                    throw new Error(`Showtime (${t} on ${checkDate.toDateString()}) must be scheduled at least 10 hours in advance.`);
                }
            }
        };

        if (endDate) {
            let currentDate = new Date(date);
            const stopDate = new Date(endDate);
            let showtimesToCreate = [];

            // 1. Verify all dates have no overlap and follow 10-hour rule
            let tempDate = new Date(date);
            while (tempDate <= stopDate) {
                // Validation: Past date and 10-hour rule
                // validateShowTime(tempDate, times);

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
            // Validation for single creation
            // validateShowTime(date, times);

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

        const rawTimes = req.body.times || req.body['times[]'];
        if (rawTimes) {
            req.body.times = Array.isArray(rawTimes) ? rawTimes : (typeof rawTimes === 'string' ? [rawTimes] : []);
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

