import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync(":memory:");

export const init = () =>
  db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE
  ) STRICT;

  CREATE TABLE event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,

    FOREIGN KEY (participant_id) REFERENCES users(id)
  ) STRICT;
`);
