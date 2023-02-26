import "./main.css";
import "./main.reg";

document.querySelector("#root")!.innerHTML = '<app- />';


if (import.meta.env.PROD) {
  console.log("PRODUCTION");
} else {
  console.log("DEVELOPMENT");
}