package rateengine.model

uses java.math.BigDecimal

class RatingStep {
  var _stepOrder : int as StepOrder
  var _stepName : String as StepName
  var _operand : BigDecimal as Operand
  var _runningTotal : BigDecimal as RunningTotal
  var _notes : String as Notes

  construct(order : int, name : String, operand : BigDecimal, runningTotal : BigDecimal, notes : String) {
    _stepOrder = order
    _stepName = name
    _operand = operand
    _runningTotal = runningTotal
    _notes = notes
  }

  override function toString() : String {
    return "[Step ${StepOrder}] ${StepName}: ${Operand} -> Running Total: $${RunningTotal} (${Notes})"
  }
}