const { validationResult } = require("express-validator/check");
const fs = require("fs");
const path = require("path");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  Post.find()
    .countDocuments()
    .then((count) => {
      totalItems = count;
      return Post.find()
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    })
    .then((posts) => {
      if (!posts) {
        const err = new Error("could not find post");
        err.statusCode = 404;
        throw err;
      }
      console.log(posts);
      res.status(200).json({
        message: "Post fetched successfully!",
        posts: posts,
        totalItems: totalItems,
      });
    })
    .catch((err) => next(err));
};

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error("Validation failed");
    err.statusCode = 422;
    throw err;
  }

  console.log(req.file);
  if (!req.file) {
    const err = new Error("No image file specified");
    err.statusCode = 422;
    throw err;
  }

  const imageUrl = req.file.path.replace("\\", "/");
  const title = req.body.title;
  const content = req.body.content;
  let creator;

  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId,
  });
  post
    .save()
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then((result) => {
      res.status(201).json({
        message: "Post created successfully!",
        post: post,
        creator: { _id: creator._id, name: creator.name },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
        next(err);
      }
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.id;
  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const err = new Error("could not find post");
        err.statusCode = 404;
        throw err;
      }
      res.status(200).json({
        message: "Post fetched successfully!",
        post: post,
      });
    })
    .catch((err) => next(err));
};

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req);
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

  Post.findById(id)
    .then((post) => {
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
      return post.save();
    })
    .then((result) => {
      res.status(200).json({ message: "Post updated", post: result });
    })
    .catch((err) => next(err));
};

exports.deletePost = (req, res, next) => {
  const id = req.params.id;
  Post.findById(id)
    .then((post) => {
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
      return Post.findByIdAndRemove(id);
    })
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      user.posts.pull(id);
      return user.save();
    })
    .then((result) => {
      res.status(200).json({ message: "Deleted post successfully!" });
    })
    .catch((err) => next(err));
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
