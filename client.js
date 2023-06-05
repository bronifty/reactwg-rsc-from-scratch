// import React from "https://esm.sh/react@canary";
import ReactDOM, { hydrateRoot } from "https://esm.sh/react-dom@canary/client";
// import { hydrateRoot } from "react-dom/client";
let currentPathname = window.location.pathname;

const root = hydrateRoot(document, getInitialClientJSX());

function getInitialClientJSX() {
  const clientJSX = JSON.parse(window.__INITIAL_CLIENT_JSX_STRING__, parseJSX);
  return clientJSX;
}
async function navigate(pathname) {
  currentPathname = pathname;
  const clientJSX = await fetchClientJSX(pathname);
  if (pathname === currentPathname) {
    root.render(clientJSX);
  }
}

async function fetchClientJSX(pathname) {
  const response = await fetch(pathname + "?jsx");
  const clientJSXString = await response.text();
  const clientJSX = JSON.parse(clientJSXString, parseJSX);
  return clientJSX;
}

function parseJSX(key, value) {
  if (value === "$RE") {
    // This is our special marker we added on the server.
    // Restore the Symbol to tell React that this is valid JSX.
    return Symbol.for("react.element");
  } else if (typeof value === "string" && value.startsWith("$$")) {
    // This is a string starting with $. Remove the extra $ added by the server.
    return value.slice(1);
  } else {
    return value;
  }
}

// async function navigate(pathname) {
//   currentPathname = pathname;
//   const response = await fetch(pathname + "?jsx");
//   const jsonString = await response.text();
//   if (pathname === currentPathname) {
//     alert(jsonString);
//   }
// }

// async function navigate(pathname) {
//   currentPathname = pathname;
//   // Fetch HTML for the route we're navigating to.
//   const response = await fetch(pathname);
//   const html = await response.text();

//   if (pathname === currentPathname) {
//     // Get the part of HTML inside the <body> tag.
//     const bodyStartIndex = html.indexOf("<body>") + "<body>".length;
//     const bodyEndIndex = html.lastIndexOf("</body>");
//     const bodyHTML = html.slice(bodyStartIndex, bodyEndIndex);

//     // Replace the content on the page.
//     document.body.innerHTML = bodyHTML;
//   }
// }

window.addEventListener(
  "click",
  (e) => {
    // Only listen to link clicks.
    if (e.target.tagName !== "A") {
      return;
    }
    // Ignore "open in a new tab".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    // Ignore external URLs.
    const href = e.target.getAttribute("href");
    if (!href.startsWith("/")) {
      return;
    }
    // Prevent the browser from reloading the page but update the URL.
    e.preventDefault();
    window.history.pushState(null, null, href);
    // Call our custom logic.
    navigate(href);
  },
  true
);

window.addEventListener("popstate", () => {
  // When the user presses Back/Forward, call our custom logic too.
  navigate(window.location.pathname);
});
