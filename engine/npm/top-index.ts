export type TopIndex = ReadonlySet<string>;

export const POPULAR_NAMES: string[] = [
  "lodash", "express", "chalk", "debug", "commander", "axios", "react", "vite",
  "typescript", "jest", "webpack", "babel", "fs-extra", "promise", "request",
  "moment", "lodash-es", "rimraf", "xmldom", "node-fetch", "qs", "tsx",
  "terser", "axios-retry", "superagent", "got", "json-schema", "mongodb",
  "mysql", "json5", "postcss", "bootstrap", "vue", "moment-timezone", "path",
  "semver", "strip-ansi", "chalk-template", "picocolors", "yargs-parser",
  "cross-fetch", "cross-spawn", "minimist", "mkdirp", "ansi-regex", "graceful-fs",
  "minimatch", "async", "request-promise-core", "bluebird", "colors",
  "execa", "resolve", "eslint-config-prettier", "prettier", "nodemon",
  "dotenv", "bcrypt", "jsonwebtoken", "prisma", "mongoose", "pg", "sqlite3",
  "redis", "socket.io", "ws", "core-js", "regenerator-runtime", "dayjs",
  "immer", "zustand", "redux", "react-dom", "react-router", "styled-components",
  "sentry", "eslint", "concurrently", "husky", "lint-staged", "inquirer",
  "ora", "glob", "which", "uuid", "yaml", "js-yaml", "totalist",
  "fastify", "hapi", "tar", "readable-stream", "safe-buffer", "underscore",
  "validate-npm-package-name", "traverse", "tmp", "is-docker", "ssri",
  "simple-git", "fast-json-patch", "command-line-args", "zod", "joi",
  "multer", "swagger-ui-express", "compression", "cors", "helmet",
  "cookie-parser", "body-parser", "consolidate", "cli-spinners", "terminal-image"
];

export const TOP_INDEX: TopIndex = new Set(POPULAR_NAMES);
