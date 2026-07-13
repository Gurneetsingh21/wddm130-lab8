const express = require('express');
const path = require('path');


const {body, validationResult } = require('express-validator');

const app = express();

app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {

    res.render('form', {

        formData: {
            name: '',
            email: '',
            phone: '',
            postcode: '',
            lunch: '',
            tickets: '',
            campus: ''
        },

        errors: [],

        receipt: null

    });

});

app.post(

    '/',
    [
        body('name')
            .notEmpty()
            .withMessage('Name is required'),

        body('email')
            .notEmpty()
            .withMessage('Email is required'),


        body('postcode')
            .matches(/^[A-Z][0-9][A-Z]\s[0-9][A-Z][0-9]$/i)
            .withMessage('Post code is not in correct format'),

        body('phone')
            .matches(/^\(?(\d{3})\)?[\.\-\/\s]?(\d{3})[\.\-\/\s]?(\d{4})$/)
            .withMessage('Phone is not in correct format'),

        body('lunch')
            .notEmpty()
            .withMessage('Please select lunch option'),

        body('tickets')
            .notEmpty()
            .withMessage('Please select number of tickets'),

        body('campus')
            .notEmpty()
            .withMessage('Please select campus')
    ],

    (req, res) => {


        const errors = validationResult(req);


        if (!errors.isEmpty()) {


            const errorMessages = errors.array()
                .map(error => error.msg);

            return res.render('form', {

                formData: req.body,

                errors: errorMessages,

                receipt: null

            });

        }

       const { name, email, phone, postcode, lunch, tickets, campus } = req.body;


let subtotal = Number(tickets) * 100;


if(lunch === "yes"){
    subtotal += 60;
}

let tax = subtotal * 0.13;


let total = subtotal + tax;



const receipt = {

    name,
    email,
    lunch,
    campus,
    subtotal,
    tax,
    total

};



res.render('form', {

    formData: req.body,

    errors: [],

    receipt: receipt

});


    }
);


app.listen(3000, () => {

    console.log('Server running on http://localhost:3000');

});