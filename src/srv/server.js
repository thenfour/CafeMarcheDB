
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const Sequelize = require('sequelize');
const sequelize = new Sequelize('cmdb', 'cmdb', '7^!2Ujd8oJQn', {
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

