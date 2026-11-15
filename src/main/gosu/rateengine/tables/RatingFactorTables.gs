package rateengine.tables

class RatingFactorTables {

  public static function getBaseRate(vehicleValue : double) : double {
    return vehicleValue * 0.025
  }

  public static function getAgeSurcharge(age : int) : double {
    if (age < 21) {
      return 1.45
    } else if (age >= 21 and age < 25) {
      return 1.20
    } else if (age >= 65) {
      return 1.10
    }
    return 1.00
  }

  public static function getAccidentSurcharge(accidents : int) : double {
    return 1.0 + (accidents * 0.25)
  }
}