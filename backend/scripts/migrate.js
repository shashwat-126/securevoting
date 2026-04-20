const path = require("path");
const dotenv = require("dotenv");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env";

dotenv.config({
  path: path.resolve(process.cwd(), envFile)
});

const bcrypt = require("bcrypt");
const db     = require("../src/config/db");