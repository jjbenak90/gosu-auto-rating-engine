package rateengine.tables

class ActuarialRatingTables {

  private static property get TerritoryBaseRates() : Map<String, Double> {
    return {
      "68123" -> 320.00,
      "68102" -> 380.00,
      "68046" -> 280.00
    }
  }

  public static function getBaseLossCost(territoryCode : String, coverageType : String) : double {
    var base = TerritoryBaseRates.get(territoryCode) ?: 300.00
    switch (coverageType) {
      case "COLLISION": return base * 1.45
      case "COMPREHENSIVE": return base * 0.85
      case "LIABILITY": return base * 1.80
      default: return base
    }
  }

  public static function getDriverClassificationFactor(age : int, genderCode : String, trainingDiscount : boolean) : double {
    var factor = 1.00
    if (age < 19) factor = 2.10
    else if (age < 22) factor = 1.65
    else if (age < 25) factor = 1.30
    else if (age >= 65) factor = 1.05

    if (trainingDiscount and age < 25) {
      factor *= 0.90
    }
    return factor
  }

  public static function getVehicleSymbolFactor(symbol : int) : double {
    return 0.70 + (symbol * 0.025)
  }

  public static function getMVRViolationSurcharge(majorViolations : int, minorViolations : int) : double {
    return 1.0 + (majorViolations * 0.50) + (minorViolations * 0.15)
  }
}