/* Import our middleware */
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();

/* configure our postgres pool, that will be used to authenticate access to the database */
const pool = new Pool({
    /* use dotenv to safely store our actual connection strings in a secret .env file */
    // Note how the repository does not include said .env file, it is not supposed to be shared.
    // refer to a locally stored dev database connection string, alternatively a production string.
    // If a dev string is found (in our locally stored .env) this will be used.
    // if it is not found, a production URL will be used as needed.
    connectionString: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL,
});

/* Establish our express app */
const app = express();

/* Configure express app */
// Set up our views directory
app.set('views', __dirname);
// configure our app to use ejs as our view engine
app.set('view engine', 'ejs');

// configure session middleware.
// It is not something that will be used directly outside of this.
// It is a prerequisite for passport, which will see heavy use however.
app.use(
    session({
        // Establish a secret, pulled from our environment secrets
        // This will be used to sign each session ID cookie
        secret: process.env.SESSION_SECRET,
        // Because we are using this for establishing login sessions, the following options
        // should be disabled (true by default)
        // Forces the session to be saved back to the session store if true.
        resave: false,
        // Forces a session that is unitizialized to be saved to teh store if enabled.
        // A session that is new, but not modified, is uninitizialised.
        saveUninitialized: false,
    })
);

// Initialize our passport session middleware
app.use(passport.session());

passport.use(
    // Pass username, password and middleware callback done.
    new LocalStrategy(async (username, password, done) => {
        try {
            // Query user rows matching the username and their relevant data (password)
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
            );
            // Assign to user
            const user = rows[0];

            // If no user is returned, no username matched, call done with relevant message
            if (!user) {
                return done(null, false, { message: 'Incorrect username' });
            }
            // If user.password does not match passed password, login fails.
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                //The passwords do not match!
                return done(null, false, { message: 'Incorrect password' });
            }
            // If all of the above passes, finish authentication.
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [
            id,
        ]);
        const user = rows[0];

        done(null, user);
    } catch (err) {
        done(err);
    }
});

// custom middleware that assigns a req.user object to a custom locals.currentUser attribute.
// we can now call currentUser in any view without having to pass it every time.
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});

// Configure express to parse url data to request body.
app.use(express.urlencoded({ extended: false }));

// Establish our first route, rendering the index view when requested.
app.get('/', (req, res) => res.render('index', { user: req.user }));
// SEcond route to render 'sign-up-form' when requested.
app.get('/sign-up', (req, res) => res.render('sign-up-form'));

// Post route for submitting a sign up form
app.post('/sign-up', async (req, res, next) => {
    // When posted, try to
    try {
        // use bcrypt to hash our provided password.
        bcrypt.hash(
            // pass our provided password, and our secret salt.
            req.body.password,
            10,
            async (err, hashedPassword) => {
                // Handle errors here as needed
                if (err) {
                    next(err);
                }
                // if no errors occour during hashing, go ahead and submit to the database.
                // create a query to send to your database using our pool authentication
                await pool.query(
                    'INSERT INTO users(username, password) VALUES($1, $2)',
                    // pass our submitted credentials seperately to avoid cross site scripting.
                    // Note we are submitting the hashedPassword to the database!
                    [req.body.username, hashedPassword]
                );
            }
        );
        // once done, redirect to index.
        res.redirect('/');
        // If an error occours, do the following
    } catch (err) {
        // end function, passing the error to next middleware in chain.
        return next(err);
    }
});

// Post route for log-in
app.post(
    '/log-in',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/',
    })
);

app.get('/log-out', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

// Configure app to listen to port, pulled from environment secrets.
app.listen(process.env.PORT, () =>
    console.log('App listening on port ', process.env.PORT)
);

// The app is now ready for use!
