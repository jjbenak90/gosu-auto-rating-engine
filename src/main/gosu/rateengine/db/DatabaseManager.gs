package rateengine.db

uses java.sql.DriverManager
uses java.sql.Connection
uses java.sql.PreparedStatement
uses java.sql.ResultSet
uses rateengine.model.PolicyRiskProfile

class DatabaseManager {

  private static final var DB_URL = "jdbc:postgresql://localhost:5432/auto_rating_db"
  private static final var DB_USER = "postgres"
  private static final var DB_PASSWORD = "enchanter90!"

  public static function getConnection() : Connection {
    Class.forName("org.postgresql.Driver")
    return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)
  }

  public static function fetchBaseLossCost(territory : String, coverage : String) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT base_loss_cost FROM territory_base_rates WHERE territory_code = ? AND coverage_type = ?")
      stmt.setString(1, territory)
      stmt.setString(2, coverage)
      rs = stmt.executeQuery()

      if (rs.next()) {
        return rs.getDouble("base_loss_cost")
      }
      return 300.00 // Default fallback base rate
    } catch (e : Exception) {
      print("Database lookup error: ${e.Message}")
      return 300.00
    } finally {
      if (rs != null) rs.close()
      if (stmt != null) stmt.close()
      if (conn != null) conn.close()
    }
  }

  public static function persistQuote(risk : PolicyRiskProfile, finalPremium : double) {
    var conn : Connection = null
    var stmt : PreparedStatement = null

    try {
      conn = getConnection()
      var sql = "INSERT INTO quote_history (territory_code, driver_age, gender, driver_training, vehicle_symbol, vehicle_value, major_violations, minor_violations, at_fault_accidents, coverage_limit, total_premium) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      
      stmt = conn.prepareStatement(sql)
      stmt.setString(1, risk.TerritoryCode)
      stmt.setInt(2, risk.DriverAge)
      stmt.setString(3, risk.Gender)
      stmt.setBoolean(4, risk.CompletedDriverTraining)
      stmt.setInt(5, risk.VehicleSymbol)
      stmt.setDouble(6, risk.VehicleValue)
      stmt.setInt(7, risk.MajorViolations)
      stmt.setInt(8, risk.MinorViolations)
      stmt.setInt(9, risk.AtFaultAccidents)
      stmt.setInt(10, risk.CoverageLimit)
      stmt.setDouble(11, finalPremium)

      stmt.executeUpdate()
      print("[DB] Quote successfully persisted to PostgreSQL audit log.")
    } catch (e : Exception) {
      print("Database persistence error: ${e.Message}")
    } finally {
      if (stmt != null) stmt.close()
      if (conn != null) conn.close()
    }
  }
}