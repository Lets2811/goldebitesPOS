-- 096: "Arma tu combo" with the business's own look: an HTML/CSS template
-- with markers the app fills in (see the frontend's ComboTemplateFrame). It is
-- shown isolated (a sandboxed iframe), never inside the app's own page.
-- NULL: the default view.
ALTER TABLE businesses
  ADD COLUMN combo_builder_template TEXT,
  ADD CONSTRAINT businesses_combo_builder_template_size_check
    CHECK (combo_builder_template IS NULL OR length(combo_builder_template) <= 200000);
