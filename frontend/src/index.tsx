import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import axios from "axios";

// Set Axios defaults based on the environment
axios.defaults.baseURL = "https://jotta.onrender.com";
// axios.defaults.baseURL = process.env.NODE_ENV === "production"
//   ? "https://jotta.onrender.com"  // Update this to your backend URL
//   : "http://localhost:5000";
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