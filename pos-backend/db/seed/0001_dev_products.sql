-- Datos de desarrollo. No usar en producción.
insert into products (id, name, category, unit_price_cents, central_stock) values
  ('11111111-1111-4111-8111-111111111111', 'Agua 600 ml',      'Bebidas',  1500, 200),
  ('22222222-2222-4222-8222-222222222222', 'Refresco 355 ml',  'Bebidas',  2200, 150),
  ('33333333-3333-4333-8333-333333333333', 'Cerveza 355 ml',   'Bebidas',  4500, 300),
  ('44444444-4444-4444-8444-444444444444', 'Papas fritas',     'Snacks',   2500, 80),
  ('55555555-5555-4555-8555-555555555555', 'Hot dog',          'Comida',   5500, 60)
on conflict (id) do nothing;

insert into devices (id, name) values ('dev-local-1', 'Emulador de desarrollo')
on conflict (id) do nothing;
