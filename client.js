let currentPathname = window.location.pathname;

// instead of replacing the body directly, we are going to use a new navigation function that adds jsx search param for the server, which will control flow to a branch that renders JSX to client JSX, meaning, it makes all the server calls first, gets the data in JSX object format and sends it to the client as JSX instead of HTML string
async function navigate(pathname) {
  currentPathname = pathname;
  const response = await fetch(pathname + "?jsx");
  const jsonString = await response.text();
  if (pathname === currentPathname) {
    alert(jsonString);
  }
}

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
