import { createServer } from "http";
import { readFile, readdir } from "fs/promises";
import escapeHtml from "escape-html";
import sanitizeFilename from "sanitize-filename";
const PORT = 8080;
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(url);
  // if first load, client is requested by index page, sendScript is a dummy script
  if (url.pathname === "/client.js") {
    sendScript(res, "./client.js");
    return;
  }

  try {
    if (url.searchParams.has("jsx")) {
      url.searchParams.delete("jsx");
      // RSC (lives in window.__INITIAL_CLIENT_JSX_STRING__)
      await sendJSX(res, <Router url={url} />);
    } else {
      // SSR (1st load)
      await sendHTML(res, <Router url={url} />);
    }
  } catch (err) {
    console.error(err);
    res.writeHead(err.statusCode ?? 500);
    res.end();
  }
}).listen(PORT);

async function sendScript(res, filename) {
  const content = await readFile(filename, "utf8");
  res.writeHead(200, { "Content-Type": "text/javascript" });
  res.end(content);
}

// control flow takes req.url and returns page
function Router({ url }) {
  let page;
  if (url.pathname === "/") {
    page = <BlogIndexPage />;
  } else if (!url.pathname.includes(".")) {
    const postSlug = sanitizeFilename(url.pathname.slice(1));
    page = <BlogPostPage postSlug={postSlug} />;
  } else {
    const notFound = new Error("Not found.");
    notFound.statusCode = 404;
    throw notFound;
  }
  return <BlogLayout>{page}</BlogLayout>;
}

// async components
async function BlogIndexPage() {
  const postFiles = await readdir("./posts");
  const postSlugs = postFiles.map((file) =>
    file.slice(0, file.lastIndexOf("."))
  );
  return (
    <section>
      <h1>Welcome to my blog</h1>
      <div>
        {postSlugs.map((slug) => (
          <Post key={slug} slug={slug} />
        ))}
      </div>
    </section>
  );
}

function BlogPostPage({ postSlug, postContent }) {
  return <Post slug={postSlug} />;
}

async function Post({ slug }) {
  const content = await readFile("./posts/" + slug + ".txt", "utf8");
  return (
    <section>
      <h2>
        <a href={"/" + slug}>{slug}</a>
      </h2>
      <article>{content}</article>
    </section>
  );
}

function BlogLayout({ children }) {
  const author = "Jae Doe";
  return (
    <html>
      <head>
        <title>My blog</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <hr />
          <input />
          <hr />
        </nav>
        <main>{children}</main>
        <Footer author={author} />
      </body>
    </html>
  );
}

function Footer({ author }) {
  return (
    <footer>
      {author} {new Date().getFullYear()}!
    </footer>
  );
}

async function sendJSX(res, jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(clientJSXString);
}

function stringifyJSX(key, value) {
  if (value === Symbol.for("react.element")) {
    // We can't pass a symbol, so pass our magic string instead.
    return "$RE"; // Could be arbitrary. I picked RE for React Element.
  } else if (typeof value === "string" && value.startsWith("$")) {
    // To avoid clashes, prepend an extra $ to any string already starting with $.
    return "$" + value;
  } else {
    return value;
  }
}

async function renderJSXToClientJSX(jsx) {
  if (
    typeof jsx === "string" ||
    typeof jsx === "number" ||
    typeof jsx === "boolean" ||
    jsx == null
  ) {
    // Don't need to do anything special with these types.
    return jsx;
  } else if (Array.isArray(jsx)) {
    // Process each item in an array.
    return Promise.all(jsx.map((child) => renderJSXToClientJSX(child)));
  } else if (jsx != null && typeof jsx === "object") {
    if (jsx.$$typeof === Symbol.for("react.element")) {
      if (typeof jsx.type === "string") {
        // This is a component like <div />.
        // Go over its props to make sure they can be turned into JSON.
        return {
          ...jsx,
          props: await renderJSXToClientJSX(jsx.props),
        };
      } else if (typeof jsx.type === "function") {
        // This is a custom React component (like <Footer />).
        // Call its function, and repeat the procedure for the JSX it returns.
        const Component = jsx.type;
        const props = jsx.props;
        const returnedJsx = await Component(props);
        return renderJSXToClientJSX(returnedJsx);
      } else throw new Error("Not implemented.");
    } else {
      // This is an arbitrary object (for example, props, or something inside of them).
      // Go over every value inside, and process it too in case there's some JSX in it.
      return Object.fromEntries(
        await Promise.all(
          Object.entries(jsx).map(async ([propName, value]) => [
            propName,
            await renderJSXToClientJSX(value),
          ])
        )
      );
    }
  } else throw new Error("Not implemented");
}

// dual purpose SSR and client-side hydration
// we could effectively rename it sendHTMLAndJSX
// sends what is in the html variable to / endpoint on port server is serving
// sends __INITIAL_CLIENT_JSX_STRING__ to the window
async function sendHTML(res, jsx) {
  let html = await renderJSXToHTML(jsx);

  // Serialize the JSX payload after the HTML to avoid blocking paint:
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX, 2);
  html += `<script>window.__INITIAL_CLIENT_JSX_STRING__ = `;
  html += JSON.stringify(clientJSXString).replace(/</g, "\\u003c"); // Escape the string
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
  `;
  // console.log(html);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

// async function sendHTML(res, jsx) {
//   let body = await renderJSXToHTML(jsx);
//   let html = `
//   <!DOCTYPE html>
//   <html>
//     <head>
//       <script type="module" src="/client.js"></script>
//     </head>
//     <body>
//       ${body}
//     </body>
//   </html>
//   `;
//   res.writeHead(200, { "Content-Type": "text/html" });
//   res.end(html);
// }

// async vanilla render function (wait for async Component to fetch own data)
async function renderJSXToHTML(jsx) {
  if (typeof jsx === "string" || typeof jsx === "number") {
    return escapeHtml(jsx);
  } else if (jsx == null || typeof jsx === "boolean") {
    return "";
  } else if (Array.isArray(jsx)) {
    const childHtmls = await Promise.all(
      jsx.map((child) => renderJSXToHTML(child))
    );
    let html = "";
    let wasTextNode = false;
    let isTextNode = false;
    for (let i = 0; i < jsx.length; i++) {
      isTextNode = typeof jsx[i] === "string" || typeof jsx[i] === "number";
      if (wasTextNode && isTextNode) {
        html += "<!-- -->";
      }
      html += childHtmls[i];
      wasTextNode = isTextNode;
    }
    return html;
  } else if (typeof jsx === "object") {
    if (jsx.$$typeof === Symbol.for("react.element")) {
      if (typeof jsx.type === "string") {
        // Is this a tag like <div>?
        // Existing code that handles HTML tags (like <p>).
        let html = "<" + jsx.type;
        for (const propName in jsx.props) {
          if (jsx.props.hasOwnProperty(propName) && propName !== "children") {
            html += " ";
            html += propName;
            html += "=";
            html += escapeHtml(jsx.props[propName]);
          }
        }
        html += ">";
        html += await renderJSXToHTML(jsx.props.children);
        html += "</" + jsx.type + ">";
        return html;
      } else if (typeof jsx.type === "function") {
        // Is it a component like <BlogPostPage>?
        const Component = jsx.type;

        const props = jsx.props;
        // jsx ast returned from component function due to babel react plugin
        const returnedJsx = await Component(props);
        // recursively render jsx ast to html string
        return await renderJSXToHTML(returnedJsx);
      } else throw new Error("Not implemented.");
    } else throw new Error("Cannot render an object.");
  } else throw new Error("Not implemented.");
}
