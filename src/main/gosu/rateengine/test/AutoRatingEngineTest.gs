package rateengine.test

uses rateengine.model.PolicyRiskProfile
uses rateengine.ProductionAutoRatingEngine

class AutoRatingEngineTest {

  public static function runAllTests() {
    print("=== RUNNING AUTO RATING ENGINE TESTS ===")
    testStandardPolicyRating()
    testYouthfulHighRiskDriver()
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
    var expected = 1735.22
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
}