import React from "react";
import { createServer } from "http";
import { readFile, readdir } from "fs/promises";
import sanitizeFilename from "sanitize-filename";
import ReactMarkdown from "react-markdown";
import readDirectory from "../utils/readdir.js";
// This is a server to host data-local resources like databases and RSC.

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log("in rsc server, incoming req.url made into a URL: ", url);
  try {
    await sendJSX(res, <Router url={url} />);
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8081);
// determines jsx
function Router({ url }) {
  let page;
  if (url.pathname === "/") {
    page = <BlogIndexPage />;
  } else {
    const postSlug = sanitizeFilename(url.pathname.slice(1));
    page = <BlogPostPage postSlug={postSlug} />;
  }
  return (
    <BlogLayout>
      {<React.Fragment key={url.pathname}>{page}</React.Fragment>}
    </BlogLayout>
  );
}

async function BlogIndexPage() {
  async function getPostSlugs() {
    const directoryPath = "./posts";
    const postFiles = await readDirectory(directoryPath);
    const postSlugs = postFiles.map((file) =>
      file.slice(0, file.lastIndexOf("."))
    );
    return postSlugs;
  }
  const postSlugs = await getPostSlugs();
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

function BlogPostPage({ postSlug }) {
  return (
    <>
      <Post slug={postSlug} />
      <CommentForm slug={postSlug} />
      <Comments slug={postSlug} />
    </>
  );
}

async function Post({ slug }) {
  let content;
  try {
    content = await readFile("./posts/" + slug + ".txt", "utf8");
  } catch (err) {
    throwNotFound(err);
  }
  return (
    <section>
      <h2>
        <a href={"/" + slug}>{slug}</a>
      </h2>
      <article>
        <ReactMarkdown
          children={content}
          components={{
            img: ({ node, ...props }) => (
              <img style={{ maxWidth: "100%" }} {...props} />
            ),
          }}
        />
      </article>
    </section>
  );
}

async function CommentForm({ slug }) {
  return (
    <form id={`${slug}-form`} action={`/${slug}`} method="post">
      <input hidden readOnly name="slug" value={slug} />
      <textarea name="comment" required></textarea>
      <button type="submit">Post Comment</button>
    </form>
  );
}

// async function CommentForm({ slug }) {
//   return (
//     <form
//       id={slug + "-form"}
//       onSubmit={function onSubmitHandler(e) {
//         e.preventDefault();
//         const comment = e.target.elements.comment.value;
//         console.log("in the Comment form; comment: ", comment);
//         // const comments = await readFile(`./comments/${slug}.json`, "utf8");
//         // const commentId = comments.length
//         //   ? comments[comments.length - 1].commentId + 1
//         //   : 1;
//         const newComment = { commentId, text: comment, timestamp: Date.now() };
//         // comments.push(newComment);
//         // await writeFile(
//         //   `./comments/${slug}.json`,
//         //   JSON.stringify(comments),
//         //   "utf8"
//         // );
//       }}>
//       <textarea name="comment" required />
//       <button type="submit">Post Comment</button>
//     </form>
//   );
// }

async function Comments({ slug }) {
  let comments;
  try {
    const commentsFile = await readFile("./comments/comments.json", "utf8");
    const allComments = JSON.parse(commentsFile);
    comments = allComments.filter((comment) => comment.slug === slug);
  } catch (err) {
    console.log("No comments found for post:", slug);
    throwNotFound(err);
  }
  return (
    <section>
      <h2>Comments</h2>
      <ul>
        {comments?.map((comment) => (
          <li key={comment.slug}>
            <p>{comment.comment}</p>
            <p>
              <i>by {comment.author}</i>
            </p>
            <p>at {Date(comment.timestamp)}</p>
          </li>
        ))}
      </ul>
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
    <>
      <footer>
        <hr />
        <p>
          <i>
            (c) {author} {new Date().getFullYear()}
          </i>
        </p>
      </footer>
    </>
  );
}

async function sendJSX(res, jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX);
  res.setHeader("Content-Type", "application/json");
  res.end(clientJSXString);
}

function throwNotFound(cause) {
  const notFound = new Error("Not found.", { cause });
  notFound.statusCode = 404;
  throw notFound;
}
// replacer function
function stringifyJSX(key, value) {
  if (value === Symbol.for("react.element")) {
    return "$RE";
  } else if (typeof value === "string" && value.startsWith("$")) {
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
    return jsx;
  } else if (Array.isArray(jsx)) {
    return Promise.all(jsx.map((child) => renderJSXToClientJSX(child)));
  } else if (jsx != null && typeof jsx === "object") {
    if (jsx.$$typeof === Symbol.for("react.element")) {
      if (jsx.type === Symbol.for("react.fragment")) {
        return renderJSXToClientJSX(jsx.props.children);
      } else if (typeof jsx.type === "string") {
        return {
          ...jsx,
          props: await renderJSXToClientJSX(jsx.props),
        };
      } else if (typeof jsx.type === "function") {
        const Component = jsx.type;
        const props = jsx.props;
        const returnedJsx = await Component(props); // this is where server fetching happens
        return renderJSXToClientJSX(returnedJsx);
      } else {
        console.log("jsx fragment", jsx);
        throw new Error("Not implemented.");
      }
    } else {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(jsx).map(async ([propName, value]) => [
            propName,
            await renderJSXToClientJSX(value),
          ])
        )
      );
    }
  } else {
    console.log("jsx fragment", jsx);
    throw new Error("Not implemented");
  }
}
