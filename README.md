# GOSU Auto Rating Engine

A Gosu-based auto insurance rating engine backed by PostgreSQL (`auto_rating_db`), featuring effective-dated rate lookups, metadata-driven underwriting tiers and surcharge blocks, step-by-step `RatingWorksheet` audit tracing, and quote audit persistence/cleanup.

## Project Overview

The rating engine calculates policy premiums from a `PolicyRiskProfile` against effective-dated PostgreSQL tables (`territory_base_rates`, `age_factors`, `vehicle_symbol_factors`, `violation_factors`, and `system_parameters`) and logs quotes to `quote_audit_log`.

* **Rating Pipeline (`ProductionAutoRatingEngine.gs`):** Validates profile data, resolves `COLLISION` and `LIABILITY` base loss costs, applies age and vehicle symbol factors, adds `MAJOR` and `MINOR` violation surcharges, evaluates the underwriting tier surcharge multiplier, rounds to two decimal places using `RoundingMode.HALF_UP`, records each step in a `RatingWorksheet`, and persists the quote via `DatabaseManager.persistQuote`.
* **Models & Audit Trace (`PolicyRiskProfile.gs`, `RatingStep.gs`, `RatingWorksheet.gs`):** Captures risk attributes (`TerritoryCode`, `DriverAge`, `VehicleSymbol`, violation/accident counts, etc.) and tracks every operand, running total, and note across the rating steps.
* **Data Access & Cleanup (`DatabaseManager.gs`):** Manages JDBC connections to `auto_rating_db`, effective-date-bounded lookups with fallback defaults, underwriting tier classification (`TIER_1_PREFERRED`, `TIER_2_STANDARD`, `TIER_3_HIGH_RISK`), `BigDecimal` quote persistence, and `cleanupQuoteAuditLog` test-row cleanup.
* **Scratchpad & Test Runners (`src/main/gosu/scratch/`):** Includes `RunMe.gsp`, `RunTests.gsp`, and `TestDB.gsp` for quick ad-hoc execution and database/connection checks.

> **Development Note:** A full day was lost attempting to fit a legacy version of the Hibernate ORM into `gosu-auto-rating-engine` before pivoting to direct JDBC / `DatabaseManager` handling and getting a clean, repeatable test run.

## Gosu Highlights

A few Gosu-specific capabilities used in this codebase that stand out for insurance rating and underwriting rules:

* **Gosu Enhancements (`.gsx`):** `PolicyRiskProfileEnhancement.gsx` attaches domain properties and methods directly onto `PolicyRiskProfile` (`TotalViolations`, `IsHighRiskDriver`, `UnderwritingTier`, `ActuarialRiskScore`, `validateProfileData()`, and `evaluateCustomModifier(...)`) without subclassing or cluttering the data model.
* **Block Closures as Rules (`block(...)`):** `SurchargeEvaluator.gs` builds and evaluates block closures (`\ profile : PolicyRiskProfile -> ...`) for default tier multipliers and custom modifier overrides, letting rating rules compose cleanly with `BigDecimal` scaling (`RoundingMode.HALF_UP`).
* **Transparent Step-by-Step Worksheet Tracing:** `RatingWorksheet` and `RatingStep` preserve an auditable sequence of factors, surcharges, and running totals all the way to the final rounded `BigDecimal` premium.
* **Exact Decimal Precision (`BigDecimal` vs. `double`):** All rate factors, surcharges, and premiums use `BigDecimal` rather than `double` to avoid binary floating-point approximation errors:
    * **Exact base-10 math:** Prevents binary rounding drift (e.g., `0.1 + 0.2 != 0.30000000000000004`) across chained rating multipliers.
    * **Regulatory compliance:** Allows explicit rounding control (`RoundingMode.HALF_UP` to 2 decimal places) at required steps to match filed actuarial rules to the cent.
    * **Clean reconciliation:** Ensures installment splits, pro-rata adjustments, and `quote_audit_log` records balance without penny discrepancies.


## Test Suite (`AutoRatingEngineTest.gs`)

`AutoRatingEngineTest.main` / `runAllTests()` executes all 10 tests and runs `DatabaseManager.cleanupQuoteAuditLog` in a `finally` block:

1. **`testEnhancementPropertiesAndTiers`:** Verifies underwriting tier resolution (`TIER_2_STANDARD`) for a baseline profile.
2. **`testBlockCustomModifiers`:** Verifies `SurchargeEvaluator.evaluateDynamicSurcharge` with a custom modifier block (`1.1500`).
3. **`testYouthfulHighRiskDriver`:** Validates rating calculation for a youthful high-risk profile (`DriverAge = 19`, `MajorViolations = 1`, `AtFaultAccidents = 1`) against current DB rates (`3108.75`).
4. **`testTerritoryFallbackLookup`:** Verifies fallback behavior when rating an unknown territory (`99999` -> `990.0`).
5. **`testStandardPolicyRating`:** Verifies baseline policy rating (`1340.0`).
6. **`testSeniorDriverDiscount`:** Verifies senior driver and vehicle symbol rating with zero minor violations (`DriverAge = 72`, `VehicleSymbol = 8` -> `879.75`).
7. **`testMultipleMvrViolations`:** Validates surcharge accumulation across multiple major and minor MVR violations (`2985.0`).
8. **`testEffectiveDatedRateRevision`:** Confirms distinct premiums across pre-revision and post-revision effective dates (`1270.00` vs. `1340.00`).
9. **`testEnhancementsAndBlocks`:** Checks `SurchargeEvaluator.getDefaultSurchargeBlock()` and `evaluateDynamicSurcharge` against `HIGH_RISK_SURCHARGE_MULTIPLIER` from `system_parameters`.
10. **`testRatingWorksheetAuditTrace`:** Prints the full `RatingWorksheet` and asserts the expected step count (`6`) and collision base step total (`400.00`).

## Next Steps

* **Commit & Clean Up Scratch/Legacy Artifacts:** Commit the current working changes with a conventional commit message, and decide whether to keep, update, or remove legacy/scratchpad artifacts (such as `TestDB.gsp`'s `quote_history` reference and unused `hibernate.cfg.xml` / `Hibernate5Libs` entries if no longer needed).
* **Move Credentials Out of Source:** Externalize `DB_URL`, `DB_USER`, and `DB_PASSWORD` in `DatabaseManager.gs` into environment variables or a config file rather than keeping hardcoded credentials in source.
* **Expand Rating Coverage & Edge Cases:** Add tests for `TIER_1_PREFERRED` discount multipliers, `COMPREHENSIVE` coverage / additional territories, invalid profile validation errors, and empty/null `testPremiums` handling in `cleanupQuoteAuditLog`.