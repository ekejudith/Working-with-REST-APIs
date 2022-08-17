const User = require("../models/user");
const { validationResult } = require("express-validator/check");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error("Validation failed");
      err.statusCode = 422;
      throw err;
    }
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({ email, password: hashedPassword, name });
    const result = await user.save();
    res.status(201).json({ message: "User created", userId: result._id });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const loadedUser = await User.findOne({ email: email });
    if (!loadedUser) {
      const err = new Error("User not found");
      err.statusCode = 401;
      throw err;
    }

    const isEqual = await bcrypt.compare(password, loadedUser.password);
    if (!isEqual) {
      const err = new Error("Invalid password");
      err.statusCode = 401;
      throw err;
    }

    const token = jwt.sign(
      {
        email: loadedUser.email,
        userId: loadedUser._id.toString(),
      },
      "hiperszupertitkos",
      { expiresIn: "1h" }
    );

    res.status(200).json({ token, userId: loadedUser._id.toString() });
  } catch (err) {
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 403;
      throw err;
    }
    res.status(200).json({ status: user.status });
  } catch (err) {
    next(err);
  }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 403;
      throw err;
    }
    user.status = req.body.status;
    await user.save();

    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    next(err);
  }
};
