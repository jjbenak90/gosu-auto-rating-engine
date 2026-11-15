package rateengine

uses rateengine.model.RiskProfile
uses rateengine.tables.RatingFactorTables

class AutoRatingEngine {

  public static function calculatePremium(risk : RiskProfile) : double {
    var baseRate = RatingFactorTables.getBaseRate(risk.VehicleValue)
    var ageFactor = RatingFactorTables.getAgeSurcharge(risk.DriverAge)
    var accidentFactor = RatingFactorTables.getAccidentSurcharge(risk.AtFaultAccidents)

    var finalPremium = baseRate * ageFactor * accidentFactor
    
    return Math.round(finalPremium * 100.0) / 100.0
  }
}