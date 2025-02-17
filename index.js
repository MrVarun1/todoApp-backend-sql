import express from "express";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import cors from "cors";

import router from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

let db;

const initializeDbandServer = async () => {
  try {
    const dataBasePath = path.join(process.cwd(), "database.db");
    console.log(dataBasePath);
    db = await open({
      filename: dataBasePath,
      driver: sqlite3.Database,
    });

    console.log("Connected to SQLite database");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.log("Error:", e);
  }
};

initializeDbandServer();

export { db };
