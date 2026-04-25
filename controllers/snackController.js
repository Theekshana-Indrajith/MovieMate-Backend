const Snack = require('../models/Snack');
const SnackOrder = require('../models/SnackOrder');
const fs = require('fs');

// @desc    Get all active snacks
// @route   GET /api/snacks
exports.getSnacks = async (req, res) => {
    try {
        const snacks = await Snack.find();
        res.status(200).json({ success: true, count: snacks.length, data: snacks });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Create new snack
// @route   POST /api/snacks
exports.createSnack = async (req, res) => {
    try {
        if (req.file) {
            req.body.image = req.file.filename;
        }

        const snack = await Snack.create(req.body);
        res.status(201).json({ success: true, data: snack });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Update a snack
// @route   PUT /api/snacks/:id
exports.updateSnack = async (req, res) => {
    try {
        let snack = await Snack.findById(req.params.id);
        if (!snack) {
            return res.status(404).json({ success: false, error: 'Snack not found' });
        }

        if (req.file) {
            req.body.image = req.file.filename;
        }

        snack = await Snack.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: snack });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Delete a snack
// @route   DELETE /api/snacks/:id
exports.deleteSnack = async (req, res) => {
    try {
        const snack = await Snack.findByIdAndDelete(req.params.id);
        if (!snack) {
            return res.status(404).json({ success: false, error: 'Snack not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// ============================
// SNACK ORDER METHODS
// ============================

// @desc    Create snack order
// @route   POST /api/snacks/orders
// @access  Private (User)
exports.createOrder = async (req, res) => {
    try {
        const { booking: bookingId } = req.body;
        const Booking = require('../models/Booking');
        const Showtime = require('../models/Showtime');

        // 1. Check if booking exists and belongs to the user
        const booking = await Booking.findById(bookingId).populate('showtime');
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        if (booking.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, error: 'Not authorized to order for this booking' });
        }

        // 2. MUST be a confirmed booking
        if (booking.status !== 'Confirmed') {
            return res.status(400).json({ success: false, error: 'You can only order snacks for confirmed/paid bookings.' });
        }

        // 3. MUST be a future showtime
        const today = new Date();
        const showDate = new Date(booking.showtime.date);
        
        // Add showtime time to showDate for accurate comparison
        if (booking.time) {
            const timeParts = booking.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeParts) {
                let hours = parseInt(timeParts[1], 10);
                const minutes = parseInt(timeParts[2], 10);
                const ampm = timeParts[3].toUpperCase();
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                showDate.setHours(hours, minutes, 0, 0);
            }
        }

        if (showDate < today) {
            return res.status(400).json({ success: false, error: 'Movies that are already finished cannot have new snack orders.' });
        }

        req.body.user = req.user.id;
        const order = await SnackOrder.create(req.body);
        res.status(201).json({ success: true, data: order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get user's snack orders
// @route   GET /api/snacks/orders/my
// @access  Private (User)
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await SnackOrder.find({ user: req.user.id })
            .populate('items.snack', 'name image price')
            .populate({
                path: 'booking',
                populate: {
                    path: 'showtime',
                    populate: { path: 'movie', select: 'title' }
                }
            })
            .sort('-createdAt');
            
        res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get all snack orders
// @route   GET /api/snacks/orders
// @access  Private (Admin)
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await SnackOrder.find()
            .populate('user', 'name email')
            .populate('items.snack', 'name price')
            .populate({
                path: 'booking',
                populate: {
                    path: 'showtime',
                    select: 'time date',
                    populate: { path: 'movie', select: 'title' }
                }
            })
            .sort('-createdAt');
            
        res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Update order status
// @route   PUT /api/snacks/orders/:id/status
// @access  Private (Admin)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Preparing', 'Ready', 'Delivered'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const updateData = { status };
        if (req.file) {
            updateData.proofImage = req.file.filename;
        }
        
        const order = await SnackOrder.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
// @desc    Cancel snack order
// @route   PUT /api/snacks/orders/:id/cancel
// @access  Private (User)
exports.cancelOrder = async (req, res) => {
    try {
        const order = await SnackOrder.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Only allow cancellation if order is Pending
        if (order.status !== 'Pending') {
            return res.status(400).json({ 
                success: false, 
                error: `Order cannot be cancelled. Current status is ${order.status}` 
            });
        }

        // Authorization check
        if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, error: 'Not authorized to cancel this order' });
        }

        order.status = 'Cancelled';
        await order.save();

        res.status(200).json({ 
            success: true, 
            message: 'Order cancelled successfully. Your refund will be processed in 3-4 working days.',
            data: order 
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
