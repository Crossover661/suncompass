import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as sc from "./src/suncalc.js";

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/subsolar-point", (req, res) => {
    const sunPosition = sc.subsolarPoint();
    res.json(sunPosition);
});

app.listen(port, () => {console.log("Server running at http://localhost:${port}");});