package rateengine.test

uses rateengine.db.DatabaseManager
uses rateengine.ProductionAutoRatingEngine
uses rateengine.model.PolicyRiskProfile
uses rateengine.model.RatingWorksheet
uses rateengine.rules.SurchargeEvaluator
uses java.math.BigDecimal
uses java.math.RoundingMode
uses java.sql.Timestamp
uses java.util.Calendar
uses java.util.Date

class AutoRatingEngineTest {

  private static final var STANDARD_TERRITORY_CODE : String = "68123"
  private static final var FALLBACK_TERRITORY_CODE : String = "99999"
  private static final var BASELINE_DRIVER_AGE : int = 24
  private static final var SENIOR_DRIVER_AGE : int = 72
  private static final var YOUTHFUL_DRIVER_AGE : int = 19
  private static final var BASELINE_VEHICLE_SYMBOL : int = 12
  private static final var SENIOR_VEHICLE_SYMBOL : int = 8
  private static final var BASELINE_MINOR_VIOLATIONS : int = 1
  private static final var ZERO_INCIDENTS : int = 0
  private static final var MULTI_VIOLATION_MINOR_COUNT : int = 3
  private static final var MULTI_VIOLATION_MAJOR_COUNT : int = 1
  private static final var YOUTHFUL_ACCIDENT_COUNT : int = 1

  private static final var EXPECTED_STANDARD_PREMIUM : double = 1340.0
  private static final var EXPECTED_FALLBACK_PREMIUM : double = 990.0
  private static final var EXPECTED_SENIOR_PREMIUM : double = 879.75
  private static final var EXPECTED_MULTI_VIOLATION_PREMIUM : double = 2985.0
  private static final var EXPECTED_YOUTHFUL_HIGH_RISK_PREMIUM : double = 3108.75
  private static final var EXPECTED_PRE_REVISION_PREMIUM : double = 1270.00
  private static final var EXPECTED_POST_REVISION_PREMIUM : double = 1340.00
  private static final var EXPECTED_WORKSHEET_STEPS : int = 6
  private static final var EXPECTED_WORKSHEET_COLLISION_TOTAL : BigDecimal = new BigDecimal("400.00")
  private static final var WORKSHEET_TOLERANCE : BigDecimal = new BigDecimal("0.01")
  private static final var EXPECTED_CUSTOM_BLOCK_FACTOR : String = "1.1500"

  private static final var STEP_COLLISION_BASE : String = "COLLISION_BASE"
  private static final var PARAM_HIGH_RISK_MULTIPLIER : String = "HIGH_RISK_SURCHARGE_MULTIPLIER"
  private static final var TIER_STANDARD : String = "TIER_2_STANDARD"

  private static final var PREMIUM_TOLERANCE : double = 0.01
  private static final var FACTOR_SCALE : int = 4
  private static final var FACTOR_TOLERANCE : BigDecimal = new BigDecimal("0.001")

  private static final var REVISION_YEAR : int = 2026
  private static final var PRE_REVISION_MONTH : int = Calendar.MARCH
  private static final var POST_REVISION_MONTH : int = Calendar.SEPTEMBER
  private static final var REVISION_DAY_OF_MONTH : int = 15

  private static final var RUN_BUFFER_MILLIS : long = 1000L
  private static final var TEST_AUDIT_PREMIUMS : BigDecimal[] = {
    new BigDecimal("879.75"),
    new BigDecimal("990.00"),
    new BigDecimal("1270.00"),
    new BigDecimal("1340.00"),
    new BigDecimal("2985.00"),
    new BigDecimal("3108.75")
  }

  public static function main(args : String[]) {
    var runStart = new Timestamp(System.currentTimeMillis() - RUN_BUFFER_MILLIS)
    try {
      testEnhancementPropertiesAndTiers()
      testBlockCustomModifiers()
      testYouthfulHighRiskDriver()
      testTerritoryFallbackLookup()
      testStandardPolicyRating()
      testSeniorDriverDiscount()
      testMultipleMvrViolations()
      testEffectiveDatedRateRevision()
      testEnhancementsAndBlocks()
      testRatingWorksheetAuditTrace()
    } finally {
      var runEnd = new Timestamp(System.currentTimeMillis() + RUN_BUFFER_MILLIS)
      DatabaseManager.cleanupQuoteAuditLog(runStart, runEnd, TEST_AUDIT_PREMIUMS)
    }
  }

  public static function runAllTests() {
    main(null)
  }

