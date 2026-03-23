import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import router from "./routes";

const app: Express = express();

app.set("trust proxy", 1);

app.use(cors({
  credentials: true,
  origin: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const sessionSecret = process.env["SESSION_SECRET"] ?? "fallback-dev-secret-change-in-production";

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

export default app;
