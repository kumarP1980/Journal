//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const expressSanitizer = require('express-sanitizer');
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const app = express();

var bloggerName = "";
var nameofUser = "";
app.set('view engine', 'ejs');
let posts = [];
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.use(expressSanitizer());

// Session Management
app.use(session({
  secret: "Daily Journal.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Define mongoose
var mongoose = require('mongoose');
// Connection URL
//const url = 'mongodb://localhost:27017';
const url = 'mongodb+srv://'+process.env.DB_USER+':'+process.env.DB_PASS+'@cluster-blog-cj9jb.mongodb.net';
// Database Name
const dbName = 'dailyJournal';
mongoose.connect(url + "/" + dbName, {
  useNewUrlParser: true
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());

passport.deserializeUser(User.deserializeUser());

//Define Office Schema
const userDetails = new mongoose.Schema({
  name: String,
  username: String,
  phoneNumber: String,
  email: String
});
const userInfo = new mongoose.model("userInfo", userDetails);

//Define Schema
const blogSchema = new mongoose.Schema({
  title: String,
  blog: String,
  username: String,
  date: String,
  sortDate : Date
});

// Home Route
app.get("/", function (req, res) {
  res.render("home");
});

// Blog Home
app.get("/blogHome", function (req, res) {
  if (req.isAuthenticated()) {
    const userName = nameofUser;
    const Blog = mongoose.model('Blog', blogSchema);
    const userInfo = mongoose.model("userInfo", userDetails);
    userInfo.find({ "username": { $eq: userName } }, function (err, bloggerData) {
      if (err) {
        console.error(err);
      } else {
        bloggerName = bloggerData[0].name;
      }
    });
    // Read from blog table
    Blog.find({ "username": { $eq: userName } }, function (err, blogs) {
      if (err) {
        console.error(err);
      } else {        
          res.render('blogHome', {
          blogJournal: blogs,
          name: bloggerName
        });
      }
    }).sort({sortDate : -1});
  }
});

// Login Route
app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) {
    if (err) {
      console.log("Not valid user");
      res.render("login");
    } else {
      passport.authenticate("local", { failureRedirect: '/login' })(req, res, function () {
        nameofUser = req.body.username;
        res.redirect("/blogHome");
      });
    }
  });

});

// Register Route
app.get("/register", function (req, res) {
  const msg = "";
  res.render("signUp", {
    msg: msg
  });
});

app.post("/register", function (req, res) {
  const username = req.body.userName;
  const message = "Username " + username + " already existing.";
  const msg = "";
  const users = mongoose.model("User", userSchema);
  users.findOne({ "username": { $eq: username } }, function (err, userData) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    }
    if (userData) {
      res.render("signUp", {
        msg: message
      });
    } else {
      User.register({ username: req.body.userName },
        req.body.password, function (err, user) {
          if (err) {
            console.log(err);
            res.redirect("/register");
          } else {
            const blogger = new userInfo({
              name: req.body.name,
              username: req.body.userName,
              email: req.body.email
            });
            blogger.save(function (err) {
              if (!err) {
                res.redirect("/login");
              }
            });
          }
        });
    }
  });
});


app.get("/post/:blogDay", function (req, res) {
  const requestedPostId = req.params.blogDay;
  const Blog = mongoose.model('Blog', blogSchema);
  Blog.findOne({
    _id: requestedPostId
  }, function (err, blogs) {
    res.render("post", {
      title: blogs.title,
      blogText: blogs.blog,
      name: bloggerName,
      id:blogs._id
    });
  });
});

//Define logout Route
app.get("/logout", function (req, res) {
  req.session.destroy();
  res.redirect("/");
});

// Define Reset Password
app.get("/resetPass", function (req, res) {
  const msg = "";
  res.render('resetPassword',{
    msg:msg
  });
});

app.post("/resetPass", function (req, res) {
  const username = req.body.userName;
  const message = "Username " + username + " doesn't exist.";
  const users = mongoose.model("User", userSchema);
  users.findOne({ "username": { $eq: username } }, function (err, userData) {
    if (err) {
      console.log(err);
     res.redirect("/resetPass");
    } 
    if (!userData) {
      res.render('resetPassword',{
        msg:message
      });
    } else {
      userData.setPassword(req.body.password, function (err, user) {
        if (err) {
          console.log(err);
          res.redirect("/resetPass");
        } else {
          userData.save();
          res.redirect("/login");
        }
      });
    }
  });  
});

app.get("/contact", function (req, res) {
  res.render('contact');
});

// Define compose
app.get("/compose", function (req, res) {
  res.render('compose', {
    user: nameofUser,
    name: bloggerName
  });
});

app.post("/compose", function (req, res) {
  let options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  let today = new Date().toLocaleDateString("en-US", options);

  // Insert in Person table
  const Blog = mongoose.model('Blog', blogSchema);
  let blogData = req.sanitize(req.body.body.content);
  const blog = new Blog({
    title: req.body.title,
    blog: blogData,
    date: today,
    username: req.body.user
  });
  blog.save(function (err) {

    if (!err) {

      res.redirect("/blogHome");

    }

  });
});

//Define Edit Route
app.get("/editPost/:blogID", function (req, res) {
  const requestedBlogId = req.params.blogID;
  const Blog = mongoose.model('Blog', blogSchema);
  Blog.findOne({
    _id: requestedBlogId
  }, function (err, blogs) {
    res.render("editPost", {
      title: blogs.title,
      blogText: blogs.blog,
      name: bloggerName,
      user: nameofUser,
      id:blogs._id,
      date: blogs.date
    });
  });
});

app.get("/editPost", function (req, res) {
  const requestedBlogId = req.params.blogID;
  const Blog = mongoose.model('Blog', blogSchema);
  Blog.findOne({
    _id: requestedBlogId
  }, function (err, blogs) {
    res.render("editPost", {
      title: blogs.title,
      blogText: blogs.blog,
      name: bloggerName,
      user: nameofUser,
      id:blogs._id,
      date: blogs.date
    });
  });
});

//Define Modify Route
app.post("/editPost", function (req, res) {
  const Blog = mongoose.model('Blog', blogSchema);
  let requestedBlogId = req.body.blogID;
  let title = req.body.title;
  let blogData = req.sanitize(req.body.body.content);    
  const filter = { _id: requestedBlogId };
  const update = { title: title, blog: blogData};
  mongoose.set('useFindAndModify', false);
  Blog.findOneAndUpdate(filter, update, function (err, person) {
  });
  if (req.isAuthenticated()) {
      res.redirect("/blogHome");
  }
});

app.listen(process.env.PORT || 3050, function () {
  console.log("Sever has started on port 3050......");
});
