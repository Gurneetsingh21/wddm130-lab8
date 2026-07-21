const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

require('dotenv').config();

const Submission = require('./models/Submission');

const app = express();

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.log('MongoDB connection error:', error.message);
    });


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static(path.join(__dirname, 'public')));


app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
    res.render('form', {
        formData: {},
        errors: [],
        receipt: null
    });
});


app.post('/processForm',

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
                    throw new Error('Lunch can only be purchased when buying 3 or more tickets.');
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


console.log(formData);

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


    await submission.save();


    res.render('form', {

        formData: {},

        errors: [],

        receipt: submission

    });


});


app.get('/submissions', async (req, res) => {

    try {

        const submissions = await Submission.find();

        res.render('submissions', {
            submissions: submissions
        });

    } catch (error) {

        console.log(error);

        res.send("Error loading submissions");

    }

});


app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});