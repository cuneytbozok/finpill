-- Exact decimal storage (task 02.04, ADR A06).
--
-- Authoritative amounts use this domain: unconstrained numeric, so no value is
-- ever rounded to fit a declared precision, bounded to the application limits
-- (30 integer digits, 18 fraction digits). NaN and ±Infinity are rejected.
-- Out-of-range values fail; they are never rounded.
--
-- PostgREST serializes numeric as a JSON number, which JavaScript would read
-- as a float. Exact values are therefore read as text, for example
-- `select=amount::text` or `trim_scale(amount)::text` in SQL, and parsed with
-- `parseDecimal`.

create domain public.exact_decimal as numeric
  constraint exact_decimal_range check (
    abs(value) < 1e30 and scale(value) <= 18
  );

comment on domain public.exact_decimal is
  'Exact decimal (A06): unconstrained numeric within 30 integer and 18 fraction digits; never NaN or infinite.';
