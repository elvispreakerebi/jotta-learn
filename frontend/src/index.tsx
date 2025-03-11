import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import axios from "axios";

// Set Axios defaults based on the environment
axios.defaults.baseURL = "http://localhost:5000";
//   process.env.NODE_ENV === "production"
//     ? "https://jotta.onrender.com" // In production, Axios will default to the same domain as the frontend
//     : "http://localhost:3000"; // Use your backend's development URL
axios.defaults.withCredentials = true; // Include credentials for all requests

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();