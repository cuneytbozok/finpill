begin;
select plan(12);

create temporary table amounts (label text primary key, amount public.exact_decimal);

-- Canonical decimal strings survive a database round-trip unchanged.
insert into amounts values
  ('max', '999999999999999999999999999999.999999999999999999'),
  ('min', '-999999999999999999999999999999.999999999999999999'),
  ('beyond_float', '12345678901234567890123456789'),
  ('kap_capital', '253604600.868'),
  ('tiny', '0.000000000000000001'),
  ('zero', '0');

select is((select amount::text from amounts where label = 'max'),
  '999999999999999999999999999999.999999999999999999', 'upper bound round-trips');
select is((select amount::text from amounts where label = 'min'),
  '-999999999999999999999999999999.999999999999999999', 'lower bound round-trips');
select is((select amount::text from amounts where label = 'beyond_float'),
  '12345678901234567890123456789', 'integers beyond 2^53 round-trip');
select is((select amount::text from amounts where label = 'kap_capital'),
  '253604600.868', 'fractional source value round-trips');
select is((select amount::text from amounts where label = 'tiny'),
  '0.000000000000000001', 'smallest fraction round-trips');
select is((select trim_scale('1.2500'::public.exact_decimal)::text), '1.25',
  'trim_scale yields the canonical form');

-- Out-of-range and non-finite values fail instead of being rounded.
select throws_ok($$insert into amounts values ('big', '1000000000000000000000000000000')$$,
  '23514', null, '31 integer digits are rejected');
select throws_ok($$insert into amounts values ('fine', '0.0000000000000000001')$$,
  '23514', null, '19 fraction digits are rejected, not rounded');
select throws_ok($$insert into amounts values ('nan', 'NaN')$$,
  '23514', null, 'NaN is rejected');
select throws_ok($$insert into amounts values ('inf', 'Infinity')$$,
  '23514', null, 'Infinity is rejected');
select throws_ok($$insert into amounts values ('ninf', '-Infinity')$$,
  '23514', null, '-Infinity is rejected');

-- Sums stay exact where floating point would not.
select is((select (0.1::public.exact_decimal + 0.2::public.exact_decimal)::text), '0.3',
  'numeric addition is exact');

select * from finish();
rollback;
