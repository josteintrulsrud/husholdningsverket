-- Antall og avdeling på varene i handlelistene
ALTER TABLE shopping_items ADD COLUMN qty TEXT;      -- «2», «2 pk», «1,5 kg»
ALTER TABLE shopping_items ADD COLUMN section TEXT;  -- avdeling i butikken (se lib/avdeling.js)

-- Det husholdningen pleier å kjøpe: grunnlaget for hurtigforslag, og husker avdelingen per vare
CREATE TABLE shopping_history (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  list         TEXT NOT NULL CHECK (list IN ('mat','hjem')),
  key          TEXT NOT NULL,                        -- varenavn i små bokstaver
  text         TEXT NOT NULL,                        -- slik det sist ble skrevet
  uses         INTEGER NOT NULL DEFAULT 1,
  last_used    TEXT NOT NULL DEFAULT (datetime('now')),
  section      TEXT,
  PRIMARY KEY (household_id, list, key)
);

INSERT INTO shopping_history (household_id, list, key, text, uses, last_used)
  SELECT household_id, list, lower(trim(text)), max(text), count(*), max(added_at)
  FROM shopping_items GROUP BY household_id, list, lower(trim(text));
