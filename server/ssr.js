import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import commentWriter from "../utils/commentWriter.js";

// This is a server to host CDN distributed resources like static files and SSR.

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.searchParams.has("slug")) {
      await handleComment(req, res, url);
    }

    if (url.pathname === "/client.js") {
      const content = await readFile("./client.js", "utf8");
      res.setHeader("Content-Type", "text/javascript");
      res.end(content);
      return;
    }
    const response = await fetch("http://127.0.0.1:8081" + url.pathname);
    if (!response.ok) {
      res.statusCode = response.status;
      res.end();
      return;
    }
    const clientJSXString = await response.text();
    if (url.searchParams.has("jsx")) {
      res.setHeader("Content-Type", "application/json");
      res.end(clientJSXString);
    } else {
      const clientJSX = JSON.parse(clientJSXString, parseJSX);
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

function parseUrlEncodedData(data) {
  const pairs = data.split("&");
  const result = {};
  for (let pair of pairs) {
    const [key, value] = pair.split("=");
    result[decodeURIComponent(key)] = decodeURIComponent(
      value.replace(/\+/g, " ")
    );
  }
  return result;
}

async function handleComment(req, res, url) {
  const slug = url.searchParams.get("slug");
  // console.log("in handleComment: slug: ", slug, "url: ", url);
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    const formData = parseUrlEncodedData(body);
    const comment = formData.comment;
    // ...
    // });

    // req.on("end", async () => {
    // doesn't work trying to convert the body array into a string then parse it into JSON
    // const JSONString = body.split("=")[1];
    // const JSONBody = JSON.parse(JSONString);
    // console.log("JSONBody: ", JSONBody);
    // const comment = body.split("=")[1];
    // const comments = await readFile(`./comments/comments-${slug}.json`, "utf8");
    console.log("body: ", body, "comment: ", comment);
    // console.log("body: ", body, "comment: ", comment, "comments: ", comments);
    // const commentId = comments.length
    //   ? comments[comments.length - 1].commentId + 1
    //   : 1;
    // const newComment = { commentId, text: comment, timestamp: Date.now() };
    // comments.push(newComment);
    // await writeFile(
    //   "./comments/comments-hello-world.json",
    //   JSON.stringify(comments),
    //   "utf8"
    // );
    await commentWriter({
      slug,
      comment,
      author: "John Doe",
    });
    res.end("Comment added successfully.");
  });

  return;
}
