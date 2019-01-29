const express = require('express');
const cors = require('cors');
const server = express();
const knex = require('knex');
const KnexConfig = require('../knexfile');
const db = knex(process.env.DB_ENVIORNMENT ? KnexConfig[process.env.DB_ENVIORNMENT] : KnexConfig.development);
const faker = require('faker');
const passport = require('passport');
const cookieSession = require('cookie-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const keys = require('../config/keys');
const multer = require('multer');
const stripe = require("stripe")("sk_test_QBcc8So0WjMMIznAloTV3kdv");
server.use(require("body-parser").text());
const fs = require('fs');
const parse = require('csv-parse');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const sendSMS = require('./send_sms');

//multer middleware saves uploads to the csv-uploads folder
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './csv-uploads')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

// restrict cors access to our netlify
const corsOptions = {
    origin: ["http://localhost:3000","https://www.vbeloved.com", "http://www.vbeloved.com"]
  };

server.use(express.json());
server.use(cors(corsOptions));
server.use('/sms', sendSMS); //endpoint to send a text message

//COOKIES
server.use(cookieParser())
server.use(cookieSession({
    domain: 'https://www.vbeloved.com',
    maxAge: '1hr',
    secret: 'hello.dello'
}))

//--BEGIN::PASSPORT DECLARATIONS

//PASSPORT INITIALIZATION
server.use(passport.initialize())
server.use(passport.session())

//SERIALIZE&DESERIALIZE USER
passport.serializeUser((userID, done) => { //this will take a user object from the database. 
    console.log("SERIALIZE-USER:", userID)
    done(null, userID) //this should grab one piece of unique data from the user obj to be encrypted and add it to a cookie. 
});

passport.deserializeUser((id, done) => {
    console.log('DESERIALIZE-ID:', id)
    done(null, id)
});


//GOOGLE PASSPORT STRATEGY

passport.use(new GoogleStrategy({
    callbackURL: `http://${process.env.LOCAL_URL || 'vbeloved.now.sh'}/google/redirect`,
    clientID: `${keys.google.clientId}`,
    clientSecret: keys.google.clientSecret,
    scope: ['profile'],
    passReqToCallback: true
},
    (req, accessToken, refreshToken, profile, done) => {

        db('oauth_ids').where({ oauth_id: profile.id }).first()
            .then(user => {
                if (user) {
                    console.log('find user success')
                    done(null, user)
                }
                else {
                    console.log('User Not In DB')
                    done(null, { oauth_id: profile.id })
                    /* db('user').insert({first_name: profile.name.givenName, last_name: profile.name.familyName})
                    .then(newUser =>{ console.log('add new user success', newUser)
                        done(null, newUser )
                    }).catch(err => console.log('insertUserError', err))   */
                }
            }).catch(err => { console.log('find user error', err) })

    }
))

//GOOGLE AUTHENTICATE
server.get('/signin/google', passport.authenticate('google', { scope: ['profile'] }))

server.get('/google/redirect', passport.authenticate('google'), (req, res) => {


    console.log('REDIRECT SUCCESS-PASSPORTREQ:', req._passport.session.user);


    console.log('session:', req._passport.session.user.oauth_id)
    res.append('Set-Cookie', 'foo=bar;')
    
    req.session.user_id = req._passport.session.user.oauth_id;
    console.log("REQSESSION:",req.session)
    res.cookie('userID', `${req._passport.session.user.oauth_id}`)
    res.redirect(`http://${ process.env.LOCAL_CLIENT || 'vbeloved.com' }/vb/dashboard`);
    res.cookie('user', `${req._passport.session.user.oauth_id}`)
})


//--- END:PASSPORT DECLARATIONS

const generateToken = (user) => {
    const payload = {
        email: user.email
    }
    const options = {
        expiresIn: '20m'
    }

    return jwt.sign(payload, jwtSecret, options)

}


//REGULAR ENDPOINTS BEGINNING

server.get('/', (req, res) => {

    res.json(`Server root.`)
})

server.get('/deleteall', async (req, res) => {
    try {
        let oauth = await db.table('oauth_ids').del()
        let couples = await db.table('couples').del()
        let users = await db.table('user').del()

        let answers = await db.table('answers').del()
        let questions = await db.table('questions').del()
        let guests = await db.table('guests').del()
        let weddings = await db.table('weddings').del()
        res.status(200).json('Everything - GONE!')
    }
    catch (err) {
        console.log(err)
    }
})


