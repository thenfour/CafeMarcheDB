import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// const MyComponent = () => {
//   useEffect(() => {
//     // Create a WebSocket connection
//     const socket = io('http://localhost:8222'); // Replace with your server URL

//     // Event listeners
//     socket.on('connect', () => {
//       console.log('Connected to server');
//     });

//     socket.on('message', (data) => {
//       console.log('Received message:', data);
//     });

//     // Cleanup on unmount
//     return () => {
//       // Disconnect the WebSocket connection
//       socket.disconnect();
//     };
//   }, []);

//   // ...rest of your component code...
// };



// const AjaxButton = () => {
  
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         // if served static (npm run start), then this is a static file (see /public/config.json)
//         // if served from ExpressJS, this file is overridden by a dynamic route.
//         const response = await fetch('config.json');
//         await sleep(2000);
//         const json = await response.json();
//         setData(json);
//       } catch (error) {
//         console.error('Error fetching data:', error);
//       }
//     };

//     fetchData();
//   }, []);

//   return (
//     <div>
//       {data ? (
//         <button>{JSON.stringify(data)}</button>
//       ) : (
//         <span>Loading...</span>
//       )}
//     </div>
//   );
// };




// function App() {
//   const [data, setData] = useState(null);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         // if served static (npm run start), then this is a static file (see /public/config.json)
//         // if served from ExpressJS, this file is overridden by a dynamic route.
//         const response = await fetch('config.json');
//         await sleep(500);
//         const json = await response.json();
//         setData(json);
//       } catch (error) {
//         console.error('Error fetching data:', error);
//       }
//     };

//     fetchData();
//   }, []);


//   return (
//     <div>
//       {data ? (
//         JSON.stringify(data)
//       ) : (
//         <span>Loading...</span>
//       )}
//     </div>
//   );
// }



async function App() {
  const response = await fetch('config.json');
  const json = await response.json();
  return (<div>{JSON.stringify(json)}</div>);
}

export default App;
