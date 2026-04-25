const express = require('express');
const { getSeatRows, createSeatRow, updateSeatRow, deleteSeatRow, getSeatCategories, updateCategoryPhoto } = require('../controllers/seatController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

const router = express.Router();

router.route('/')
    .get(getSeatRows)
    .post(protect, authorize('admin'), createSeatRow);

router.route('/categories')
    .get(getSeatCategories);

router.route('/categories/:type')
    .put(protect, authorize('admin'), upload.single('seatImage'), updateCategoryPhoto);

router.route('/:id')
    .put(protect, authorize('admin'), updateSeatRow)
    .delete(protect, authorize('admin'), deleteSeatRow);

module.exports = router;
