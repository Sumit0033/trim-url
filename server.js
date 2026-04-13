const app = require("./app");

const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");

app.listen(port, () => {
  console.log(`URL shortener running on ${baseUrl}`);
});
