const { validationResult } = require("express-validator/check");
const fs = require("fs");
const path = require("path");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Post fetched successfully!",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error("Validation failed");
    err.statusCode = 422;
    throw err;
  }

  if (!req.file) {
    const err = new Error("No image file specified");
    err.statusCode = 422;
    throw err;
  }

  const imageUrl = req.file.path.replace("\\", "/");
  const title = req.body.title;
  const content = req.body.content;
  let creator;

  try {
    const post = new Post({
      title: title,
      content: content,
      imageUrl: imageUrl,
      creator: req.userId,
    });
    await post.save();

    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();

    res.status(201).json({
      message: "Post created successfully!",
      post: post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
      next(err);
    }
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.id;

  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const err = new Error("could not find post");
      err.statusCode = 404;
      throw err;
    }
    res.status(200).json({
      message: "Post fetched successfully!",
      post: post,
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req);
  try {
    if (!errors.isEmpty()) {
      const err = new Error("Validation failed");
      err.statusCode = 422;
      throw err;
    }

    const id = req.params.id;
    const { title, content } = req.body;
    let imageUrl = req.body.image;

    if (req.file) {
      imageUrl = req.file.path.replace("\\", "/");
    }
    if (!imageUrl) {
      const err = new Error("No file picked!");
      err.statusCode = 422;
      throw err;
    }

    const post = await Post.findById(id);

    if (!post) {
      const err = new Error("could not find post");
      err.statusCode = 404;
      throw err;
    }

    if (post.creator.toString() !== req.userId) {
      const err = new Error("Not authorized");
      err.statusCode = 403;
      throw err;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.content = content;
    post.title = title;
    post.imageUrl = imageUrl;
    const result = await post.save();

    res.status(200).json({ message: "Post updated", post: result });
  } catch (err) {
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const id = req.params.id;
    const post = await Post.findById(id);
    if (!post) {
      const err = new Error("could not find post");
      err.statusCode = 404;
      throw err;
    }
    if (post.creator.toString() !== req.userId) {
      const err = new Error("Not authorized");
      err.statusCode = 403;
      throw err;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);

    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();

    res.status(200).json({ message: "Deleted post successfully!" });
  } catch (err) {
    next(err);
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
