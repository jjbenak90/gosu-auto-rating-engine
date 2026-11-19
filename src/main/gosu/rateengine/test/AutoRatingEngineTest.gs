package rateengine.test

uses rateengine.db.DatabaseManager
uses rateengine.rules.SurchargeEvaluator
uses rateengine.model.PolicyRiskProfile
uses rateengine.model.RatingWorksheet
uses rateengine.ProductionAutoRatingEngine
uses java.math.BigDecimal
uses java.math.RoundingMode
uses java.text.SimpleDateFormat

class AutoRatingEngineTest {

  public static function runAllTests() {
    print("=== RUNNING AUTO RATING ENGINE TESTS ===")
    testStandardPolicyRating()
    testYouthfulHighRiskDriver()
    testSeniorDriverDiscount()
    testTerritoryFallbackLookup()
    testMultipleMvrViolations()
    testEnhancementPropertiesAndTiers()
    testBlockCustomModifiers()
    testEnhancementsAndBlocks()
    testRatingWorksheetAuditTrace()
    testEffectiveDatedRateRevision()
    print("=== ALL TESTS PASSED SUCCESSFULLY ===")
  }

  private static function createBaselineProfile() : PolicyRiskProfile {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68123"
    profile.DriverAge = 24
    profile.Gender = "M"
    profile.CompletedDriverTraining = true
    profile.VehicleSymbol = 12
    profile.VehicleValue = 32000.00
    profile.MajorViolations = 0
    profile.MinorViolations = 1
    profile.AtFaultAccidents = 0
    profile.CoverageLimit = 100000
    return profile
  }

  public static function testStandardPolicyRating() {
    var profile = createBaselineProfile()
    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    var expected = 1340.0
    if (Math.abs(premium - expected) > 0.01) {
      throw new RuntimeException("testStandardPolicyRating failed: expected ${expected}, got ${premium}")
    }
    print("[PASS] testStandardPolicyRating")
  }

  public static function testYouthfulHighRiskDriver() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68123"
    profile.DriverAge = 18
    profile.Gender = "M"
    profile.CompletedDriverTraining = false
    profile.VehicleSymbol = 15
    profile.VehicleValue = 28000.00
    profile.MajorViolations = 1
    profile.MinorViolations = 1
    profile.AtFaultAccidents = 1
    profile.CoverageLimit = 100000

