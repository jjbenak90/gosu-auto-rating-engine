package rateengine.model

class PolicyRiskProfile {
  var _territoryCode : String as TerritoryCode
  var _driverAge : int as DriverAge
  var _gender : String as Gender
  var _completedDriverTraining : boolean as CompletedDriverTraining
  var _vehicleSymbol : int as VehicleSymbol
  var _vehicleValue : double as VehicleValue
  var _majorViolations : int as MajorViolations
  var _minorViolations : int as MinorViolations
  var _atFaultAccidents : int as AtFaultAccidents
  var _coverageLimit : int as CoverageLimit
}