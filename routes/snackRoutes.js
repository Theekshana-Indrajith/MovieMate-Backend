const express = require('express');
const router = express.Router();
const {
    getSnacks,
    createSnack,
    updateSnack,
    deleteSnack,
    uploadSnackImage,
    createOrder,
    getMyOrders,
    getAllOrders,
    updateOrderStatus,
    cancelOrder
} = require('../controllers/snackController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// Snack CRUD (Public/Private split)
router.route('/')
    .get(getSnacks)
    .post(protect, authorize('admin'), upload.single('image'), createSnack);

router.route('/:id')
    .put(protect, authorize('admin'), upload.single('image'), updateSnack)
    .delete(protect, authorize('admin'), deleteSnack);

// Snack Orders
router.route('/orders')
    .get(protect, authorize('admin'), getAllOrders)
    .post(protect, createOrder);

router.get('/orders/my', protect, getMyOrders);

router.put('/orders/:id/status', protect, authorize('admin'), upload.single('paymentSlip'), updateOrderStatus);

router.put('/orders/:id/cancel', protect, cancelOrder);

module.exports = router;
