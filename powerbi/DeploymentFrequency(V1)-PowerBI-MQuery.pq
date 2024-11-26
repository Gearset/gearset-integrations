let
    // Allow easy switching of the date dynamically to get the last 30 days, on an interval of 'daily' and grouped by TotalDeployments
    startDate = Date.ToText(Date.AddDays(Date.From(DateTime.LocalNow()), -30), "yyyy-MM-dd"),
    endDate = Date.ToText(Date.From(DateTime.LocalNow()), "yyyy-MM-dd"),
    urlWithoutDates = "https://api.gearset.com/public/reporting/deployment-frequency/aggregate" &
        "?StartDate={StartDate}T00%3A00%3A00.0000000Z" &
        "&EndDate={EndDate}T00%3A00%3A00.0000000Z" &
        "&Interval=Daily&GroupBy=TotalDeploymentCount",
    url = Text.Replace(Text.Replace(urlWithoutDates, "{StartDate}", startDate), "{EndDate}", endDate),
    gearsetApiToken = "<YourAPITokenHere>", // TODO: Replace this with your Gearset API Token
    headers = [ #"Authorization" = "token " & gearsetApiToken],
    result = Json.Document(Web.Contents(url, [Headers = headers])),
    Items = result[Items],
    Items1 = Items{0},
    #"Converted to Table" = Record.ToTable(Items1),
    #"Filtered Rows" = Table.SelectRows(#"Converted to Table", each ([Value] <> "count")),
    #"Expanded Value" = Table.ExpandListColumn(#"Filtered Rows", "Value"),
    #"Expanded Value1" = Table.ExpandRecordColumn(#"Expanded Value", "Value", {"Date", "Value"}, {"Date", "Value.1"}),
    #"Renamed Columns" = Table.RenameColumns(#"Expanded Value1",{{"Value.1", "Deployments"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns",{"Name"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Columns",{{"Date", type datetime}, {"Deployments", Int64.Type}})
in
    #"Changed Type"