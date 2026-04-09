import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env["REPLIT_DOMAINS"] ?? "")
  .split(",")
  .map(d => `https://${d.trim()}`)
  .filter(Boolean);

const isDev = process.env["NODE_ENV"] !== "production";

app.use(cors({
  credentials: true,
  origin: isDev
    ? (origin, cb) => cb(null, true) // allow all in local dev
    : allowedOrigins.length > 0
      ? (origin, cb) => {
          if (!origin || allowedOrigins.some(o => origin === o || origin === `${o}/`)) {
            cb(null, true);
          } else {
            cb(new Error(`CORS blocked: ${origin}`));
          }
        }
      : false,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const isProd = process.env["NODE_ENV"] === "production";

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret && isProd) {
  throw new Error("SESSION_SECRET environment variable is required in production but was not provided.");
}
const effectiveSecret = sessionSecret ?? "dev-only-secret-not-for-production-use";

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: effectiveSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

export default app;