//THIS FUNCTION LOADS THE USER'S INFORMATION INTO THE MAINCONTENT COMPONENT AND IS CALLED INSIDE OF componentDidMount() IN THE DASHBOARD COMPONENT 
server.post('/loaduser', async (req, res) => {
    let { first_name, last_name, p_firstname, p_lastname, event_date, event_address, oauth_id } = req.body;


    try {
        const userOAuthID = await db.table('oauth_ids').where({ oauth_id }).first();

        const user = await db.table('user').join('oauth_ids', { 'user.id': "oauth_ids.user_id" }).where({ oauth_id }).first();
        console.log("Loaduser-USER", user);

        if (!user) {
            const wedding_id = await db.table('weddings').insert({ event_date, event_address });

            const user1 = await db('user').insert({ first_name, last_name, wedding_id }) //email must be added in OAuth
            const user2 = await db('user').insert({ first_name: p_firstname, last_name: p_lastname, wedding_id })

            const oauth = await db('oauth_ids').insert({ oauth_id, user_id: user1[0] })

            const coupleID1 = await db('couples').insert({ user_id: user1[0], dashboard_access: true })
            const coupleID2 = await db('couples').insert({ user_id: user2[0], dashboard_access: true })

            let couple = await db('user').join('couples', { 'user.id': 'couples.user_id' }).where({ wedding_id });
            let guests = await db('user').where({ wedding_id, guest: true });

            res.status(200).json({
                couple,
                guests
            })

        }

        else {

            let couple = await db('user').join('couples', { 'user.id': 'couples.user_id' }).where({ wedding_id: user.wedding_id });
            let guests = await db('user').join('guests', { 'user.id': 'guests.guest_id' }).where({ wedding_id: user.wedding_id, guest: true });
            let questions = await db('questions').where({ wedding_id: user.wedding_id })

            res.status(200).json({
                couple,
                guests,
                questions
            })
        }

    }
    catch (err) {
        console.log('/LOADUSERERROR:', err)
        res.json(err)
    }

})


//RETURNS ALL USER DATA IN THE DATABASE
server.get('/users', async (req, res) => {

    try {

        const users = await db('user');
        if (users) {
            res.status(200).json(users)
        }

    }

    catch (err) {
        res.status(500).json({ message: 'An error occured while retrieving the data.', err })
    }
});


//TAKES ENTERED USER INFORMATION AND SAVES THEM TO DATABASE; CURRENT ONLY ACCEPTS OBJECTS FORMATTED AS FOLLOWS: {firstname: 'data', lastname: 'data'}

server.post('/registration', async (req, res) => {
    const {
        firstname, lastname,      // add to user and couples
        p_firstName, p_lastName,  // add to user and couples
        event_date, event_address  // add to weddings
    } = req.body;

    try {
        const weddingID = await db.table('weddings').insert({ event_date, event_address })
        const userID1 = await db.table('user').insert({ firstname, lastname })
    }

    catch (err) {

    }

    db.table('user').insert(newUser).then(user => {
        res.status(200).json({ message: 'User Successfully Registered' })
    }).catch(err => {
        res.status(500).json({ message: "An error occured while processing data." })
    })

})

//UPDATES USER SETTINGS IN THE DATABASE

server.put('/user/:id', (req, res) => {
    const edit = req.body;

    db('user')
        .where({ id: req.params.id })
        .update(edit)
        .then(response => {
            if (response === 0) {
                res.status(404).json('Could not find user');
            } else {
                res.status(200).json(response);
            }
        })
        .catch(err => {
            res.status(500).json(err);
        });
});

