const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Route files
const path = require('path');
const auth = require('./routes/authRoutes');
const movies = require('./routes/movieRoutes');
const showtimes = require('./routes/showtimeRoutes');
const bookings = require('./routes/bookingRoutes');
const seatRoutes = require('./routes/seatRoutes');
const snacks = require('./routes/snackRoutes');
const seedAdmin = require('./utils/seedAdmin');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/auth', auth);
app.use('/api/movies', movies);
app.use('/api/showtimes', showtimes);
app.use('/api/bookings', bookings);
app.use('/api/seats', seatRoutes);
app.use('/api/snacks', snacks);

// Serve static files (Posters, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Route
app.get('/', (req, res) => {
    res.send('MovieMate API is running...');
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected Successfully');
        // Seed initial admin
        seedAdmin();
    })
    .catch(err => console.log('MongoDB Connection Error: ', err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
