const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

require('dotenv').config();

const Submission = require('./models/Submission');
const Admin = require('./models/Admin');

const app = express();
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);

let dbConnection;

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    if (!dbConnection) {
        dbConnection = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });
    }

    await dbConnection;
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'lab8-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60
    }
}));

app.use((req, res, next) => {
    res.locals.isAdmin = req.session.isAdmin || false;
    res.locals.adminName = req.session.adminName || null;
    next();
});

app.get('/login', (req, res) => {
    res.render('login', {
        username: '',
        error: null
    });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        await connectDB();

        const admin = await Admin.findOne({
            username: username,
            password: password
        });

        if (!admin) {
            return res.render('login', {
                username: username,
                error: 'Invalid username or password.'
            });
        }

        req.session.isAdmin = true;
        req.session.adminName = admin.displayName;
        req.session.adminId = admin._id.toString();

        req.session.save((error) => {
            if (error) {
                console.log(error);

                return res.render('login', {
                    username: username,
                    error: 'An error occurred while logging in.'
                });
            }

            res.redirect('/submissions');
        });

    } catch (error) {
        console.log('Login error:', error.message);

        res.render('login', {
            username: username,
            error: 'An error occurred while logging in.'
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.log(error);
            return res.send('Error logging out');
        }

        res.redirect('/');
    });
});

app.get('/', (req, res) => {
    res.render('form', {
        formData: {},
        errors: [],
        receipt: null
    });
});

app.post(
    '/processForm',
    [
        body('tickets')
            .isNumeric()
            .withMessage('Tickets must be a valid number.')
            .custom(value => {
                if (Number(value) <= 0) {
                    throw new Error('Tickets must be greater than 0.');
                }

                return true;
            }),

        body('lunch')
            .custom((value, { req }) => {
                if (value === 'yes' && Number(req.body.tickets) < 3) {
                    throw new Error(
                        'Lunch can only be purchased when buying 3 or more tickets.'
                    );
                }

                return true;
            })
    ],
    async (req, res) => {
        const formData = req.body;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.render('form', {
                formData: formData,
                errors: errors.array(),
                receipt: null
            });
        }

        const ticketPrice = 50;
        const tickets = Number(formData.tickets);

        const subtotal = tickets * ticketPrice;
        const tax = subtotal * 0.13;
        const total = subtotal + tax;

        const submission = new Submission({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            postcode: formData.postcode,
            campus: formData.campus,
            tickets: tickets,
            lunch: formData.lunch,
            subtotal: subtotal,
            tax: tax,
            total: total
        });

        try {
            await connectDB();
            await submission.save();

            res.render('form', {
                formData: {},
                errors: [],
                receipt: submission
            });

        } catch (error) {
            console.log(error);

            res.render('form', {
                formData: formData,
                errors: ['There was an error saving your order.'],
                receipt: null
            });
        }
    }
);

app.get('/submissions', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/login');
    }

    try {
        await connectDB();

        const submissions = await Submission.find();

        res.render('submissions', {
            submissions: submissions
        });

    } catch (error) {
        console.log(error);
        res.send('Error loading submissions');
    }
});

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}

module.exports = app;