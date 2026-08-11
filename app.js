const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { body, validationResult } = require('express-validator');

require('dotenv').config();

const Submission = require('./models/Submission');
const Admin = require('./models/Admin');

const app = express();

let dbConnection;

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    if (!dbConnection) {
        dbConnection = mongoose.connect(process.env.MONGO_URI);
    }

    await dbConnection;
}

async function ensureAdmin() {
    await connectDB();

    const existingAdmin = await Admin.findOne({
        username: 'admin'
    });

    if (!existingAdmin) {
        await Admin.create({
            username: 'admin',
            password: 'admin123',
            displayName: 'Admin'
        });
    }
}

function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }

    res.redirect('/login');
}

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'lab8-secret-key',
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions'
    }),

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
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
        await ensureAdmin();

        const admin = await Admin.findOne({
            username: username
        });

        if (!admin || admin.password !== password) {
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
        body('name')
            .notEmpty()
            .withMessage('Name is required.'),

        body('email')
            .notEmpty()
            .withMessage('Email is required.'),

        body('phone')
            .matches(/^\(?(\d{3})\)?[\.\-\/\s]?(\d{3})[\.\-\/\s]?(\d{4})$/)
            .withMessage('Phone is not in correct format.'),

        body('postcode')
            .matches(/^[A-Z][0-9][A-Z]\s[0-9][A-Z][0-9]$/i)
            .withMessage('Post code is not in correct format.'),

        body('lunch')
            .notEmpty()
            .withMessage('Please select a lunch option.')
            .custom((value, { req }) => {
                if (
                    value === 'yes' &&
                    Number(req.body.tickets) < 3
                ) {
                    throw new Error(
                        'Lunch can only be purchased when buying 3 or more tickets.'
                    );
                }

                return true;
            }),

        body('tickets')
            .notEmpty()
            .withMessage('Please select number of tickets.')
            .bail()
            .isNumeric()
            .withMessage('Tickets must be a valid number.')
            .custom(value => {
                if (Number(value) <= 0) {
                    throw new Error(
                        'Tickets must be greater than 0.'
                    );
                }

                return true;
            }),

        body('campus')
            .notEmpty()
            .withMessage('Please select a campus.')
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

        const tickets = Number(formData.tickets);

        let subtotal = tickets * 100;

        if (formData.lunch === 'yes') {
            subtotal += 60;
        }

        const tax = subtotal * 0.13;
        const total = subtotal + tax;

        try {
            await connectDB();

            const submission = new Submission({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                postcode: formData.postcode.toUpperCase(),
                campus: formData.campus,
                tickets: tickets,
                lunch: formData.lunch,
                subtotal: subtotal,
                tax: tax,
                total: total
            });

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
                errors: [
                    {
                        msg: 'There was an error saving your order.'
                    }
                ],
                receipt: null
            });
        }
    }
);

app.get(
    '/submissions',
    isAuthenticated,
    async (req, res) => {

        try {
            await connectDB();

            const submissions = await Submission
                .find()
                .sort({ createdAt: -1 });

            res.render('submissions', {
                submissions: submissions
            });

        } catch (error) {
            console.log(error);
            res.send('Error loading submissions');
        }
    }
);

if (require.main === module) {
    app.listen(3000, () => {
        console.log(
            'Server running on http://localhost:3000'
        );
    });
}

module.exports = app;