const clientGlobals = {
  // must include slash
  clientHostPrefix : process.env.CMDBHOSTPREFIX ||  'http://localhost:8222/',
};
const globals = {
  port : process.env.CMDBPORT || 8222,
  dbuser : process.env.CMDBUSER || "cmdb",
  dbpass : process.env.CMDBPASS ||  '7^!2Ujd8oJQn',
  dbhost : process.env.CMDBHOST ||  'localhost',
  dbschema : process.env.CMDBSCHEMA ||  'tenfour_cmdb',
};

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  maxHttpBufferSize: 5000000, // make big enough to support import/export of whole server state.
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

app.get('/config.json', (req, res) => {
  console.log(`served /config.json`);
  res.json(clientGlobals);
});

// Start the server with Socket.IO support
http.listen(globals.port, () => {
  console.log(`Server is listening on port ${globals.port}`);
});

