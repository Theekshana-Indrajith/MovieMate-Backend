const express = require('express');
const {
    getShowtimes,
    createShowtime,
    updateShowtime,
    deleteShowtime,
    getBookedSeats
} = require('../controllers/showtimeController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// Merge parameters so we can access movieId from movieRoutes
const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/:id/booked-seats', getBookedSeats);

router
    .route('/')
    .get(getShowtimes)
    .post(authorize('admin'), upload.single('showtimeImage'), createShowtime);

router
    .route('/:id')
    .put(authorize('admin'), upload.single('showtimeImage'), updateShowtime)
    .delete(authorize('admin'), deleteShowtime);

module.exports = router;
