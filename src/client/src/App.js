import './App.css';

import React, { useEffect } from 'react';
import io from 'socket.io-client';

const MyComponent = () => {
  useEffect(() => {
    // Create a WebSocket connection
    const socket = io('http://localhost:3000'); // Replace with your server URL

    // Event listeners
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('message', (data) => {
      console.log('Received message:', data);
    });

    // Cleanup on unmount
    return () => {
      // Disconnect the WebSocket connection
      socket.disconnect();
    };
  }, []);

  // ...rest of your component code...
};



function App() {

  //

  return (
    <div className="App">
      <MyComponent></MyComponent>

    </div>
  );
}

export default App;
