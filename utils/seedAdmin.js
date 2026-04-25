const User = require('../models/User');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@gmail.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            await User.create({
                name: 'System Admin',
                email: adminEmail,
                password: 'admin123',
                role: 'admin'
            });
            console.log('Admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (err) {
        console.error('Error seeding admin:', err);
    }
};

module.exports = seedAdmin;
