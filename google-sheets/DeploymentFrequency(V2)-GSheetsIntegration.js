function callDeploymentFrequencyAPIV2AndPoll(){
  var results = callDeploymentFrequencyAPIV2();
  writeDeploymentFrequencyResultsToSheet(results);
}

function writeDeploymentFrequencyResultsToSheet(results) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Utilise the relevant sheet in the list to target for data insertion
  var sheet = ss.getSheets()[0]; // TODO: Ensure this marries up with the scaffolded sheet for this data

  sheet.getRange(5, 1, 500, 2).clearContent();
  // Add in the values for date & deployments from row 5 onwards
  var dataPointsToPlot = results["Items"][0]["Values"].map(x => [new Date(x["Date"]), x["Value"]]);
  sheet.getRange(5, 1, dataPointsToPlot.length, 2).setValues(dataPointsToPlot);
  
  // Write the current date and time to cell B2 to see last update
  var now = new Date();
  sheet.getRange("B2").setValue(now);
}

function callDeploymentFrequencyAPIV2() {
  const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  var daysInThePast = 180 // TODO: Change this to say how far back to start the query from
  var today = new Date();
  var startDate = (new Date(today.getTime() - MILLIS_PER_DAY * daysInThePast)).toISOString(); // Uses daysInThePast to dynamically work out the start date
  var endDate = today.toISOString();
 
  var options = {
    'headers': {
      'Authorization': 'token XXXXXX', //TODO: Change this token
      'api-version': 2 // Specifies to use V2 instead of V1, meaning the request is async
    },
  }

  var operationStartResponse = UrlFetchApp.fetch("https://api.gearset.com/public/reporting/deployment-frequency/aggregate?StartDate=" + startDate
   + "&EndDate=" + endDate + "&Interval=Weekly&GroupBy=TotalDeploymentCount", {... options, 'method': 'post'});

  var operationStartJson = JSON.parse(operationStartResponse.getContentText());
  return pollOperationAndReturnResult(operationStartJson, options)
}

function pollOperationAndReturnResult(operationStartJson, options){
  var operationId = operationStartJson["OperationStatusId"];
  var operationStatus = operationStartJson["Status"];

  while (operationStatus == "Running"){
    Utilities.sleep(5000); // Checks every 5 seconds until we have the reply
    var operationStatusResponse = UrlFetchApp.fetch("https://api.gearset.com/public/operation/" + operationId + "/status",  options);
    var operationStatusJson = JSON.parse(operationStatusResponse.getContentText());
    operationStatus = operationStatusJson["Status"]
  }
  // Once we know the operation has completed, pass the ID into the result endpoint to grab the actual data
  var operationResultResponse = UrlFetchApp.fetch("https://api.gearset.com/public/operation/" + operationId + "/result",  options);

  return JSON.parse(operationResultResponse.getContentText());
}