-- 095: "Arma tu combo" under the business's own name.
-- NULL keeps the defaults ("Arma tu combo" and its line under it).
ALTER TABLE businesses
  ADD COLUMN combo_builder_name VARCHAR(40),
  ADD COLUMN combo_builder_description VARCHAR(120);
