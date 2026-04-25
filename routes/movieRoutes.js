const express = require('express');
const { 
    getMovies, 
    getMovie, 
    createMovie, 
    updateMovie, 
    deleteMovie,
    createMovieReview,
    deleteMovieReview
} = require('../controllers/movieController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// Include other resource routers
const showtimeRouter = require('./showtimeRoutes');

const router = express.Router();

// Re-route into other resource routers
router.use('/:movieId/showtimes', showtimeRouter);

// Middleware: Logged in status for all movie routes
router.use(protect);


router
    .route('/')
    .get(getMovies)
    .post(authorize('admin'), upload.fields([{ name: 'poster', maxCount: 1 }, { name: 'backdrop', maxCount: 1 }]), createMovie);

router
    .route('/:id')
    .get(getMovie)
    .put(authorize('admin'), upload.fields([{ name: 'poster', maxCount: 1 }, { name: 'backdrop', maxCount: 1 }]), updateMovie)
    .delete(authorize('admin'), deleteMovie);

router.route('/:id/reviews').post(createMovieReview);
router.route('/:id/reviews/:reviewId').delete(authorize('admin'), deleteMovieReview);

module.exports = router;
