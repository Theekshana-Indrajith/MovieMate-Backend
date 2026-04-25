const express = require('express');
const { getBookings, createBooking, cancelBooking, getAdminStats, verifyBooking } = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

const router = express.Router();

router.use(protect);

router.get('/admin/stats', authorize('admin'), getAdminStats);

router
    .route('/')
    .get(getBookings)
    .post(upload.single('paymentSlip'), createBooking);

router.route('/:id/cancel').put(cancelBooking);
router.route('/:id/verify').put(authorize('admin'), verifyBooking);

module.exports = router;
