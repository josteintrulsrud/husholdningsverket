-- Detaljer på varene i handlelistene
ALTER TABLE shopping_items ADD COLUMN note TEXT;              -- «laktosefri», «den store pakken»
ALTER TABLE shopping_items ADD COLUMN last_price_ore INTEGER; -- mat: sist betalt, fra kvitteringene
ALTER TABLE shopping_items ADD COLUMN last_price_store TEXT;  -- mat: butikken på den kvitteringen
ALTER TABLE shopping_items ADD COLUMN place TEXT;             -- hus og hjem: butikk eller lenke
ALTER TABLE shopping_items ADD COLUMN price_ore INTEGER;      -- hus og hjem: omtrentlig pris
ALTER TABLE shopping_items ADD COLUMN assigned_to TEXT REFERENCES users(id); -- hus og hjem: hvem som tar det
