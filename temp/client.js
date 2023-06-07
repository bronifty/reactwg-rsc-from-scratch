import readDirectory from "../utils/readdir.js";
// Example usage
const directoryPath = "./posts";
readDirectory(directoryPath)
  .then((files) => {
    console.log("Files:", files);
  })
  .catch((error) => {
    console.error("Error:", error);
  });
