-- Hvem som skannet kvitteringen. «Mine kvitteringer» er personlig, og en kvittering kan være
-- koblet til et kortkjøp som en annen i husholdningen importerte.
ALTER TABLE transactions ADD COLUMN receipt_user_id TEXT REFERENCES users(id);
UPDATE transactions SET receipt_user_id = user_id WHERE receipt_json IS NOT NULL;
