import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";

function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;
