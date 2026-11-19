package rateengine

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses rateengine.model.RatingWorksheet
uses rateengine.rules.SurchargeEvaluator
uses java.math.BigDecimal
uses java.math.RoundingMode

class ProductionAutoRatingEngine {

  public static function calculatePolicyPremium(profile : PolicyRiskProfile) : double {
    return ratePolicy(profile).FinalPremium.doubleValue()
  }

  public static function ratePolicy(profile : PolicyRiskProfile) : RatingWorksheet {
    if (not profile.validateProfileData()) {
      throw new RuntimeException("Invalid policy risk profile for territory: ${profile.TerritoryCode}, age: ${profile.DriverAge}")
    }

    var worksheet = new RatingWorksheet(profile)

    var collBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "COLLISION"))
    worksheet.recordStep("COLLISION_BASE", collBase, collBase, "Territory ${profile.TerritoryCode} collision base loss cost")

    var liabBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "LIABILITY"))
    var combinedBase = collBase.add(liabBase)
    worksheet.recordStep("LIABILITY_BASE", liabBase, combinedBase, "Added liability base loss cost")

    var ageFactor = BigDecimal.valueOf(DatabaseManager.fetchAgeFactor(profile.DriverAge)).setScale(4, RoundingMode.HALF_UP)
    var afterAge = combinedBase.multiply(ageFactor)
    worksheet.recordStep("AGE_FACTOR", ageFactor, afterAge, "Driver age ${profile.DriverAge} factor")

    var vehicleFactor = BigDecimal.valueOf(DatabaseManager.fetchVehicleSymbolFactor(profile.VehicleSymbol)).setScale(4, RoundingMode.HALF_UP)
    var afterVehicle = afterAge.multiply(vehicleFactor)
    worksheet.recordStep("VEHICLE_SYMBOL_FACTOR", vehicleFactor, afterVehicle, "Vehicle symbol ${profile.VehicleSymbol} factor")

    var majorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MAJOR"))
    var minorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MINOR"))
    var majorSurcharge = majorRate.multiply(BigDecimal.valueOf(profile.MajorViolations))
    var minorSurcharge = minorRate.multiply(BigDecimal.valueOf(profile.MinorViolations))
    var totalViolationSurcharge = majorSurcharge.add(minorSurcharge)
    var basePremium = afterVehicle.add(totalViolationSurcharge)
    worksheet.recordStep("MVR_VIOLATION_SURCHARGES", totalViolationSurcharge, basePremium, "Major: ${profile.MajorViolations}, Minor: ${profile.MinorViolations}")

    var dynamicRule = SurchargeEvaluator.getDefaultSurchargeBlock()
    var surchargeMultiplier = SurchargeEvaluator.evaluateDynamicSurcharge(profile, dynamicRule)
    var rawTotal = basePremium.multiply(surchargeMultiplier)
    var finalPremium = rawTotal.setScale(2, RoundingMode.HALF_UP)
    worksheet.recordStep("DYNAMIC_TIER_MULTIPLIER", surchargeMultiplier, finalPremium, "Tier ${profile.UnderwritingTier} block multiplier (HALF_UP 2dp)")

    worksheet.FinalPremium = finalPremium
    DatabaseManager.persistQuote(profile, finalPremium.doubleValue())

    return worksheet
  }
}