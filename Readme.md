# Express authentication with postgres backend

This is a breakdown of a initial setup of authentication using express, passport.js, bcrypt along with a postgresSQL database to establish a secure user authentication experience

For the purposes of this breakdown, most parts of the project will be set up and placed in app.js, while the step by step approach is broken down here.

In a real world application, it would be essential to split the seperation of concerns as needed, this can depend on the project however and will be left at your discretion as to how that should be done.

This breakdown assumes you have already installed and established postgreSQL either locally on your machine for dev purposes, or know how to establish one in the cloud.

For the purposes of this project, I have a local postgreSQL setup for development, that can be carried over to a Saas solution as needed.

Without further ado, let's get started

## Step 1 - Database Setup

To start we will establish a database within psql, the CLI postgreSQL query tool.

So using the terminal, access the tool.

```bash
psql
```

using psql, establish a new database.

```bash
NEW DATABASE <insert-database-name-here>
```

Confirm it has been established by listing all available databases

```bash
\l
```

Once found, connect to it.

```bash
\c <database-name-here>
```

We are now ready to query our database!

Lets start with a table
For our authentication uses, we will need a users table.
The users table will need to be populated with rows consisting of:
a unique identifier (id),
a username (VARCHAR)
And a password (VARCHAR)

![Database association diagram 1](./public/database-association1.svg)

So let's query it up!

```sql
CREATE TABLE users(
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    username VARCHAR( 255 ),
    password VARCHAR( 255 )
);
```

With this our users table is established.

Verify that the table has been established by querying a select of it.

```sql
SELECT * FROM users;
```

And it should return an empty table.

now, we can insert new rows using

```sql
INSERT INTO users(username, password) VALUES('some-username', 'some-secured-password');
```

`username` and `password` will be the data that we will be populating in each row.
and will accept up to 255 character long inputs.

The `id` column will automatically be managed by SQL, ever incrementing as more data
is added thanks to the `IDENTITY` clause.

The benefits of doing it like this, is mainly that each row will have a unique identifer.
This will also simplify insertion operations as postgreSQL will manage unique IDs for us.

## Step 2 - Express setup

Initialize our node environment so we can install our packages

```bash
npm init -y
```

This will establish the work directory as a node environment and create a fresh
`package.json` file.

While were add it, go to `package.json` and add the watch line under scripts.
This will allow us to easily wind up our app during development.

```json
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "watch": "node --watch app.js" // add new script command.
  },
```

Now that we have a database to interact with, we will need a application.

We will use express, and various useful middleware to establish an application that can
create, authenticate and manage user data.

For this, we will use the node package manager to install express along with the following middleware.

```bash
npm install express express-session pg passport passport-local ejs dotenv
```

-   [Express](http://expressjs.com/), will be our application framework.

-   [express-session](https://www.npmjs.com/package/express-session), will help us manage our user sessions using browser cookies.

-   [pg](https://www.npmjs.com/package/pg) will help us manage our postgreSQL operations and authorization.

-   [passport](https://www.npmjs.com/package/passport), will allow us to establish authentication and authentication strategies throughout our application. (more on this in a bit)

-   [passport-local](https://www.passportjs.org/packages/passport-local/), is the specific passport authentication strategy that we will establish for the purposes of this project. There are alot of different viable strategies to draw inspiration from, but this one is a common one for local authentication.

-   [ejs] or Embedded Javascript Templates will be a render engine that we will use for the purposes of rendering views and executing javascript through the same files.

-   [dotenv](https://www.npmjs.com/package/dotenv) will allow us to load environment variables safely from .env into our process.env object.

## Step 3 - The express app

We will start by establishing a very basic express application.
For the moment, we will not yet secure the passwords and just use plain text passwords. **This should never ever be done in a serious production**, and will be fixed later down the line.

So, let's create `app.js` and get to coding!

```javascript
/* Import our middleware */
const { Pool } = require('pg');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();

/* configure our postgres pool, that will be used to authenticate access to the database */
const pool = new Pool({
    /* use dotenv to safely store our actual connection strings in a secret .env file */
    // refer to a locally stored dev database connection string, alternatively a production string.
    // A connection string should be in the following format
    // postgresql://<database-power-user>:<database-password>@<database-host>:<database-port>/<database-name>
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

// Configure express to parse url data to request body.
app.use(express.urlencoded({ extended: false }));

// Establish our first route, rendering the index view when requested.
app.get('/', (req, res) => res.render('index'));

// Configure app to listen to port, pulled from environment secrets.
app.listen(process.env.PORT, () =>
    console.log('App listening on port ', process.env.PORT)
);

// The app is now ready for use!
```

## Step 4 - The views.

During our application setup, we set up a single route rendering a index view.
lets make that now, create a `index.ejs` file.

```javascript
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
        />
        <title></title>
    </head>
    <body>
        <h1>Hello world</h1>
    </body>
</html>
```

This will serve as the page that we will secure and attempt to create access to.

In order for us to authorize access, we will need users to give access to.
So lets create view, that will allow new users to sign up to our amazing website.

Create `sign-up-form.ejs`

```javascript
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
        />
        <title></title>
    </head>
    <body>
        <h1>Sign up!</h1>
        <form
            action=""
            method="post"
        >
            <label for="username">Username:</label>
            <input
                type="text"
                name="username"
                id="username"
                placeholder="username..."
            />
            <label for="password">password:</label>
            <input
                type="password"
                name="password"
                id="password"
            />
            <button>Sign up</button>
        </form>
    </body>
</html>
```

With this, we create a simple form that will allow a user to submit a desired username and password.

Remember to establish a route for this view in `app.js`.

```javascript
// Establish second route, rendering the sign-up-form view when requested.
app.get('/', (req, res) => res.render('index'));
app.get('/sign-up', (req, res) => res.render('sign-up-form'));
```

Next, create an app.post route that will submit the sign-up form, so we can process the data and send it to our database.

```javascript
// Post route for submitting a sign up form
app.post('/sign-up', async (req, res, next) => {
    // When posted, try to
    try {
        // create a query to send to your database using our pool authentication
        await pool.query(
            'INSERT INTO users(username, password) VALUES($1, $2)',
            // pass our submitted credentials seperately to avoid cross site scripting.
            [req.body.username, req.body.password]
        );
        // once done, redirect to index.
        res.redirect('/');
        // If an error occours, do the following
    } catch (err) {
        // end function, passing the error to next middleware in chain.
        return next(err);
    }
});
```

**Again, this is still not a particularly safe way to create users, but we will correct this a bit later, keep at it!**

At this point, we are now ready to accept new user sign ups!

Go ahead and boot up our application using `npm run watch` and access `localhost:<your-port>`

We can now see our index! Oh no! That is totally understandable however, since we have not yet
set up an authentication requirement on this route.

Go ahead and access `localhost:<your-port>/sign-up`, fill out the form and submit it!

You will be re-routed to the index page as planned.

If everything went well, you should be able to query a select from the table and see our sparkling new user there!

```sql
SELECT * FROM users;
```

Great, one user! And a totally exposed password! Not so great! We will fix that momentarily however.
