--create tables
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(50),
    author VARCHAR(50),
    isbn CHAR(13) UNIQUE NOT NULL,
    cover TEXT
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    date_read DATE,
    rating INT,
    key_takeaway TEXT,
    review TEXT
);

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	email VARCHAR(100) UNIQUE NOT NULL,
	password TEXT NOT NULL
)

--Joined table to make data variable for ejs
SELECT b.id, b.title, b.author, b.isbn, b.cover, r.date_read, r.rating, r.key_takeaway, r.review 
FROM books AS b 
JOIN reviews AS r 
ON b.id = r.book_id
ORDER BY date_read DESC

--Command for updating cover column with url from api request
UPDATE books 
SET cover = $1 --url from axios response
WHERE id = $2 --id of current book in the loop

--Sample data:
INSERT INTO books (title, author, isbn)
VALUES ('The Power of Now', 'Eckhart Tolle', 9781577311959),
        ('Quiet', 'Susan Cain', 9780307352156)

-- Review for "The Power of Now" (book_id = 1)
INSERT INTO reviews (book_id, date_read, rating, key_takeaway, review)
VALUES
(1, '2018-01-10', 5,
 'Living in the present moment eliminates unnecessary suffering and anxiety.',
 'Reading *The Power of Now* by Eckhart Tolle was a transformative experience. One of the most powerful insights was the idea that most suffering comes from dwelling on the past or worrying about the future. Tolle emphasizes that true peace is found in the present moment, where the mind is quiet. I particularly resonated with his analogy of the mind being like a tool that we often misuse, leading to unnecessary stress. The chapter on observing the mind without judgment was a turning point for me. I found myself reflecting more on how often I let my thoughts control my emotions, and I started practicing mindfulness more consistently after reading this book.');

-- Review for "Quiet" (book_id = 2)
INSERT INTO reviews (book_id, date_read, rating, key_takeaway, review)
VALUES
(2, '2017-02-15', 5,
 'Introverts have unique strengths that are often overlooked in society.',
 'Susan Cain’s *Quiet* gave me a newfound appreciation for introverts and their strengths. One takeaway that stood out was the concept of the “restorative niche,” where introverts recharge after overstimulation. I loved how Cain debunked the myth that extroversion is the only path to success by highlighting the quiet leadership styles of figures like Rosa Parks and Mahatma Gandhi. The section that discussed how schools and workplaces are often designed to favor extroverts really made me think about how we can create more inclusive environments. I also appreciated the practical advice on how introverts can navigate social situations while staying true to themselves. This book gave me the confidence to embrace my quiet nature as a strength rather than a limitation.');

