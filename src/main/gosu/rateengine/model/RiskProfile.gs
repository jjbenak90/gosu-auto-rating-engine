package rateengine.model

class RiskProfile {
  var _driverAge : int as DriverAge
  var _vehicleValue : double as VehicleValue
  var _safetyRating : int as SafetyRating
  var _atFaultAccidents : int as AtFaultAccidents

  construct(age : int, value : double, rating : int, accidents : int) {
    _driverAge = age
    _vehicleValue = value
    _safetyRating = rating
    _atFaultAccidents = accidents
  }
}