import { useEffect } from "react";
import { connectSocket } from "./services/socket";

function App() {
  useEffect(() => {
    const socket = connectSocket();

    return () => socket.close();
  }, []);

  return (
    <div>
      <h1>El Impostor</h1>
      <p>Frontend conectado al backend</p>
    </div>
  );
}

export default App;
