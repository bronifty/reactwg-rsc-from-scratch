import { createServer } from "http";
import { readFile, readdir } from "fs/promises";
import escapeHtml from "escape-html";
import sanitizeFilename from "sanitize-filename";

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // send HTML to response for page Router determines by req.url
    await sendHTML(res, <Router url={url} />);
  } catch (err) {
    console.error(err);
    res.writeHead(err.statusCode ?? 500);
    res.end();
  }
}).listen(8080);

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
      {author} {new Date().getFullYear()}
    </footer>
  );
}
// ...
// adapter
async function sendHTML(res, jsx) {
  const html = await renderJSXToHTML(jsx);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

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
    return childHtmls.join("");
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
