package rateengine.test

uses rateengine.model.PolicyRiskProfile
uses rateengine.ProductionAutoRatingEngine
uses java.math.BigDecimal

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
    print("=== ALL TESTS PASSED SUCCESSFULLY ===")
  }

  public static function testStandardPolicyRating() {
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

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    var expected = 1905.0
    if (Math.abs(premium - expected) > 0.01) {
      throw new RuntimeException("testStandardPolicyRating failed: expected ${expected}, got ${premium}")
    }
    print("[PASS] testStandardPolicyRating")
  }

  public static function testYouthfulHighRiskDriver() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68102"
    profile.DriverAge = 18
    profile.Gender = "M"
    profile.CompletedDriverTraining = false
    profile.VehicleSymbol = 20
    profile.VehicleValue = 45000.00
    profile.MajorViolations = 1
    profile.MinorViolations = 2
    profile.AtFaultAccidents = 1
    profile.CoverageLimit = 250000

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (premium <= 3000.00) {
      throw new RuntimeException("testYouthfulHighRiskDriver failed: expected premium > 3000.00, got ${premium}")
    }
    print("[PASS] testYouthfulHighRiskDriver")
  }
  
  public static function testSeniorDriverDiscount() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68046" // Suburban Papillion
    profile.DriverAge = 70
    profile.Gender = "F"
    profile.CompletedDriverTraining = false
    profile.VehicleSymbol = 8
    profile.VehicleValue = 24000.00
    profile.MajorViolations = 0
    profile.MinorViolations = 0
    profile.AtFaultAccidents = 0
    profile.CoverageLimit = 50000

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    // Senior factor is 1.05, suburban base is lower (280)
    if (premium > 1500.00) {
      throw new RuntimeException("testSeniorDriverDiscount failed: expected lower premium for clean senior driver, got ${premium}")
    }
    print("[PASS] testSeniorDriverDiscount")
  }

  public static function testTerritoryFallbackLookup() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "99999" // Non-existent territory triggers fallback default (300.00 base)
    profile.DriverAge = 35
    profile.Gender = "M"
    profile.CompletedDriverTraining = false
    profile.VehicleSymbol = 10
    profile.VehicleValue = 30000.00
    profile.MajorViolations = 0
    profile.MinorViolations = 0
    profile.AtFaultAccidents = 0
    profile.CoverageLimit = 100000

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    if (premium <= 0) {
      throw new RuntimeException("testTerritoryFallbackLookup failed: fallback base rate calculation failed")
    }
    print("[PASS] testTerritoryFallbackLookup")
  }

  public static function testMultipleMvrViolations() {
    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = "68123"
    profile.DriverAge = 30
    profile.Gender = "M"
    profile.CompletedDriverTraining = false
    profile.VehicleSymbol = 15
    profile.VehicleValue = 35000.00
    profile.MajorViolations = 2 // 2 * 0.50 = +1.00 surcharge factor
    profile.MinorViolations = 3 // 3 * 0.15 = +0.45 surcharge factor
    profile.AtFaultAccidents = 0
    profile.CoverageLimit = 100000

    var premium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
    // Heavy MVR surcharges should significantly drive up the final cost
    if (premium < 2000.00) {
      throw new RuntimeException("testMultipleMvrViolations failed: MVR surcharges not properly reflected, got ${premium}")
    }
    print("[PASS] testMultipleMvrViolations")
  }

  public static function testEnhancementPropertiesAndTiers() {
    var profile = new PolicyRiskProfile()
    profile.DriverAge = 19
    profile.MajorViolations = 1
    profile.MinorViolations = 1
    profile.AtFaultAccidents = 1
    profile.VehicleSymbol = 10
    profile.TerritoryCode = "68123"

    if (profile.TotalViolations != 3) {
      throw new RuntimeException("TotalViolations enhancement failed: expected 3, got ${profile.TotalViolations}")
    }

    if (not profile.IsHighRiskDriver) {
      throw new RuntimeException("IsHighRiskDriver enhancement failed: expected true")
    }

    if (profile.UnderwritingTier != "TIER_3_HIGH_RISK") {
      throw new RuntimeException("UnderwritingTier enhancement failed: expected TIER_3_HIGH_RISK, got ${profile.UnderwritingTier}")
    }

    var riskScore = profile.ActuarialRiskScore
    if (riskScore <= 0.0) {
      throw new RuntimeException("ActuarialRiskScore calculation failed")
    }

    if (not profile.validateProfileData()) {
      throw new RuntimeException("validateProfileData failed for valid profile")
    }

    print("[PASS] testEnhancementPropertiesAndTiers")
  }

  public static function testBlockCustomModifiers() {
    var profile = new PolicyRiskProfile()
    profile.DriverAge = 30
    profile.MajorViolations = 0

    var customModifier = profile.evaluateCustomModifier(\ p ->
        p.DriverAge > 25 ? new BigDecimal("0.90") : new BigDecimal("1.20")
    )

    if (customModifier.compareTo(new BigDecimal("0.90")) != 0) {
      throw new RuntimeException("Block custom modifier test failed: expected 0.90, got ${customModifier}")
    }

    print("[PASS] testBlockCustomModifiers")
  }
}