
const express = require('express');
const app = express();
const port = process.env.CMDBPORT || 8222;
const dbuser = process.env.CMDBUSER || "cmdb";
const dbpass = process.env.CMDBPASS ||  '7^!2Ujd8oJQn';
const dbhost = process.env.CMDBHOST ||  'localhost';
const dbschema = process.env.CMDBSCHEMA ||  'tenfour_cmdb';

const Sequelize = require('sequelize');
const sequelize = new Sequelize('tenfour_cmdb', dbuser, dbpass, {
  host: 'localhost',
  dialect: 'mysql',
});

const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Define your models here

// Test the database connection
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error);
  });

io.on('message', (data) => {
  console.log(`websocket recv from client: ${data}`);
});

// Middleware
app.use(express.json());
app.use(express.static('../client/build'));

// default doc
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
});

// Start the server with Socket.IO support
http.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

