-- Bilde av kvitteringen, lagret i R2 (binding RECEIPTS). Kolonnen holder nøkkelen.
ALTER TABLE transactions ADD COLUMN receipt_image TEXT;