  private static function createBaselineProfile() : PolicyRiskProfile {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = STANDARD_TERRITORY_CODE
    profile.DriverAge = BASELINE_DRIVER_AGE
    profile.VehicleSymbol = BASELINE_VEHICLE_SYMBOL
    profile.MajorViolations = ZERO_INCIDENTS
    profile.MinorViolations = BASELINE_MINOR_VIOLATIONS
    profile.AtFaultAccidents = ZERO_INCIDENTS
    return profile
  }

  public static function testEnhancementPropertiesAndTiers() {
    print("- testEnhancementPropertiesAndTiers")
    var profile = createBaselineProfile()
    var tier = DatabaseManager.fetchUnderwritingTier(profile)
    if (tier != TIER_STANDARD) {
      throw new RuntimeException("testEnhancementPropertiesAndTiers failed: expected ${TIER_STANDARD}, got ${tier}")
    }
    print("[PASS] testEnhancementPropertiesAndTiers (tier=${tier})")
    print("  SUCCESS ")
  }

  public static function testStandardPolicyRating() {
    print("- testStandardPolicyRating")
    var profile = createBaselineProfile()
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (Math.abs(premium - EXPECTED_STANDARD_PREMIUM) > PREMIUM_TOLERANCE) {
      throw new RuntimeException("testStandardPolicyRating failed: expected ${EXPECTED_STANDARD_PREMIUM}, got ${premium}")
    }
    print("[PASS] testStandardPolicyRating")
    print("  SUCCESS ")
  }

  public static function testTerritoryFallbackLookup() {
    print("- testTerritoryFallbackLookup")
    var profile = createBaselineProfile()
    profile.TerritoryCode = FALLBACK_TERRITORY_CODE
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (Math.abs(premium - EXPECTED_FALLBACK_PREMIUM) > PREMIUM_TOLERANCE) {
      throw new RuntimeException("testTerritoryFallbackLookup failed: expected ${EXPECTED_FALLBACK_PREMIUM}, got ${premium}")
    }
    print("[PASS] testTerritoryFallbackLookup (premium=${premium})")
    print("  SUCCESS ")
  }

  public static function testMultipleMvrViolations() {
    print("- testMultipleMvrViolations")
    var profile = createBaselineProfile()
    profile.MajorViolations = MULTI_VIOLATION_MAJOR_COUNT
    profile.MinorViolations = MULTI_VIOLATION_MINOR_COUNT
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (Math.abs(premium - EXPECTED_MULTI_VIOLATION_PREMIUM) > PREMIUM_TOLERANCE) {
      throw new RuntimeException("testMultipleMvrViolations failed: expected ${EXPECTED_MULTI_VIOLATION_PREMIUM}, got ${premium}")
    }
    print("[PASS] testMultipleMvrViolations (premium=${premium})")
    print("  SUCCESS ")
  }

  public static function testRatingWorksheetAuditTrace() {
    print("- testRatingWorksheetAuditTrace")
    var profile = createBaselineProfile()
    var worksheet : RatingWorksheet = ProductionAutoRatingEngine.ratePolicy(profile)
    worksheet.printWorksheet()

    if (worksheet.Steps.size() != EXPECTED_WORKSHEET_STEPS) {
      throw new RuntimeException("testRatingWorksheetAuditTrace failed: expected ${EXPECTED_WORKSHEET_STEPS} rating steps, got ${worksheet.Steps.size()}")
    }

    var collisionStep = worksheet.getStep(STEP_COLLISION_BASE)
    if (collisionStep == null
        or collisionStep.RunningTotal.subtract(EXPECTED_WORKSHEET_COLLISION_TOTAL).abs().compareTo(WORKSHEET_TOLERANCE) > 0) {
      throw new RuntimeException("testRatingWorksheetAuditTrace collision base failed: expected ${EXPECTED_WORKSHEET_COLLISION_TOTAL}, got ${collisionStep?.RunningTotal}")
    }

    print("[PASS] testRatingWorksheetAuditTrace")
    print("  SUCCESS ")
  }

  public static function testBlockCustomModifiers() {
    print("- testBlockCustomModifiers")
    var profile = createBaselineProfile()
    var expectedFactor : BigDecimal = new BigDecimal(EXPECTED_CUSTOM_BLOCK_FACTOR)
    var factor : BigDecimal = SurchargeEvaluator.evaluateDynamicSurcharge(profile, \ p -> expectedFactor as double)
    if (factor.subtract(expectedFactor).abs().compareTo(FACTOR_TOLERANCE) > 0) {
      throw new RuntimeException("testBlockCustomModifiers failed: expected ${expectedFactor}, got ${factor}")
    }
    print("[PASS] testBlockCustomModifiers (factor=${factor})")
    print("  SUCCESS ")
  }
  
