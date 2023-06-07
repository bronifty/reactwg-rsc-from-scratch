import { writeFile, readFile } from "node:fs/promises";
// import { Buffer } from "node:buffer";
// {
//   "commentId": 1,
//   "content": "This is a comment",
//   "author": "John Doe",
//   "timestamp": 1234567890,
//   "postId": "cat-api"
// }

async function commentWriter({ slug, comment, author }) {
  const commentsJSON = await readFile(`./comments/comments.json`, "utf8");
  console.log("commentsJSON: ", commentsJSON);
  // const commentsJSON = await readFile(
  //   `./comments/comments-${slug}.json`,
  //   "utf8"
  // );
  const comments = JSON.parse(commentsJSON);
  const commentId = comments.length
    ? comments[comments.length - 1].commentId + 1
    : 1;
  const newComment = {
    postId: slug,
    content: comment,
    author,
    commentId,
    timestamp: Date.now(),
  };
  // console.log("comments: ", comments, "newComment: ", newComment);
  comments.push(newComment);
  await writeFile(`./comments/comments.json`, JSON.stringify(comments), "utf8");
  // await writeFile(
  //   `./comments/comments-${slug}.json`,
  //   JSON.stringify(comments),
  //   "utf8"
  // );
}

export default commentWriter;

// writeComment({
//   slug: "hello-world",
//   comment: "This is a comment from the commentWriter.js file",
//   author: "John Doe",
// });

// try {
//   const controller = new AbortController();
//   const { signal } = controller;
//   const data = new Uint8Array(Buffer.from("2. Hello Node.js"));
//   const promise = writeFile("message.txt", data, { signal });

//   // Abort the request before the promise settles.
//   // controller.abort();

//   await promise;
// } catch (err) {
//   // When a request is aborted - err is an AbortError
//   console.error(err);
// }
