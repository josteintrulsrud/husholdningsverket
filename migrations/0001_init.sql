-- Husholdningsverket – databasen (Cloudflare D1 / SQLite)
-- Beløp lagres i ØRE som heltall. ID-er er tekst (crypto.randomUUID()).

-- Brukere og tilgang -------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT,
  is_superadmin INTEGER NOT NULL DEFAULT 0,   -- gir IKKE tilgang til økonomidata
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eneste vei til en husholdnings data
CREATE TABLE household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('eier','medlem')),
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE invitations (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email        TEXT NOT NULL COLLATE NOCASE,
  role         TEXT NOT NULL CHECK (role IN ('eier','medlem')),
  token_hash   TEXT NOT NULL UNIQUE,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,               -- hash av cookie-verdien
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Økonomi ---------------------------------------------------------------------
CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('utgift','inntekt','sparing','overføring')),
  budget_ore   INTEGER NOT NULL DEFAULT 0,
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE category_rules (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  match_text   TEXT NOT NULL,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),  -- hvem transaksjonen tilhører (brukes i «Måneden din»)
  date            TEXT NOT NULL,
  amount_ore      INTEGER NOT NULL,                    -- negativ = utgift
  description     TEXT NOT NULL,
  bank_text       TEXT,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  categorized_by  TEXT CHECK (categorized_by IN ('regel','ai','manuell')),
  receipt_json    TEXT,                                -- butikk og varer fra skannet kvittering
  receipt_pending INTEGER NOT NULL DEFAULT 0,          -- kvittering som venter på kortkjøpet fra banken
  dedupe_hash     TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, dedupe_hash)
);

CREATE TABLE savings_goals (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  target_ore   INTEGER NOT NULL,
  saved_ore    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Handlelister ----------------------------------------------------------------
CREATE TABLE shopping_items (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  list         TEXT NOT NULL CHECK (list IN ('mat','hjem')),
  text         TEXT NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  added_by     TEXT REFERENCES users(id),
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  done_by      TEXT REFERENCES users(id),
  done_at      TEXT
);

CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,
  household_id TEXT,
  user_id      TEXT,
  action       TEXT NOT NULL,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_members_user     ON household_members(user_id);
CREATE INDEX idx_tx_hh_date       ON transactions(household_id, date);
CREATE INDEX idx_tx_hh_cat        ON transactions(household_id, category_id);
CREATE INDEX idx_rules_hh         ON category_rules(household_id);
CREATE INDEX idx_cats_hh          ON categories(household_id);
CREATE INDEX idx_shop_hh_list     ON shopping_items(household_id, list);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_invites_hh       ON invitations(household_id);
