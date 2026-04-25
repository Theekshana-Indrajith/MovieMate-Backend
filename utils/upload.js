const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create directory if not exists
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = 'uploads/';
        if (file.fieldname === 'poster' || file.fieldname === 'backdrop') {
            dir += 'movies';
        } else if (file.fieldname === 'image') {
            // Check if it's from snack routes or seat routes by looking at the URL if possible, 
            // but cleaner to just use different fieldnames. 
            // For now, let's look at the original filename or just add a 'seats' check.
            dir += 'snacks';
        } else if (file.fieldname === 'showtimeImage') {
            dir += 'showtimes';
        } else if (file.fieldname === 'seatImage') {
            dir += 'seats';
        } else if (file.fieldname === 'paymentSlip') {
            dir += 'payments';
        }
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Unique filename with original ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (Optional - Images only)
const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only Images are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
    fileFilter: fileFilter
});

module.exports = upload;
