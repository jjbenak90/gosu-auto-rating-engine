package rateengine

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses rateengine.rules.SurchargeEvaluator

class ProductionAutoRatingEngine {

  public static function calculatePolicyPremium(profile : PolicyRiskProfile) : double {
    if (not profile.validateProfileData()) {
      throw new RuntimeException("Invalid policy risk profile for territory: ${profile.TerritoryCode}, age: ${profile.DriverAge}")
    }

    var collBase = DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "COLLISION")
    var liabBase = DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "LIABILITY")

    var ageFactor = DatabaseManager.fetchAgeFactor(profile.DriverAge)
    var vehicleFactor = DatabaseManager.fetchVehicleSymbolFactor(profile.VehicleSymbol)

    // Apply functional block-based surcharge evaluation utilizing DB-backed enhancements
    var dynamicRule = SurchargeEvaluator.getDefaultSurchargeBlock()
    var surchargeMultiplier = SurchargeEvaluator.evaluateDynamicSurcharge(profile, dynamicRule)

    var majorSurcharge = profile.MajorViolations * DatabaseManager.fetchViolationSurcharge("MAJOR")
    var minorSurcharge = profile.MinorViolations * DatabaseManager.fetchViolationSurcharge("MINOR")

    var basePremium = ((collBase + liabBase) * ageFactor * vehicleFactor) + majorSurcharge + minorSurcharge
    var totalPremium = basePremium * surchargeMultiplier

    DatabaseManager.persistQuote(profile, totalPremium)

    return totalPremium
  }
}