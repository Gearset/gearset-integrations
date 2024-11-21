let
    startDate = "2024-01-20",            // TODO: Replace these dates with the range you want to grab the lead time aggregate for
    endDate = "2024-07-20",
    pipelineId = "<YourPipelineIDHere>", // TODO: Replace this with your PipelineID
    
    // URL template with placeholders for StartDate, EndDate, and PipelineId. Aggregating Weekly
    urlWithoutDates = "https://api.gearset.com/public/reporting/lead-time/{PipelineId}/aggregate" &
        "?StartDate={StartDate}T00%3A00%3A00.0000000Z" &
        "&EndDate={EndDate}T00%3A00%3A00.0000000Z" &
        "&Interval=Weekly",
    
    // Replace placeholders with actual values in one line
    url = Text.Replace(Text.Replace(Text.Replace(urlWithoutDates, "{PipelineId}", pipelineId), "{StartDate}", startDate), "{EndDate}", endDate),
    //TODO: Change this to your API token
    headers = [ #"Authorization" = "token XXXXXX"],
    result = Json.Document(Web.Contents(url, [Headers = headers])),
    Environments = result[Environments],
    Environments1 = Environments{0}, // This grabs the first environment in the list which should be your final org to track against
    MeanTimeLeadTimeForChanges = Environments1[MeanTimeLeadTimeForChanges],
    #"Converted to Table" = Table.FromList(MeanTimeLeadTimeForChanges, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"Date", "Value"}, {"Column1.Date", "Column1.Value"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded Column1", {{"Column1.Date", type datetime}, {"Column1.Value", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type", {{"Column1.Date", "Date"}, {"Column1.Value", "MeanLeadTime"}}),

    // Define the function to convert DD.HH:MM:SS.MS or HH:MM:SS format to decimal days
    convertToDecimalDays = (timeSpan as text) as number =>
        let
            // Check if timeSpan starts with "00" (indicating hours only)
            startsWithZero = Text.Start(timeSpan, 2) = "00",

            // Split based on the format
            parts = if startsWithZero then Text.Split(timeSpan, ":") else Text.Split(timeSpan, "."),
            
            // If starts with "00", set days to 0 and extract hours and minutes
            days = if startsWithZero then 0 else Number.FromText(parts{0}),
            remainingTime = if startsWithZero then timeSpan else parts{1},

            // Split remaining time into hours, minutes, and seconds
            timeParts = Text.Split(remainingTime, ":"),
            hours = Number.FromText(timeParts{0}),
            minutes = Number.FromText(timeParts{1}),

            // Calculate decimal days
            decimalDays = days + (hours / 24) + (minutes / 1440),

            // Round to 2 decimal places
            roundedDecimalDays = Number.Round(decimalDays, 2)
        in
            roundedDecimalDays,

    // Add the DecimalDays column by applying the custom function and setting the data type to Fixed Decimal Number for charting
    #"Added Decimal Days" = Table.AddColumn(#"Renamed Columns", "DecimalDays", each convertToDecimalDays([MeanLeadTime]), type number),
    #"Converted to Fixed Decimal" = Table.TransformColumnTypes(#"Added Decimal Days", {{"DecimalDays", type number}})
in
    #"Converted to Fixed Decimal"