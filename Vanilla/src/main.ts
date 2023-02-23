import "./app/App";
import "./main.css";

if (import.meta.env.PROD) {
  console.log("PRODUCTION");
} else {
  console.log("DEVELOPMENT");
}

var root = document.querySelector("#root");
var app = document.createElement("app-x");
root?.appendChild(app);