//A FUNCTION TO POPULATE THE DATABASE WITH COUPLES DUMMY DATA
server.get('/dummydata', async (req, res) => {
    let userData = {
        firstname: faker.name.firstName(),
        lastname: faker.name.lastName(),
        p_firstname: faker.name.firstName(),
        p_lastname: faker.name.lastName(),
        email: faker.internet.email(),
        address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`
    }
    let wedding = {
        event_date: faker.date.future(),
        event_location: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
        design_template: Math.floor(Math.random() * 4)
    }



    try {
        const wedding_id = await db.table('weddings').insert({
            event_date: faker.date.future(),
            event_address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
            design_template: Math.floor(Math.random() * 4)
        });
        console.log('weddingID:', wedding_id)

        const user1 = await db.table('user').insert({ first_name: userData.firstname, last_name: userData.lastname, email: userData.email, wedding_id: wedding_id[0] })
        const user2 = await db.table('user').insert({ first_name: userData.p_firstname, last_name: userData.p_lastname, wedding_id: wedding_id[0] })
        console.log('user1:', user1)

        const coupleID1 = await db.table('couples').insert({ user_id: user1[0], dashboard_access: true })
        const coupleID2 = await db.table('couples').insert({ user_id: user2[0], dashboard_access: true })
        console.log('coupleID:', coupleID1)

        if (wedding_id && user1 && coupleID1) {
            res.status(200).json({ wedding_id, coupleID1, coupleID2 })
        }

    }

    catch (err) {
        console.log(err)
        res.status(500).json({ message: 'An error occured while retrieving the data.' })
    }
});

server.get('/dummyguests', async (req, res) => {
    let userData = {
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        email: faker.internet.email(),
        address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
        wedding_id: Math.floor(Math.random() * 8)
    }

    let attendArr = ['Not Attending', 'Attending', 'TBD']

    try {
        let wedding_id = Math.ceil(Math.random() * 7)
        let attendIndex = Math.floor(Math.random() * 3)
        let coupleIndex = Math.floor(Math.random() * 2)

        let userID = await db.table('user').insert({
            first_name: faker.name.firstName(),
            last_name: faker.name.lastName(),
            email: faker.internet.email(),
            address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,

            wedding_id: wedding_id,
            guest: true
        })
        console.log('userID:', userID)

        let couple = await db.table('user').join('couples', { 'users.id': 'couples.user_id' }).where({ wedding_id })
        console.log('couple', couple, wedding_id)

        let related_spouse = couple[coupleIndex].first_name
        console.log('relatedspouse:', related_spouse)
        console.log('attendingArray:', attendArr[attendIndex], attendIndex)
        let guestID = await db.table('guests').insert({
            user_id: userID[0],
            attending: attendArr[attendIndex],
            related_spouse: related_spouse
        })
        console.log('guestID:', guestID)

        let guests = await db.table('user').join('guests', { 'users.id': 'guests.user_id' }).where({ wedding_id: 3 })

        res.status(200).json(guests)
    }

    catch (err) {
        console.log(err)
        res.status(500).json({ message: 'An error occured while retrieving the data.' })

    }

})

//A FUNCTION TO CREATE ADD A GUEST TO A USER PROFILE

server.post('/addguest', async (req, res) => {

    const {
        first_name,
        last_name,
        email,
        address,
        wedding_id,
        related_spouse
    } = req.body

    let attendArr = ['Not Attending', 'Attending', 'TBD']

    try {

        let userID = await db.table('user')
            .insert({
                first_name,
                last_name,
                email,
                address,
                wedding_id,
                guest: true
            })

        let guestID = await db.table('guests')
            .insert({
                guest_id: userID,
                related_spouse
            })



        let guests = await db('user').join('guests', { 'user.id': 'guests.guest_id' }).where({ wedding_id, guest: true })

        res.status(200).json(guests)
    }

    catch (err) {
        console.log(err)
        res.status(500).json({ message: 'An error occured while retrieving the data.' })

    }

})

server.post('/adddummyguest', async (req, res) => {

    const {
        wedding_id,
        couple
    } = req.body
    console.log(req.body)
    let attendArr = ['Not Attending', 'Attending', 'Maybe']

    try {
        let coupleIndex = Math.floor(Math.random() * 2)
        let attendIndex = Math.floor(Math.random() * 3)

        let userID = await db.table('user')
            .insert({
                first_name: faker.name.firstName(),
                last_name: faker.name.lastName(),
                email: faker.internet.email(),
                address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
                wedding_id,
                guest: true
            })

        let guestID = await db.table('guests')
            .insert({
                guest_id: userID,
                related_spouse: couple[coupleIndex].first_name,
                attending: attendArr[attendIndex]
            })
        let guests = await db('user').join('guests', { 'user.id': 'guests.guest_id' }).where({ wedding_id, guest: true })

        res.status(200).json(guests)
    }

    catch (err) {
        console.log(err)
        res.status(500).json({ message: 'An error occured while retrieving the data.' })

    }

})


//A FUNCTION TO RETRIEVE GUESTS 
server.get('/guests', (req, res) => {

    db('user')
        .where({ guest: true })
        .then(user => {
            res.status(200).json(user);
        })
        .catch(err => {
            res.status(500).json({ error: 'database cannot retrieve information' });
        })
});


// A FUNCTION TO DELETE USERS FROM THE USER TABLE
server.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    db('user')
        .where({ id })
        .del()
        .then(note => {
            res.status(200).json(note);
        })
        .catch(err => {
            res.status(500).json({ error: 'database cannot delete information' });
        })
})



//A FUNCTION TO POST QUESTIONS::LINE 360
server.post('/questions', (req, res) => {
    let { questions } = req.body;

    questions.forEach(qData => {
        db.table('questions').where({question: qData.question, wedding_id: qData.wedding_id})
        .then(res => {
            console.log("DBQuery",res)
            if(!res.length){
                console.log('NoRes')
                db.table('questions').insert(qData).then(res =>console.log(res)).catch(err => console.log(err))
            }
            else {
                console.log('ResExists')
            }

            })
            .catch(err => { console.log(err) })
    })
    
    res.status(200).json({message: 'Data Posted Successfully.'})
})


//A FUNCTION TO RETRIEVE QUESTIONS OF A USER::LINE 384
server.get('/:id/allquestions', (req, res) => {
    let { id } = req.params;

    db('questions')
        .where('wedding_id', id)
        .then(response => {
            res.status(200).json(response)
        }).catch(err => {
            res.status(500).json(err)
        })
})


//A FUNCTION TO DELETE QUESTIONS OF A USER::LINE 393
server.delete('/:questionID/deletequestion', async (req, res) => {
    let { questionID } = req.params;
    console.log('qID', questionID)

    try {
        let deletedQ = await db('questions').where({ id: questionID }).del()
        console.log(deletedQ)

        res.status(200).json({ message: 'Deleted Successfully.' })

    }

    catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error.' })
    }


})

//A FUNCTION TO RETRIEVE REGISTRIES OF A USER
server.get('/:id/registries', (req, res) => {
    let { id } = req.params;

    db.table('registry').where({wedding_id: id})
        .then((registries) => {
            res.status(200).json(registries);
        })
        .catch(err=>{
            console.log(err)
            res.status(500).json({message: "server error"})
        })
})

//A FUNCTION TO POST REGISTRIES
server.post('/registry', (req, res) => {
    let { wedding_id, link, name } = req.body;
    console.log("req.body", req.body);

    db.table('registry').insert({ wedding_id, link, name })
        .then(() => {
            db.table('registry').where({wedding_id: wedding_id})
           .then((registries) => {
                res.status(200).json(registries);
           })

        })
        .catch(err=>{
            console.log(err)
            res.status(500).json({message: "server error"})
        })
})

//A FUNCTION TO DELETE REGISTRIES
server.delete('/:id/registry', (req, res) => {
    let { id } = req.params;

    db.table('registry').where({id: id}).del()
        .then(() => {
            res.status(200).json({message: "registry deleted"});
        })
        .catch(err=>{
            console.log(err)
            res.status(500).json({message: "server error"})
        })
})


//A FUNCTION TO POST CSV FILES
server.post('/upload', upload.single('file'), (req, res) => {
     // console.log(req.file) // --> file info saved to req.file
     console.log("File:",req.file,"Body:", req.body)
     let wedding_id = req.body.wedding_id;
    if (!req.file) {
        res.status(400).json({ error: "No file received" });
    } else {
        let csvData = [];
        //parse the csv file that was just saved to the uploads folder
        fs.createReadStream(req.file.path)
            .pipe(parse({ quote: '"', ltrim: true, rtrim: true, delimiter: ',' }))
            .on('data', function (csvrow) {
                console.log("row", csvrow);
                //do something with csvrow
                csvData.push(csvrow);
            })
      
            .on('end',function() {
            //do something with csvData
           // console.log("csvData", csvData);
            for(let i = 1; i < csvData.length -1; i++){

                let first_name = csvData[i][0];
                let last_name = csvData[i][1]
                let email = csvData[i][2]
                let address = csvData[i][3]
                let related_spouse = csvData[i][4]

                console.log(`Person${i}`,{first_name, last_name, email, address, related_spouse, wedding_id})

                db.table('users').insert({first_name, last_name, email, address, wedding_id, guest: true})
                .then(guest_id => { console.log(`Users${i}ID`, guest_id[0])
                    db.table('guests')
                      .insert({guest_id: guest_id[0], related_spouse})
                      .then(guestID => console.log(`Users${i}GuestID:`,guestID)).catch(err => console.log(err))
                })
                .catch(err => console.log(err))

            }
            });
            

        res.status(200).json({ message: "CSV successfully posted" });
    }
})


stripe.charges.retrieve("ch_1DswKX2eZvKYlo2CYqqd3tgH", {
    api_key: "sk_test_4eC39HqLyjWDarjtT1zdp7dc"
});


// STRIPE STATEMENT DESCRIPTOR
server.post("/vb/billing", async (req, res) => {
    console.log(req.body);
    try {
        let { status } = await stripe.charges.create({
            amount: 2000,
            currency: "usd",
            description: "An example charge",
            source: 'tok_visa'
        });
        res.json({ status });
    } catch (err) {
        console.log(err);
        res.status(500).end();
    }
});

// const token = request.body.stripeToken; // Using Express

// const charge = stripe.charges.create({
//   amount: 999,
//   currency: 'usd',
//   description: 'Example charge',
//   source: token,
// });

// stripe.charges.create({
//     amount: 2000,
//     currency: "usd",
//     source:"tok_visa",
//     description:"Test charge for wedding site"
// },  function(err, charge){
//     // asynchronously called 
// });

// stripe.charges.retrieve(
//     "ch_1DswKX2eZvKYlo2CYqqd3tgH",
//     function(err, charge) {
//     // asynchronously called
//   }
// );


server.use('/answer', require('./answers'))

module.exports = server; 