  public static function testEnhancementsAndBlocks() {
    print("- testEnhancementsAndBlocks")
    var profile = createBaselineProfile()
    profile.MajorViolations = MULTI_VIOLATION_MAJOR_COUNT

    var expectedMultiplier : double = DatabaseManager.fetchSystemParameter(PARAM_HIGH_RISK_MULTIPLIER, new Date())
    var blockRule = SurchargeEvaluator.getDefaultSurchargeBlock()
    var factor : BigDecimal = SurchargeEvaluator.evaluateDynamicSurcharge(profile, blockRule)
    var expectedBd : BigDecimal = BigDecimal.valueOf(expectedMultiplier).setScale(FACTOR_SCALE, RoundingMode.HALF_UP)

    if (factor.subtract(expectedBd).abs().compareTo(FACTOR_TOLERANCE) > 0) {
      throw new RuntimeException("testEnhancementsAndBlocks failed: expected ${expectedMultiplier} surcharge factor, got ${factor}")
    }
    print("[PASS] testEnhancementsAndBlocks")
    print("  SUCCESS ")
  }

  public static function testYouthfulHighRiskDriver() {
    print("- testYouthfulHighRiskDriver")
    var profile = createBaselineProfile()
    profile.DriverAge = YOUTHFUL_DRIVER_AGE
    profile.MajorViolations = MULTI_VIOLATION_MAJOR_COUNT
    profile.AtFaultAccidents = YOUTHFUL_ACCIDENT_COUNT
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (Math.abs(premium - EXPECTED_YOUTHFUL_HIGH_RISK_PREMIUM) > PREMIUM_TOLERANCE) {
      throw new RuntimeException("testYouthfulHighRiskDriver failed: expected ${EXPECTED_YOUTHFUL_HIGH_RISK_PREMIUM}, got ${premium}")
    }
    print("[PASS] testYouthfulHighRiskDriver (premium=${premium})")
    print("  SUCCESS ")
  }

  public static function testSeniorDriverDiscount() {
    print("- testSeniorDriverDiscount")
    var profile = createBaselineProfile()
    profile.DriverAge = SENIOR_DRIVER_AGE
    profile.VehicleSymbol = SENIOR_VEHICLE_SYMBOL
    profile.MinorViolations = ZERO_INCIDENTS
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (Math.abs(premium - EXPECTED_SENIOR_PREMIUM) > PREMIUM_TOLERANCE) {
      throw new RuntimeException("testSeniorDriverDiscount failed: expected ${EXPECTED_SENIOR_PREMIUM}, got ${premium}")
    }
    print("[PASS] testSeniorDriverDiscount (premium=${premium})")
    print("  SUCCESS ")
  }

  public static function testEffectiveDatedRateRevision() {
    print("- testEffectiveDatedRateRevision")
    var priorDate = buildDate(REVISION_YEAR, PRE_REVISION_MONTH, REVISION_DAY_OF_MONTH)
    var postDate = buildDate(REVISION_YEAR, POST_REVISION_MONTH, REVISION_DAY_OF_MONTH)

    var priorPremium = ProductionAutoRatingEngine.calculatePolicyPremium(createBaselineProfile(), priorDate)
    var postPremium = ProductionAutoRatingEngine.calculatePolicyPremium(createBaselineProfile(), postDate)

    if (Math.abs(priorPremium - EXPECTED_PRE_REVISION_PREMIUM) > PREMIUM_TOLERANCE
        or Math.abs(postPremium - EXPECTED_POST_REVISION_PREMIUM) > PREMIUM_TOLERANCE
        or Math.abs(priorPremium - postPremium) <= PREMIUM_TOLERANCE) {
      throw new RuntimeException("testEffectiveDatedRateRevision failed: expected distinct premiums for ${priorDate} (${priorPremium}) vs ${postDate} (${postPremium})")
    }

    print("[PASS] testEffectiveDatedRateRevision (prior=${priorPremium}, post=${postPremium})")
    print("  SUCCESS ")
  }

  private static function buildDate(year : int, month : int, day : int) : Date {
    var cal = Calendar.getInstance()
    cal.set(Calendar.YEAR, year)
    cal.set(Calendar.MONTH, month)
    cal.set(Calendar.DAY_OF_MONTH, day)
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.getTime()
  }
}