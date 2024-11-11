function callLeadTimeAPIV2AndPoll(){
  var results = callLeadTimeAPIV2();
  writeLeadTimeResultsToSheet(results);
}

function writeLeadTimeResultsToSheet(results) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Utilise the relevant sheet in the list to target for data insertion
  var sheet = ss.getSheets()[1]; // TODO: Ensure this marries up with the scaffolded sheet for this data
 
  var CIJobName = "<CIJobName>" // TODO: Make sure this matches the CI Job Name at the end of your pipeline to try the 'end' state
  var environment = results["Environments"].find(x => x["EnvironmentName"] === CIJobName) 

  // Combine date with converted mean, max, and min values in DD:HH:MM format
  var combinedDataPoints = environment["MeanTimeLeadTimeForChanges"].map((x, index) => ({
      date: new Date(x["Date"]),
      mean: convertTimeSpanToDDHHMM(x["Value"]),
      max: convertTimeSpanToDDHHMM(environment["MaxTimeLeadTimeForChanges"][index]["Value"]),
      min: convertTimeSpanToDDHHMM(environment["MinTimeLeadTimeForChanges"][index]["Value"])
  }));

  // Sort combinedDataPoints by date
  combinedDataPoints.sort((a, b) => a.date - b.date);
  // Split back out into separate arrays after sorting
  var meanDataPoints = combinedDataPoints.map(x => [x.date, x.mean]);
  var maxDataPoints = combinedDataPoints.map(x => [x.max]);
  var minDataPoints = combinedDataPoints.map(x => [x.min]);
  // Now, meanDataPoints, maxDataPoints, and minDataPoints are in the same order and can be pushed to the Google Sheet.

  sheet.getRange(5, 1, 500, 4).clearContent();
  // Clear existing contents and then add in the relevant date, mean, max and min data points that have been ordered above
  sheet.getRange(5, 1, meanDataPoints.length, 2).setValues(meanDataPoints);
  sheet.getRange(5, 3, meanDataPoints.length, 1).setValues(maxDataPoints);
  sheet.getRange(5, 4, meanDataPoints.length, 1).setValues(minDataPoints);

  var now = new Date();
  // Write the current date and time to cell B2 to see last update
  sheet.getRange("B2").setValue(now);
}

function callLeadTimeAPIV2() {
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

  var PipelineID = "YYYYYY" // TODO: Replace the GUID representing the PipelineID, grabbed from the URL
  // Aggregated Weekly for the last X timeframe noted above
  var operationStartResponse = UrlFetchApp.fetch("https://api.gearset.com/public/reporting/lead-time/" + PipelineID + "/aggregate?StartDate=" + startDate
   + "&EndDate=" + endDate + "&Interval=Weekly", {... options, 'method': 'post'});

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
// Function to convert the C# TimeStamp format into a usable DD:HH:MM format we can split further and Sheets can understand
function convertTimeSpanToDDHHMM(timeSpan) {
    let days = 0, hours = 0, minutes = 0, seconds = 0;

    // Check if there's a dot and the first two characters aren't "00"
    if (timeSpan.includes(".") && timeSpan.substring(0, 2) !== "00") {
        // Format: d.hh:mm:ss.fffffff
        let [daysHours, rest] = timeSpan.split(":");
        [days, hours] = daysHours.split(".").map(part => parseInt(part, 10));
        minutes = parseInt(rest.split(":")[0], 10);
        seconds = parseFloat(rest.split(":")[1]); // Includes milliseconds if present
    } else {
        // Format: hh:mm:ss.fffffff
        let parts = timeSpan.split(":");
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
        seconds = parseFloat(parts[2]); // Includes milliseconds if present
    }

    // Round minutes based on seconds if necessary
    if (seconds >= 30) minutes += 1;

    // Format result as DD:HH:MM
    let parsedDuration = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Log the original and converted durations
    Logger.log(`Original: ${timeSpan} -> Converted: ${parsedDuration}`);

    return parsedDuration;
}