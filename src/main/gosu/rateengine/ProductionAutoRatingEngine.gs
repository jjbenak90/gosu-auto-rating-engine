package rateengine

uses rateengine.model.PolicyRiskProfile
uses rateengine.tables.ActuarialRatingTables

class ProductionAutoRatingEngine {

  public static function calculatePolicyPremium(risk : PolicyRiskProfile) : double {
    var collBase = ActuarialRatingTables.getBaseLossCost(risk.TerritoryCode, "COLLISION")
    var compBase = ActuarialRatingTables.getBaseLossCost(risk.TerritoryCode, "COMPREHENSIVE")
    var liabBase = ActuarialRatingTables.getBaseLossCost(risk.TerritoryCode, "LIABILITY")

    var classFactor = ActuarialRatingTables.getDriverClassificationFactor(risk.DriverAge, risk.Gender, risk.CompletedDriverTraining)
    var symbolFactor = ActuarialRatingTables.getVehicleSymbolFactor(risk.VehicleSymbol)
    var mvrFactor = ActuarialRatingTables.getMVRViolationSurcharge(risk.MajorViolations, risk.MinorViolations)
    var accidentFactor = 1.0 + (risk.AtFaultAccidents * 0.35)
    var ilf = risk.CoverageLimit >= 250000 ? 1.25 : (risk.CoverageLimit >= 100000 ? 1.10 : 1.00)

    var collisionPremium = collBase * symbolFactor * classFactor * mvrFactor * accidentFactor
    var compPremium = compBase * symbolFactor * 0.95
    var liabilityPremium = liabBase * classFactor * mvrFactor * accidentFactor * ilf

    var totalAnnualPremium = collisionPremium + compPremium + liabilityPremium

    // Avoid nested escaped quotes inside string interpolation
    var formattedClassFactor = String.format("%.2f", {classFactor})

    print("=== ACTUARIAL RATING WORKSHEET ===")
    print("Territory: ${risk.TerritoryCode} | Class Factor: ${formattedClassFactor} | MVR Surcharge: ${mvrFactor}")
    print("Collision: $" + Math.round(collisionPremium) + " | Comp: $" + Math.round(compPremium) + " | Liability: $" + Math.round(liabilityPremium))
    print("-----------------------------------")

    return Math.round(totalAnnualPremium * 100.0) / 100.0
  }
}