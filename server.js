import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import pg from 'pg';
import 'dotenv/config';
import bcrypt from "bcrypt";
import passport from 'passport';
import { Strategy } from 'passport-local';
import session from 'express-session';


const app = express();
const port = 3000;
const API_URL = "https://covers.openlibrary.org/b";
const saltRounds = 10;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

const password = process.env.DB_PASSWORD;

if(!password){
  console.error("Error: DB_PASSWORD is missing!")
  process.exit(1);
}

const db = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'books',
  password: password,
  port: 5432,
});

db.connect();

let bookList = [
  { 
    id: 1, 
    title: 'The Power of Now', 
    author: 'Eckhart Tolle', 
    isbn: 9781577311959, 
    cover: 'https://ia800801.us.archive.org/view_archive.php?archive=/6/items/olcovers83/olcovers83-L.zip&file=832622-L.jpg', 
    date_read: '2018-01-10', 
    rating: 5, 
    key_takeaway: 'Living in the present moment eliminates unnecessary suffering and anxiety.',
    review:  'Reading *The Power of Now* by Eckhart Tolle was a transformative experience. One of the most powerful insights was the idea that most suffering comes from dwelling on the past or worrying about the future. Tolle emphasizes that true peace is found in the present moment, where the mind is quiet. I particularly resonated with his analogy of the mind being like a tool that we often misuse, leading to unnecessary stress. The chapter on observing the mind without judgment was a turning point for me. I found myself reflecting more on how often I let my thoughts control my emotions, and I started practicing mindfulness more consistently after reading this book.'
  }
]

async function getBookCover(data) {
  for (const book of data){
    try {
      if(!book.cover){
        const response = await axios.get(`${API_URL}/isbn/${book.isbn}-L.jpg`);
        const coverUrl = response.config.url;
        console.log(response.config.url);

        await db.query("UPDATE books SET cover = $1 WHERE id = $2", [coverUrl, book.id]);
      }
    } catch (error) {
      console.log(error);
    }
  };
}

function formattedDates(data) {
  return data.map(item => ({
    ...item,
    date_read: item.date_read ? item.date_read.toISOString().split('T')[0]: '',
    formattedDate: item.date_read ? new Date (item.date_read).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    : ''
  }));
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

//Load the home page with data from DB
app.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT b.id, b.title, b.author, b.isbn, b.cover, r.date_read, r.rating, r.key_takeaway, r.review FROM books AS b JOIN reviews AS r ON b.id = r.book_id ORDER BY date_read DESC"
    );
    bookList = formattedDates(result.rows);

    await getBookCover(bookList);

    res.render("index.ejs", 
      {bookList: bookList, criteria: 'date_read', authorization: req.isAuthenticated()}
    );
  } catch (error) {
    console.log(error)
  }
});

//Handle submitting new reviews
app.get("/new", (req, res) => {
  if(req.isAuthenticated()){
    res.render("new.ejs", {authorization: req.isAuthenticated()});
  } else {
    res.redirect("/login");
  }
});

app.post("/submitreview", async (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const isbn = req.body.isbn;
  const date = req.body.date;
  const rating = req.body.rating;
  const takeaway = req.body.takeaway;
  const review = req.body.review;

  if(req.isAuthenticated()){
    try {
      await db.query('INSERT INTO books (title, author, isbn) VALUES ($1, $2, $3)', [title, author, isbn]);
    } catch (error) {
      console.log(error);
    }
  
    try {
      const result = await db.query('SELECT * FROM books WHERE title = $1', [title]);
  
      await db.query('INSERT INTO reviews (book_id, date_read, rating, key_takeaway,review) VALUES ($1, $2, $3, $4, $5)', [result.rows[0].id ,date, rating, takeaway, review]);
  
      res.redirect('/');
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/login");
  }

})

//Handle sorting on home page
app.get("/sort/:criteria", async (req, res) => {
  const sortOptions = {
    date_read: {column: 'r.date_read', direction: 'DESC'},
    rating: {column: 'r.rating', direction: 'DESC'},
    title: {column: 'b.title', direction: 'ASC'}
  };
  
  const criteria = req.params.criteria;
  const sortBy = sortOptions[criteria];

  try {
    const result = await db.query(
      `SELECT b.id, b.title, b.author, b.isbn, b.cover, r.date_read, r.rating, r.key_takeaway, r.review FROM books AS b JOIN reviews AS r ON b.id = r.book_id ORDER BY ${sortBy.column} ${sortBy.direction}`
    );
    bookList = formattedDates(result.rows);
    // console.log(bookList)
    await getBookCover(bookList);

    res.render("index.ejs", {bookList: bookList, criteria: criteria, authorization: req.isAuthenticated()});

  } catch (error) {
    console.log(error)
  }
});

//Handle edit page and form
app.get("/edit/:id", async (req, res) => {
  const id = req.params.id;
  if(req.isAuthenticated()){
    try {
      const result = await db.query(
        "SELECT b.id, b.title, b.author, b.isbn, b.cover, r.date_read, r.rating, r.key_takeaway, r.review FROM books AS b JOIN reviews AS r ON b.id = r.book_id WHERE b.id = $1 ORDER BY date_read DESC", [id]
      );
  
      res.render("edit.ejs", 
        {book: result.rows[0], authorization: req.isAuthenticated()});
      
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/login");
  }
});

app.post('/edit', async (req, res) => {
  const id = req.body.bookId;
  const title = req.body.title;
  const author = req.body.author;
  const isbn = req.body.isbn;
  const date = req.body.date;
  const rating = req.body.rating;
  const takeaway = req.body.takeaway;
  const review = req.body.review;

  if(req.isAuthenticated()){
    try {
      await db.query(
        'UPDATE books SET title = $1, author = $2, isbn = $3 WHERE id = $4',
        [title, author, isbn, id]
      );
    } catch (error) {
      console.log(error);
    }
  
    try {
      await db.query(
        'UPDATE reviews SET date_read = $1, rating = $2, key_takeaway = $3, review = $4 WHERE book_id = $5',
        [date, rating, takeaway, review, id]
      );
      res.redirect('/')
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/login");
  }
});


//Handle delete route
app.get("/delete/:id", async (req, res) => {
  const id = req.params.id;
  if(req.isAuthenticated()){
    try {
      //since reviews has forgein key, need to delete this first
      await db.query('DELETE FROM reviews WHERE book_id = $1', [id]);
  
      await db.query('DELETE FROM books WHERE id = $1', [id]);
  
      res.redirect("/");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/login");
  }
});

//handle login and registration
app.get("/login", (req, res) => {
  res.render("login.ejs", {authorization: req.isAuthenticated()});
});

app.get("/register", (req, res) => {
  res.render("register.ejs", {authorization: req.isAuthenticated()});
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/login", 
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if(checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if(err) {
          console.error("Error hashing password: ", err);
        } else {
          const result = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", [email, hash]);
          
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/"); //redirect to home page where they can now edit or delete posts
          });
        }
      });
    }
  } catch (error) {
    console.log(error);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
      if(result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;

        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if(err) {
            console.error("Error comparing password: ", err);
          } else {
            if(valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (error) {
      console.log(error);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});