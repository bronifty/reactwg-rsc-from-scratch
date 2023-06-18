import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import handleComment from "../utils/comment.cjs";
// import handleComment from "../utils/comment.js";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/client.js") {
      console.log("url.pathname === '/client.js'", url);

      const content = await readFile("./client.js", "utf8");
      res.setHeader("Content-Type", "text/javascript");
      res.end(content);
      return;
    }
    if (req.method === "POST") {
      console.log("req.method === 'POST'", url);
      await handleComment(req, res, url);
      res.end("ok");
      return;
    }
    // if (url.searchParams.has("slug")) {
    //   console.log("url.searchParams.has('slug')");
    //   await handleComment(req, res, url);
    //   // res.end();
    //   console.log("url ", url);
    //   // Assuming url is the URL object
    //   // url.pathname = url.searchParams.get("slug");
    //   // url.searchParams.append("jsx", "");
    //   res.end();
    // }
    const slug = url.pathname;
    console.log(
      "in ssr server about to make a call to rsc with url.pathname as slug: ",
      slug
    );
    const response = await fetch("http://127.0.0.1:8081" + url.pathname);
    if (!response.ok) {
      res.statusCode = response.status;
      res.end();
      return;
    }
    const clientJSXString = await response.text();
    // console.log(
    //   "back in ssr server with response from rsc of clientJSXString; clientJSXString: ",
    //   clientJSXString
    // );
    if (url.searchParams.has("jsx")) {
      console.log(
        "in ssr server with response from rsc of clientJSXString; url.searchParams.has('jsx')"
      );
      res.setHeader("Content-Type", "application/json");
      res.end(clientJSXString);
    } else {
      const clientJSX = JSON.parse(clientJSXString, parseJSX);
      console.log(
        "back in ssr server with response from rsc of clientJSX; clientJSX: ",
        clientJSX
      );
      let html = renderToString(clientJSX);
      html += `<script>window.__INITIAL_CLIENT_JSX_STRING__ = `;
      html += JSON.stringify(clientJSXString).replace(/</g, "\\u003c");
      html += `</script>`;
      html += `
        <script type="importmap">
          {
            "imports": {
              "react": "https://esm.sh/react@canary",
              "react-dom/client": "https://esm.sh/react-dom@canary/client"
            }
          }
        </script>
        <script type="module" src="/client.js"></script>
        <script>
        function getRandomColor() {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }

        document.body.style.backgroundColor = getRandomColor();
    </script>
    <style>
        body {
            /* Transition the background-color property over 1 second */
            transition: background-color 1s;
        }
    </style>
      `;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8080);
// reviver function
function parseJSX(key, value) {
  if (value === "$RE") {
    return Symbol.for("react.element");
  } else if (typeof value === "string" && value.startsWith("$$")) {
    return value.slice(1);
  } else {
    return value;
  }
}
