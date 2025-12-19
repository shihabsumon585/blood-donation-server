require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRETE);
const crypto = require("crypto");

// middleware
app.use(cors());
app.use(express.json());


// **********************************************************************
// -------------------------------------------------------------------
var admin = require("firebase-admin");
const { info } = require("console");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// ------------------------------------------------------------------


// our middleare--------------------------------------------------
const verifyFBToken = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: "unauthorize access" })
    }

    try {
        const idToken = token.split(" ")[1]
        const decoded = await admin.auth().verifyIdToken(idToken)
        req.decoded_email = decoded.email;
        next();
    } catch (error) {
        return res.status(401).send({ message: "unauthorize access" })
    }
}
// **********************************************************************




const uri = `mongodb+srv://${process.env.BLOOD_USER}:${process.env.BLOOD_PASS}@cluster0.0eh4pca.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {


        const db = client.db(process.env.BLOOD_NAME);
        const usersCollection = db.collection("users");
        const donar_requestsCollection = db.collection("donar-requests");
        const paymentCollection = db.collection("payments")

        app.post("/users", async (req, res) => {
            const userData = req.body;
            userData.createdAt = new Date();
            userData.role = "donar";
            userData.status = "active";
            const result = await usersCollection.insertOne(userData);
            res.send(result);
        })

        app.get("/users", verifyFBToken, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get("/users/:email", async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        app.patch("/update/user/status", verifyFBToken, async (req, res) => {
            const { email, status } = req.query;
            const query = { email: email };
            const updateStatus = {
                $set: {
                    status: status
                }
            }
            const result = await usersCollection.updateOne(query, updateStatus);
            res.send(result);
        })

        // donar data backend here's start
        app.post("/donar-requests", async (req, res) => {
            const productDAta = req.body;
            productDAta.createdAt = new Date();
            productDAta.status = "pending"
            const result = await donar_requestsCollection.insertOne(productDAta);
            res.send(result);
        })

        app.get("/my-request", verifyFBToken, async (req, res) => {
            const email = req.decoded_email;

            const size = Number(req.query.size);
            const page = Number(req.query.page);

            const query = { requesterEmail: email };
            const result = await donar_requestsCollection.find(query).limit(size).skip(page * size).toArray();

            const totalRequest = await donar_requestsCollection.countDocuments(query);

            res.send({ request: result, totalRequest });
        })

        app.get("/search-requests", async (req, res) => {
            const { bloodGroup, district, upazila } = req.query;

            // search query
            const query = {};

            if(!query){
                return;
            }
            if(bloodGroup){
                const fixed = bloodGroup.replace(/ /g, "+").trim();
                query.bloodGroup = fixed;
            }
            if(district) {
                query.district = district;
            }
            if(upazila) {
                query.upazila = upazila;
            }
            console.log(query);

            const result = await donar_requestsCollection.find(query).toArray();
            res.send(result);
        })



        // payments
        app.post("/create-payment-checkout", async (req, res) => {
            const information = req.body;
            const amount = parseInt(information.donateAmount) * 100;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            unit_amount: amount,
                            product_data: {
                                name: "Please donate"
                            }
                        },
                        quantity: 1,
                    }
                ],
                mode: "payment",
                metadata: {
                    donarName: information?.donarName
                },
                customer_email: information?.donarEmail,
                success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`
            })
            res.send({ url: session.url })
        })

        app.post("/success-peyment", async (req, res) => {
            const { session_id } = req.query;
            const session = await stripe.checkout.sessions.retrieve(session_id);

            const transactionId = session.payment_intent;

            const paymentExist = await paymentCollection.findOne({ transactionId });

            if (paymentExist) {
                return;
            }

            if (session.payment_status === "paid") {
                const paymentInfo = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    donarEmail: session.customer_email,
                    transactionId,
                    payment_status: session.payment_status,
                    paidAt: new Date(),
                }

                const result = await paymentCollection.insertOne(paymentInfo);
                return res.send(result);
            }
        })




        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Backend server is now working!")
})

app.listen(port, () => {
    console.log(`Backend door is open ${port}`);
})