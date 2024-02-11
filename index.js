const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const { parse } = require("dotenv");
require("dotenv").config();

const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, {});
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//initialize a mongo schema to store user info
const userSc = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
});

//initialize a mongo schema to store exercices info
const exerciseSc = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.formattedDate;
        ret.date = ret.date.toDateString();
        return ret;
      },
    },
  },
);

exerciseSc.virtual("formattedDate").get(function () {
  return this.date.toDateString();
});
//create a user model
const User = mongoose.model("User", userSc);

//create an exercice model
const Exercise = mongoose.model("Exercise", exerciseSc);

app.post("/api/users", (req, res) => {
  const username = req.body.username;
  const newUser = new User({ username: username });

  User.findOne({ username: newUser.username })
    .then((existingUser) => {
      if (existingUser) {
        res.json({ username: existingUser.username, _id: existingUser.id });
      } else {
        // Use await to wait for the user to be saved before responding
        newUser.save().then((savedUser) => {
          res.json({ username: savedUser.username, _id: savedUser._id });
        });
      }
    })
    .catch((error) => {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

//get request to show the entire users database as an array
app.get("/api/users", (req, res) => {
  User.find({}, "_id username").then((users) => {
    res.json(users);
  });
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id; // Access the _id parameter from req.params
  const { description, duration, date } = req.body;

  try {
    if (!userId || !description || !duration) {
      return res.status(400).json({
        error:
          "_id, description, and duration are required. Please provide all of them.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ error: "User by that _id does not exist." });
    }
    const newExercise = new Exercise({
      userId: user._id,
      description,
      duration,
      date,
    });

    const savedExercise = await newExercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.formattedDate,
      duration: savedExercise.duration,
      description: savedExercise.description,
    });
  } catch (error) {
    console.error("Error adding exercise:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//
app.get("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id;

  try {
    if (!userId) {
      return res.status(400).json({ error: "_id parameter is required." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ error: "User by that _id does not exist." });
    }

    const userExercises = await Exercise.find({ userId: user._id });

    res.json({ user, userExercises });
  } catch (error) {
    console.error("Error retrieving user exercises:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//
app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;
  try {
    if (!userId) {
      return res.status(400).json({ error: "_id parameter is required." });
    }
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ error: "User by that _id does not exist." });
    }
    let query = { userId: user._id };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    let userLogsQuery = Exercise.find(query);
    if (limit) {
      const parsedLimit = parseInt(limit);
      if (!isNaN(parsedLimit)) {
        userLogsQuery = userLogsQuery.limit(parsedLimit);
      }
    }
    const userLogs = await userLogsQuery.exec();
    const logCount = userLogs.length;
    res.json({
      _id: user.id,
      username: user.username,
      count: logCount,
      log: userLogs,
    });
  } catch (error) {
    console.error("error retrieving user");
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
