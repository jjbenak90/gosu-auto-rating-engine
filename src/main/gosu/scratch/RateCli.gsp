uses rateengine.ProductionAutoRatingEngine

function runCli(cliArgs : String[]) : String {
  ProductionAutoRatingEngine.main(cliArgs)
  return "DONE"
}

var defaultArgs = new String[] {
  "--territory=68123",
  "--age=72",
  "--symbol=8",
  "--major=0",
  "--minor=0",
  "--accidents=0",
  "--date=2026-11-20"
}

var envArgs = System.getenv("RATING_CLI_ARGS")
var effectiveArgs = (envArgs != null and envArgs.trim().length > 0)
  ? envArgs.split("\\|")
  : defaultArgs

runCli(effectiveArgs)