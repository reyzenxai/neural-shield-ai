import winston from "winston";

import { config } from "../config";

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple(),
    ),
  }),
];

// File transports break on read-only serverless filesystems (e.g. Vercel).
// Containers/local (Railway, Render, Docker) keep them.
if (!process.env.VERCEL) {
  transports.push(
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  );
}

/** Application logger: colorized console everywhere + JSON file logs off-serverless. */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports,
});
