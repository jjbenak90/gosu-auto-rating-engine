-- Schema for auto_rating_db (PostgreSQL)
-- Matches DatabaseManager.gs and TestDB.gsp queries

CREATE TABLE IF NOT EXISTS system_parameters (
  id BIGSERIAL PRIMARY KEY,
  param_key VARCHAR(100) NOT NULL,
  param_value NUMERIC(12, 4) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NULL,
  CONSTRAINT uq_system_parameters_key_eff UNIQUE (param_key, effective_date),
  CONSTRAINT chk_system_parameters_dates CHECK (expiration_date IS NULL OR effective_date < expiration_date)
);

CREATE INDEX IF NOT EXISTS idx_system_parameters_lookup
  ON system_parameters (param_key, effective_date DESC);

CREATE TABLE IF NOT EXISTS territory_base_rates (
  id BIGSERIAL PRIMARY KEY,
  territory_code VARCHAR(20) NOT NULL,
  coverage_type VARCHAR(30) NOT NULL,
  base_loss_cost NUMERIC(12, 2) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NULL,
  CONSTRAINT uq_territory_base_rates_key_eff UNIQUE (territory_code, coverage_type, effective_date),
  CONSTRAINT chk_territory_base_rates_dates CHECK (expiration_date IS NULL OR effective_date < expiration_date)
);

CREATE INDEX IF NOT EXISTS idx_territory_base_rates_lookup
  ON territory_base_rates (territory_code, coverage_type, effective_date DESC);

CREATE TABLE IF NOT EXISTS age_factors (
  id BIGSERIAL PRIMARY KEY,
  min_age INT NOT NULL,
  max_age INT NOT NULL,
  factor NUMERIC(10, 4) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NULL,
  CONSTRAINT uq_age_factors_range_eff UNIQUE (min_age, max_age, effective_date),
  CONSTRAINT chk_age_factors_range CHECK (min_age <= max_age),
  CONSTRAINT chk_age_factors_dates CHECK (expiration_date IS NULL OR effective_date < expiration_date)
);

CREATE INDEX IF NOT EXISTS idx_age_factors_lookup
  ON age_factors (min_age, max_age, effective_date DESC);

CREATE TABLE IF NOT EXISTS vehicle_symbol_factors (
  id BIGSERIAL PRIMARY KEY,
  symbol INT NOT NULL,
  factor NUMERIC(10, 4) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NULL,
  CONSTRAINT uq_vehicle_symbol_factors_sym_eff UNIQUE (symbol, effective_date),
  CONSTRAINT chk_vehicle_symbol_factors_dates CHECK (expiration_date IS NULL OR effective_date < expiration_date)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_symbol_factors_lookup
  ON vehicle_symbol_factors (symbol, effective_date DESC);

CREATE TABLE IF NOT EXISTS violation_factors (
  id BIGSERIAL PRIMARY KEY,
  violation_type VARCHAR(30) NOT NULL,
  surcharge_amount NUMERIC(12, 2) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NULL,
  CONSTRAINT uq_violation_factors_type_eff UNIQUE (violation_type, effective_date),
  CONSTRAINT chk_violation_factors_dates CHECK (expiration_date IS NULL OR effective_date < expiration_date)
);

CREATE INDEX IF NOT EXISTS idx_violation_factors_lookup
  ON violation_factors (violation_type, effective_date DESC);

CREATE TABLE IF NOT EXISTS quote_audit_log (
  id BIGSERIAL PRIMARY KEY,
  territory_code VARCHAR(20) NOT NULL,
  driver_age INT NOT NULL,
  vehicle_symbol INT NOT NULL,
  major_violations INT NOT NULL,
  minor_violations INT NOT NULL,
  underwriting_tier VARCHAR(40) NOT NULL,
  final_premium NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_audit_log_cleanup
  ON quote_audit_log (territory_code, created_at, final_premium);

-- Optional legacy table referenced by scratch/TestDB.gsp step 8
CREATE TABLE IF NOT EXISTS quote_history (
  id BIGSERIAL PRIMARY KEY,
  territory_code VARCHAR(20) NOT NULL,
  driver_age INT NOT NULL,
  vehicle_symbol INT NOT NULL,
  major_violations INT NOT NULL,
  minor_violations INT NOT NULL,
  underwriting_tier VARCHAR(40) NOT NULL,
  final_premium NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);