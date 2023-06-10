const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.SECRET_KEY);
const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const e = require("express");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aoalbnp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const sportsCollection = client.db("SportsDB").collection("sportsAcademy");
    const UserCollection = client.db("SportsDB").collection("user");
    const cartsCollection = client.db("SportsDB").collection("carts");
    const paymentsCollection = client.db("SportsDB").collection("payments");
    const enrolledClassCollection = client
      .db("SportsDB")
      .collection("enrolledClass");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await UserCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await UserCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/sportsAcademy", async (req, res) => {
      const result = await sportsCollection.find().toArray();
      res.send(result);
    });

    app.get("/addClass", verifyJWT, verifyInstructor, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { instructorEmail: req.query.email,  };
      }
      const result = await sportsCollection.find(query).toArray();
      res.send(result);
    });


    app.post('/addClass', verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await sportsCollection.insertOne(newItem)
      res.send(result);
    })

    app.get("/popularClasses", async (req, res) => {
      const classes = await sportsCollection
        .find()
        .sort({ studentsEnrolled: -1 })
        .limit(6)
        .toArray();
      res.send(classes);
    });

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await UserCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await UserCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await UserCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await UserCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await UserCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await UserCollection.findOne(query);
      const result = { admin: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await UserCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/students/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await UserCollection.findOne(query);

      if (user.hasOwnProperty("role")) {
        return res.send({admin : false})
      }

      if (!user.hasOwnProperty("role")) {
        return res.send({ admin: true });
      }

      res.send(user);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await UserCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const items = req.body;
      const carts = await cartsCollection.insertOne(items);
      res.send(carts);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", async (req, res) => {
      const payments = req.body;
    
      const insertResult = await paymentsCollection.insertOne(payments);
      const query = {
        _id: { $in: payments.cartItems.map((id) => new ObjectId(id)) },
      };
   
      const deletedResult = await cartsCollection.deleteMany(query);

      // for (const i of payments.classItems) {
      //   console.log(i)
      //   const filter = {_id : new ObjectId(i)}
      //   const updateDoc = {
      //     $set : {
      //       availableSeats : {$subtract : ['$availableSeats', 1]},
      //       studentsEnrolled : {$add : ['$enrollStudent', 1]},
      //     }
      //   }
      //   const result = await sportsCollection.updateOne( filter,updateDoc)
      //   console.log(result)
      // }

      for (const i of payments.classItems) {
        console.log(i);
        const filter = { _id: new ObjectId(i) };
        const updateDoc = {
          $inc: {
            availableSeats: -1,
            studentsEnrolled: 1,
          },
        };
        const result = await sportsCollection.updateOne(filter, updateDoc);
        console.log(result);
      }

      
      
        // const updateDoc = {
        //   $set : {
        //     totalEnrolledStudents : +1
        //   }
        // }
      


      // const enrolledClasses = payments.cartItems.map((id) => ({
      //   ItemId: id,
      // }));
      // const enrollResult = await enrolledClassCollection.insertMany(
      //   enrolledClasses
      // );
      // const enrollResults = payments.cartItems.map(id =>  `ObjectId('${id}')`)
      // console.log(enrollResults)
      // const enrolledClassess = await sportsCollection.find({_id : {$in : enrollResults}}).toArray()
      res.send({ insertResult, deletedResult});
    });

    

    

    // TODO : need to work
    // app.get("/enrolledCls/:id", async (req, res) => {
    //   const id = req.params.id;
    //   // const query = { classItems: {$elemMatch : {$eq : id}} };
    //   // console.log(id)

    //   const payment = await paymentsCollection.find().toArray();
    //   const matchItem = payment.filter(item => item.classItems.includes(id))
    //   console.log(matchItem)

    //   if (!payment) {
    //     return res.status(404).send({ message: "Enrolled class not found" });
    //   }

    //   const enrolledClass = await enrolledClassCollection.insertMany(matchItem)

    //   res.send(enrolledClass)
     
    // });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Summer camp school is starting");
});

app.listen(port, () => {
  console.log(`Summer port is running ${port}`);
});
