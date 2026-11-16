package rateengine

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile

class ProductionAutoRatingEngine {

  public static function calculatePolicyPremium(profile : PolicyRiskProfile) : double {
    // 1. Fetch base loss costs dynamically from DB
    var collBase = DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "COLLISION")
    var liabBase = DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "LIABILITY")
    
    // 2. Fetch dynamic rating factors instead of hardcoded numbers
    var ageFactor = DatabaseManager.fetchAgeFactor(profile.DriverAge)
    var vehicleFactor = DatabaseManager.fetchVehicleSymbolFactor(profile.VehicleSymbol)
    
    var majorSurcharge = DatabaseManager.fetchViolationSurcharge("MAJOR") * profile.MajorViolations
    var minorSurcharge = DatabaseManager.fetchViolationSurcharge("MINOR") * profile.MinorViolations
    var accidentSurcharge = DatabaseManager.fetchViolationSurcharge("ACCIDENT") * profile.AtFaultAccidents
    
    // 3. Compute final premium
    var basePremium = (collBase + liabBase) * ageFactor * vehicleFactor
    var totalPremium = basePremium + majorSurcharge + minorSurcharge + accidentSurcharge
    
    // 4. Persist audit trail to quote_history table
    DatabaseManager.persistQuote(profile, totalPremium)
    
    return totalPremium
  }
}