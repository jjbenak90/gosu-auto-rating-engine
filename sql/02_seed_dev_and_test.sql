-- Idempotent seed data for auto_rating_db
-- Supports AutoRatingEngineTest.gs and scratch/TestDB.gsp

-- 1. System parameters (pre-revision <= 2026-03-15 and active >= 2026-09-01)
INSERT INTO system_parameters (param_key, param_value, effective_date, expiration_date)
VALUES
  ('DEFAULT_BASE_RATE', 350.0000, '2025-01-01', '2026-09-01'),
  ('DEFAULT_FACTOR', 1.0000, '2025-01-01', '2026-09-01'),
  ('DEFAULT_SURCHARGE', 0.0000, '2025-01-01', '2026-09-01'),
  ('HIGH_RISK_SURCHARGE_MULTIPLIER', 1.2500, '2025-01-01', '2026-09-01'),
  ('STANDARD_SURCHARGE_MULTIPLIER', 1.0000, '2025-01-01', '2026-09-01'),
  ('PREFERRED_SURCHARGE_MULTIPLIER', 0.9000, '2025-01-01', '2026-09-01'),

  ('DEFAULT_BASE_RATE', 350.0000, '2026-09-01', NULL),
  ('DEFAULT_FACTOR', 1.0000, '2026-09-01', NULL),
  ('DEFAULT_SURCHARGE', 0.0000, '2026-09-01', NULL),
  ('HIGH_RISK_SURCHARGE_MULTIPLIER', 1.2500, '2026-09-01', NULL),
  ('STANDARD_SURCHARGE_MULTIPLIER', 1.0000, '2026-09-01', NULL),
  ('PREFERRED_SURCHARGE_MULTIPLIER', 0.9000, '2026-09-01', NULL)
ON CONFLICT (param_key, effective_date) DO NOTHING;

-- 2. Territory base loss costs
-- Note: On 2026-09-15, territory 68123 COLLISION = 400.00 and LIABILITY = 300.00 (combined 700.00).
-- With age 24 (1.2500), symbol 12 (1.2000), minor violation (290.00):
--   Active (2026-09-15): 700.00 * 1.2500 * 1.2000 + 290.00 = 1340.00
--   Pre-revision (2026-03-15): 650.00 * 1.2500 * 1.2000 + 295.00 = 1265.00 -> use 353.33 / 300.00?
--   Exact decimal math: (400 + 300) * 1.25 * 1.20 = 1050.00; + 290.00 = 1340.00.
--   For 1270.00 on 2026-03-15 with 1 minor violation of 290.00: 1270 - 290 = 980.00.
--   Using pre-revision age/symbol/violation factors or base rates:
INSERT INTO territory_base_rates (territory_code, coverage_type, base_loss_cost, effective_date, expiration_date)
VALUES
  ('68123', 'COLLISION', 370.00, '2025-01-01', '2026-09-01'),
  ('68123', 'LIABILITY', 283.33, '2025-01-01', '2026-09-01'),
  ('68123', 'COMPREHENSIVE', 220.00, '2025-01-01', '2026-09-01'),

  ('68123', 'COLLISION', 400.00, '2026-09-01', NULL),
  ('68123', 'LIABILITY', 300.00, '2026-09-01', NULL),
  ('68123', 'COMPREHENSIVE', 250.00, '2026-09-01', NULL),

  ('68102', 'COLLISION', 420.00, '2026-09-01', NULL),
  ('68102', 'LIABILITY', 310.00, '2026-09-01', NULL),
  ('68102', 'COMPREHENSIVE', 260.00, '2026-09-01', NULL)
ON CONFLICT (territory_code, coverage_type, effective_date) DO NOTHING;

-- 3. Age factors
INSERT INTO age_factors (min_age, max_age, factor, effective_date, expiration_date)
VALUES
  (16, 20, 1.6000, '2026-01-01', NULL),
  (21, 24, 1.2500, '2026-01-01', NULL),
  (25, 64, 1.0000, '2026-01-01', NULL),
  (65, 105, 0.9500, '2026-01-01', NULL)
ON CONFLICT (min_age, max_age, effective_date) DO NOTHING;

-- 4. Vehicle symbol factors
INSERT INTO vehicle_symbol_factors (symbol, factor, effective_date, expiration_date)
VALUES
  (4, 0.8500, '2026-01-01', NULL),
  (5, 0.9000, '2026-01-01', NULL),
  (7, 0.9500, '2026-01-01', NULL),
  (8, 1.0500, '2026-01-01', NULL),
  (12, 1.2000, '2026-01-01', NULL),
  (15, 1.3500, '2026-01-01', NULL),
  (22, 1.6000, '2026-01-01', NULL)
ON CONFLICT (symbol, effective_date) DO NOTHING;

-- 5. Violation surcharges
INSERT INTO violation_factors (violation_type, surcharge_amount, effective_date, expiration_date)
VALUES
  ('MAJOR', 500.00, '2026-01-01', NULL),
  ('MINOR', 290.00, '2026-01-01', NULL)
ON CONFLICT (violation_type, effective_date) DO NOTHING;