package rateengine

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses rateengine.model.RatingWorksheet
uses rateengine.rules.SurchargeEvaluator
uses java.math.BigDecimal
uses java.math.RoundingMode
uses java.util.Date

class ProductionAutoRatingEngine {

  public static function calculatePolicyPremium(profile : PolicyRiskProfile) : double {
    return calculatePolicyPremium(profile, new Date())
  }

  public static function calculatePolicyPremium(profile : PolicyRiskProfile, ratingDate : Date) : double {
    return ratePolicy(profile, ratingDate).FinalPremium.doubleValue()
  }

  public static function ratePolicy(profile : PolicyRiskProfile) : RatingWorksheet {
    return ratePolicy(profile, new Date())
  }

  public static function ratePolicy(profile : PolicyRiskProfile, ratingDate : Date) : RatingWorksheet {
    if (not profile.validateProfileData()) {
      throw new RuntimeException("Invalid policy risk profile for territory: ${profile.TerritoryCode}, age: ${profile.DriverAge}")
    }

    var effectiveRatingDate = ratingDate != null ? ratingDate : new Date()
    var worksheet = new RatingWorksheet(profile)

    var collBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "COLLISION", effectiveRatingDate))
    worksheet.recordStep("COLLISION_BASE", collBase, collBase, "Territory ${profile.TerritoryCode} collision base loss cost (${effectiveRatingDate})")

    var liabBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "LIABILITY", effectiveRatingDate))
    var combinedBase = collBase.add(liabBase)
    worksheet.recordStep("LIABILITY_BASE", liabBase, combinedBase, "Added liability base loss cost (${effectiveRatingDate})")

    var ageFactor = BigDecimal.valueOf(DatabaseManager.fetchAgeFactor(profile.DriverAge, effectiveRatingDate)).setScale(4, RoundingMode.HALF_UP)
    var afterAge = combinedBase.multiply(ageFactor)
    worksheet.recordStep("AGE_FACTOR", ageFactor, afterAge, "Driver age ${profile.DriverAge} factor (${effectiveRatingDate})")

    var vehicleFactor = BigDecimal.valueOf(DatabaseManager.fetchVehicleSymbolFactor(profile.VehicleSymbol, effectiveRatingDate)).setScale(4, RoundingMode.HALF_UP)
    var afterVehicle = afterAge.multiply(vehicleFactor)
    worksheet.recordStep("VEHICLE_SYMBOL_FACTOR", vehicleFactor, afterVehicle, "Vehicle symbol ${profile.VehicleSymbol} factor (${effectiveRatingDate})")

    var majorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MAJOR", effectiveRatingDate))
    var minorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MINOR", effectiveRatingDate))
    var majorSurcharge = majorRate.multiply(BigDecimal.valueOf(profile.MajorViolations))
    var minorSurcharge = minorRate.multiply(BigDecimal.valueOf(profile.MinorViolations))
    var totalViolationSurcharge = majorSurcharge.add(minorSurcharge)
    var basePremium = afterVehicle.add(totalViolationSurcharge)
    worksheet.recordStep("MVR_VIOLATION_SURCHARGES", totalViolationSurcharge, basePremium, "Major: ${profile.MajorViolations}, Minor: ${profile.MinorViolations}")

    var dynamicRule = SurchargeEvaluator.getDefaultSurchargeBlock(effectiveRatingDate)
    var surchargeMultiplier = SurchargeEvaluator.evaluateDynamicSurcharge(profile, dynamicRule)
    var rawTotal = basePremium.multiply(surchargeMultiplier)
    var finalPremium = rawTotal.setScale(2, RoundingMode.HALF_UP)
    worksheet.recordStep("DYNAMIC_TIER_MULTIPLIER", surchargeMultiplier, finalPremium, "Tier ${profile.UnderwritingTier} block multiplier (HALF_UP 2dp)")

    worksheet.FinalPremium = finalPremium
    DatabaseManager.persistQuote(profile, finalPremium.doubleValue())

    return worksheet
  }
}