    var worksheet = ProductionAutoRatingEngine.ratePolicy(profile)
    if (worksheet.FinalPremium == null or worksheet.FinalPremium.compareTo(BigDecimal.ZERO) <= 0) {
      throw new RuntimeException("testYouthfulHighRiskDriver failed: expected positive FinalPremium")
    }
    print("[PASS] testYouthfulHighRiskDriver (premium=${worksheet.FinalPremium})")
  }

  public static function testSeniorDriverDiscount() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68123"
    profile.DriverAge = 68
    profile.Gender = "F"
    profile.CompletedDriverTraining = true
    profile.VehicleSymbol = 8
    profile.VehicleValue = 22000.00
    profile.MajorViolations = 0
    profile.MinorViolations = 0
    profile.AtFaultAccidents = 0
    profile.CoverageLimit = 100000

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (premium <= 0.0) {
      throw new RuntimeException("testSeniorDriverDiscount failed: expected positive premium, got ${premium}")
    }
    print("[PASS] testSeniorDriverDiscount (premium=${premium})")
  }

  public static function testTerritoryFallbackLookup() {
    var profile = createBaselineProfile()
    profile.TerritoryCode = "99999"

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (premium <= 0.0) {
      throw new RuntimeException("testTerritoryFallbackLookup failed: expected positive premium, got ${premium}")
    }
    print("[PASS] testTerritoryFallbackLookup (premium=${premium})")
  }

  public static function testMultipleMvrViolations() {
    var profile = createBaselineProfile()
    profile.MajorViolations = 1
    profile.MinorViolations = 2

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (premium <= 0.0) {
      throw new RuntimeException("testMultipleMvrViolations failed: expected positive premium, got ${premium}")
    }
    print("[PASS] testMultipleMvrViolations (premium=${premium})")
  }

  public static function testEnhancementPropertiesAndTiers() {
    var profile = createBaselineProfile()
    if (profile.UnderwritingTier == null or profile.UnderwritingTier.length == 0) {
      throw new RuntimeException("testEnhancementPropertiesAndTiers failed: expected non-empty UnderwritingTier")
    }
    print("[PASS] testEnhancementPropertiesAndTiers (tier=${profile.UnderwritingTier})")
  }

  public static function testBlockCustomModifiers() {
    var profile = createBaselineProfile()
    var customRule : block(p : PolicyRiskProfile) : double = \ p -> 1.15
    var factor = SurchargeEvaluator.evaluateDynamicSurcharge(profile, customRule)
    var expected = new BigDecimal("1.1500")
    if (factor.subtract(expected).abs().compareTo(new BigDecimal("0.001")) > 0) {
      throw new RuntimeException("testBlockCustomModifiers failed: expected 1.1500, got ${factor}")
    }
    print("[PASS] testBlockCustomModifiers (factor=${factor})")
  }

  public static function testEnhancementsAndBlocks() {
    var profile = createBaselineProfile()
    profile.MajorViolations = 1
    
    var expectedMultiplier = DatabaseManager.fetchSystemParameter("HIGH_RISK_SURCHARGE_MULTIPLIER")
    var blockRule = SurchargeEvaluator.getDefaultSurchargeBlock()
    var factor = SurchargeEvaluator.evaluateDynamicSurcharge(profile, blockRule)
    var expectedBd = BigDecimal.valueOf(expectedMultiplier).setScale(4, RoundingMode.HALF_UP)

    if (factor.subtract(expectedBd).abs().compareTo(new BigDecimal("0.001")) > 0) {
      throw new RuntimeException("testEnhancementsAndBlocks failed: expected ${expectedMultiplier} surcharge factor, got ${factor}")
    }
    print("[PASS] testEnhancementsAndBlocks")
  }

  public static function testRatingWorksheetAuditTrace() {
    var profile = createBaselineProfile()
    var worksheet : RatingWorksheet = ProductionAutoRatingEngine.ratePolicy(profile)
    worksheet.printWorksheet()

    if (worksheet.Steps.size() != 6) {
      throw new RuntimeException("testRatingWorksheetAuditTrace failed: expected 6 rating steps, got ${worksheet.Steps.size()}")
    }

    var collisionStep = worksheet.getStep("COLLISION_BASE")
    if (collisionStep == null or collisionStep.RunningTotal.compareTo(new BigDecimal("400.0")) != 0) {
      throw new RuntimeException("testRatingWorksheetAuditTrace collision base failed: expected 400.0, got ${collisionStep?.RunningTotal}")
    }

    var multiplierStep = worksheet.getStep("DYNAMIC_TIER_MULTIPLIER")
    if (multiplierStep == null or multiplierStep.Operand.compareTo(new BigDecimal("1.0000")) != 0) {
      throw new RuntimeException("testRatingWorksheetAuditTrace multiplier failed: expected 1.0000, got ${multiplierStep?.Operand}")
    }

    if (worksheet.FinalPremium.compareTo(new BigDecimal("1340.00")) != 0) {
      throw new RuntimeException("testRatingWorksheetAuditTrace final premium failed: expected 1340.00, got ${worksheet.FinalPremium}")
    }

    print("[PASS] testRatingWorksheetAuditTrace")
  }

  public static function testEffectiveDatedRateRevision() {
    var sdf = new SimpleDateFormat("yyyy-MM-dd")
    var priorDate = sdf.parse("2026-03-15")
    var postRevisionDate = sdf.parse("2026-09-15")

    var profile = createBaselineProfile()
    var priorWorksheet = ProductionAutoRatingEngine.ratePolicy(profile, priorDate)
    var postWorksheet = ProductionAutoRatingEngine.ratePolicy(profile, postRevisionDate)

    if (priorWorksheet.FinalPremium == null or postWorksheet.FinalPremium == null) {
      throw new RuntimeException("testEffectiveDatedRateRevision failed: expected non-null FinalPremium values")
    }

    if (priorWorksheet.FinalPremium.compareTo(postWorksheet.FinalPremium) == 0) {
      throw new RuntimeException("testEffectiveDatedRateRevision failed: expected distinct premiums for ${priorDate} (${priorWorksheet.FinalPremium}) vs ${postRevisionDate} (${postWorksheet.FinalPremium})")
    }

    print("[PASS] testEffectiveDatedRateRevision (prior=${priorWorksheet.FinalPremium}, post=${postWorksheet.FinalPremium})")
  }
}