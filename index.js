require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// Uxmq0r572YdBK2zT

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

        app.post("/users", async (req, res) => {
            const userData = req.body;
            userData.createdAt = new Date();
            userData.role = "donar";
            userData.status = "active";
            const result = await usersCollection.insertOne(userData);
            res.send(result);
        })
        
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })
        app.get("/users/:email", async (req, res) => {
            const {email} = req.params;
            const query = { email: email};
            console.log("Query: ", query);
            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        // products backend here's start
        app.post("/products", async(req, res) => {
            const productDAta = req.body;
            productDAta.createdAt = new Date();
            const result = await productsCollection.insertOne(productDAta);
            res.send(result);
        })

        app.get("/products/manager/:email", async (req, res) => {
            const email = req.params.email;
            const query = { managerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
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