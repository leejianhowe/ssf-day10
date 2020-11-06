// load lib
const express = require('express')
const hbs = require('express-handlebars')
const mysql = require('mysql2/promise')
const withQuery = require('with-query').default
const fetch = require('node-fetch')

// create env variables
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT)
const API_KEY = process.env.API_KEY

// create URL
const url = 'https://api.nytimes.com/svc/books/v3/reviews.json'

// create SQL statment
const SQL_FIND_LENGTH = "SELECT count(*) as bookCount FROM book2018 WHERE title LIKE ?"
const SQL_FIND_TITLE = "SELECT * FROM book2018 WHERE title LIKE ? limit ? offset ?"
const SQL_FIND_BOOK_BY_ID = "SELECT * FROM book2018 WHERE book_id = ?"

// create connectionPool
const pool = mysql.createPool({
  host: 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'goodreads',
  timezone: '+08:00',
  connectionLimit: 4

})

// create alphabet
function generateAlphaSeq() {
  let alphaSeq = [];
  const start = 'A'.charCodeAt(0);
  const last = 'Z'.charCodeAt(0);
  for (let i = start; i <= last; ++i) {
    alphaSeq.push(String.fromCharCode(i));
  }
  const numStart = '0'.charCodeAt(0)
  const numEnd = '9'.charCodeAt(0)
  for (i = numStart; i <= numEnd; i++) {
    alphaSeq.push(String.fromCharCode(i))
  }
  console.log(`alphaSeq`, alphaSeq)
  return alphaSeq
}

// create APP
const app = express()

// load hbs
app.engine('hbs', hbs({
  defaultLayout: 'main.hbs'
}))
app.set('view engine', 'hbs')


// search NYTIMES API
app.get('/reviews/:title', async (req, res) => {
  const title = req.params.title
  const query = withQuery(url, {
    'api-key': API_KEY,
    title: title
  })
  const connection = await fetch(query)
  const results = await connection.json()
  if (results.num_results) {
    console.log(`results`, results)
    res.status(200).type('text/html')
    res.render('reviews', {
      results,title
    })
  } else {
    res.status(200).type('text.html')
    res.render('not-found')

  }


})

// load specific book_id
app.get('/search/book/:bookId', async (req, res) => {
  const bookId = req.params.bookId
  console.log(`bookId`, bookId)
  const connection = await pool.getConnection()
  try {
    const results = await connection.query(SQL_FIND_BOOK_BY_ID, [bookId])
    const bookDetails = results[0][0]
    const genres = bookDetails.genres.split("|")
    const authors = bookDetails.authors.split("|")
    console.log(authors)
    console.log(genres)
    res.status(200).type('text/html')
    res.render('book', {
      bookDetails,
      authors,
      genres
    })
  } catch (err) {
    console.error(err)

  } finally {
    connection.release()
  }
})



// find titles with alphabetnumeric
app.get('/search/:alpha', async (req, res) => {
  // get the alphanumeric
  const alpha = req.params.alpha
  // set offset
  const offset = parseInt(req.query.offset) || 0
  // set limit per page
  const limit = 10
  console.log(`alpha`, alpha)
  const connection = await pool.getConnection()
  try {
    const findLength = await connection.query(SQL_FIND_LENGTH, [`${alpha}%`])
    const bookCount = findLength[0][0].bookCount

    const results = await connection.query(SQL_FIND_TITLE, [`${alpha}%`, limit, offset])
    const titles = results[0]
    console.log(`findLength`, bookCount)
    const offsetBack = Math.max(offset - limit, 0)
    const offsetNext = Math.min(offset + limit, parseInt(findLength[0][0].bookCount))
    let showPrevious = true
    if (offset === 0) {
      showPrevious = false
    }
    let showNext = true
    if (offset >= bookCount - limit) {
      showNext = false
    }
    res.status(200).type('text/html')
    res.render('results', {
      alpha,
      titles,
      showPrevious,
      showNext,
      offsetBack: offsetBack,
      offsetNext: offsetNext,
    })
  } catch (err) {
    console.log(err)

  } finally {
    connection.release()
  }
})

// load landing apge
app.get('/', (req, res) => {
  const alphaSeq = generateAlphaSeq()
  res.status(200).type('text/html')
  res.render('landing', {
    alphaSeq
  })
})



// check if DB is online and connectionPool
pool.getConnection().then(conn => {
  console.info('pinging database')
  const p0 = Promise.resolve(conn)
  const p1 = Promise.resolve(conn.ping())
  return Promise.all([p0, p1])
}).then((results) => {
  // release the connection
  results[0].release()
  // start the server
  app.listen(PORT, () => {
    console.log(`APP listening on ${PORT} at http://localhost:${PORT}`)
  })
}).catch((e) => {
  console.log(`error:`, e)
})
