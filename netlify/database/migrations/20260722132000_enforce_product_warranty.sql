CREATE OR REPLACE FUNCTION enforce_product_warranty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data = jsonb_set(
    NEW.data,
    '{specs}',
    CASE
      WHEN jsonb_typeof(NEW.data->'specs') = 'object'
        THEN (NEW.data->'specs') || jsonb_build_object('الضمان', 'ضمان حقيقي استبدال لمدة سنتين')
      ELSE jsonb_build_object('الضمان', 'ضمان حقيقي استبدال لمدة سنتين')
    END,
    TRUE
  );
  RETURN NEW;
END;
$$;

UPDATE products
SET
  data = jsonb_set(
    data,
    '{specs}',
    CASE
      WHEN jsonb_typeof(data->'specs') = 'object'
        THEN (data->'specs') || jsonb_build_object('الضمان', 'ضمان حقيقي استبدال لمدة سنتين')
      ELSE jsonb_build_object('الضمان', 'ضمان حقيقي استبدال لمدة سنتين')
    END,
    TRUE
  );

DROP TRIGGER IF EXISTS products_enforce_warranty ON products;

CREATE TRIGGER products_enforce_warranty
BEFORE INSERT OR UPDATE OF data ON products
FOR EACH ROW
EXECUTE FUNCTION enforce_product_warranty();
