# Getting DORA metrics with Reporting API v3

> In order to use Reporting API, you need an Access Token. You can find out how to get your own access token [here](https://docs.gearset.com/en/articles/6099550-creating-a-gearset-api-access-token).

> Pass your token as `Authorization: token <YOUR_TOKEN>` (the word `token` is part of the value), and send `Api-Version: 3` on every request to select the v3 API. The host is `https://api.gearset.com`; EU-hosted accounts should swap it for `https://eu.gearset.com` in the request URLs. **Change failure rate, Total bugs, Total bug fixes, and Mean time to restore** only return data when your team uses [change failure management](https://docs.gearset.com/en/articles/12449961-change-failure-management-bug-fixes).


## Prerequisites

- [**Node.js 18**](https://nodejs.org/en) or newer
- Reporting API access token. You can find out how to get it [here](https://docs.gearset.com/en/articles/6099550-creating-a-gearset-api-access-token).
- ID of your Pipeline
- ID of your Pipeline Environment that deploys to Production Salesforce org (needed for some metrics)

### Getting pipelines from API

You can use the `/reporting/pipelines` endpoint to get a list of all your Pipelines.

```javascript
const API_TOKEN = 'YOUR_API_ACCESS_TOKEN';

async function getPipelines() {
  const res = await fetch(
    `https://api.gearset.com/public/reporting/pipelines`,
    { headers: apiHeaders() }
  );
  return res.json();
}

// get pipelines and log result
const pipelines = await getPipelines();
console.log(pipelines);
```

### Getting environments from API

You can use the `/reporting/environments` endpoint to get a list of all your Pipeline environments. The one where `OrgLocationType` is `SalesforceProductionOrg` is considered a production environment.

```javascript
const API_TOKEN = 'YOUR_API_ACCESS_TOKEN';
const PIPELINE_ID = 'YOUR_PIPELINE_ID';

async function getEnvironments() {
  const res = await fetch(
    `https://api.gearset.com/public/reporting/environments?PipelineId=${PIPELINE_ID}`,
    { headers: apiHeaders() }
  );
  return res.json();
}

// get environments and log result
const environments = await getEnvironments();
console.log(environments);
```

## Run the complete sample

The full runnable script is [`dora-metrics.js`](./dora-metrics.js).

1. Open `api/reporting-api/v3/dora-metrics.js`.
2. Set these constants in the config section:
   - `API_TOKEN` (Gearset API access token)
   - `PIPELINE_ID`
   - `PRODUCTION_ENVIRONMENT_ID`
   - `START_DATE` and `END_DATE` in ISO UTC format (for example `2025-12-20T00:00:00.000Z`)
   - Optional tuning: `MAX_STATUS_CHECKS` and `STATUS_CHECK_INTERVAL_MS`
   - Optional host switch: `BASE_URL` (`https://api.gearset.com` by default, use `https://eu.gearset.com` for EU-hosted accounts)
3. Run the script:

```bash
node api/reporting-api/v3/dora-metrics.js
```

The script logs each API call, waits for the async reporting operation to complete, and then prints all DORA metric outputs.

## a) Retrieve deployments

The deployments endpoint is asynchronous: start the operation, poll the operation status until it completes, then fetch the result.

```javascript
const API_TOKEN = 'YOUR_API_ACCESS_TOKEN';
const PIPELINE_ID = 'YOUR_PIPELINE_ID';

// the window to analyse, in UTC (inclusive).
const START_DATE = '2026-04-01T00:00:00.000Z';
const END_DATE = '2026-04-30T23:59:59.999Z';

const apiHeaders = () => ({
  Authorization: `token ${API_TOKEN}`,
  'Api-Version': '3',
});

async function getDeployments() {
  const headers = apiHeaders();

  const params = new URLSearchParams({
    StartDate:  START_DATE,
    EndDate:    END_DATE,
    PipelineId: PIPELINE_ID,
  });

  // Step 1: start the operation
  const start = await fetch(
    `https://api.gearset.com/public/reporting/deployments?${params}`,
    { method: 'POST', headers }
  );
  const { OperationStatusId } = await start.json();

  // Step 2: poll the operation status until metrics finish loading
  let status = 'Running';
  while (status === 'Running') {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(
      `https://api.gearset.com/public/operation/${OperationStatusId}/status`,
      { headers }
    );
    status = (await statusRes.json()).Status;
  }

  // Step 3: retrieve the result
  const result = await fetch(
    `https://api.gearset.com/public/operation/${OperationStatusId}/result`,
    { headers }
  );
  return (await result.json()).Deployments;
}

const deployments = await getDeployments();
```

## b) Aggregate metrics

Each metric below assumes `deployments` is the array returned by `getDeployments()`. The shared helper functions and utils are defined once here; every metric snippet uses them.

These are also thresholds and filters which we use in DevOps performance. Feel free to tweak them according to your needs.

```javascript
const ms = s => new Date(s).valueOf();
const bugs = d => d.ReportedBugs || [];
const isQualifyingBug = b => Number(b.Severity) <= 2;
const isProduction = d => d.PipelineEnvironmentId === PRODUCTION_ENVIRONMENT_ID;
const isSuccessful = d => d.Status === 'Successful' || d.Status === 'PartiallySuccessful';
const isNonEmpty = d =>
  d.MetadataItemsInDeploymentCount +
  d.VlocityItemsInDeploymentCount +
  d.ConfigDataItemsInDeploymentCount > 0;

// Successful, production, non-empty deployments — the set most metrics use.
const baseSet = deployments =>
  deployments.filter(d => isSuccessful(d) && isProduction(d) && isNonEmpty(d));
```

### Total deployments

Count the base set (successful, production, non-empty deployments).

```javascript
const totalDeployments = baseSet(deployments).length;
```

### Average deployments per day

Divide the base-set count by the number of days in the configured period.

```javascript
const days = (ms(END_DATE) - ms(START_DATE)) / (1000 * 60 * 60 * 24);
const avgDeploymentsPerDay = baseSet(deployments).length / days;
```

### Deployment success rate

Ratio of successful to all production deployments, as a percentage. Uses raw production outcomes (no non-empty filter).

```javascript
const production = deployments.filter(isProduction);
const deploymentSuccessRate =
  production.filter(isSuccessful).length / production.length * 100;
```

### Successful deployments

Count production deployments whose status is `Successful` or `PartiallySuccessful`.

Note that partial success is only relevant to deployments that include both metadata and data. For example, CPQ, Vlocity, etc.
It indicates that the metadata part of the deployment was successfull, but the data part failed.
For more about the reasoning behind this see the note in our documentation [here](https://docs.gearset.com/en/articles/11560575-measuring-your-devops-performance#:~:text=be%20listed%20as%20%27-,partially%20successful,-%27%20in%20Gearset%20when)

```javascript
const successfulDeployments =
  deployments.filter(d => isSuccessful(d) && isProduction(d)).length;
```

### Failed deployments

Count production deployments whose status is not `Successful` or `PartiallySuccessful`.

```javascript
const failedDeployments =
  deployments.filter(d => !isSuccessful(d) && isProduction(d)).length;
```

### Lead time for changes

Flatten the base set down to one observation per merged feature PR, measure each PR's time from start point to deployment, and take the flat mean. Start point is `FirstCommitDate`; if any PR lacks it, the whole dataset falls back to `CreatedAt`. Unmerged PRs are excluded. Result is in milliseconds.

```javascript
const featurePRs = baseSet(deployments).flatMap(d =>
  d.DeploymentPullRequests
    .flatMap(dpr => dpr.FeaturePullRequests)
    .filter(pr => pr.MergedAt)
    .map(pr => ({ date: d.Date, pr }))
);

const useCreatedAt = featurePRs.some(({ pr }) => pr.FirstCommitDate == null);
const startOf = useCreatedAt ? pr => pr.CreatedAt : pr => pr.FirstCommitDate;

const deltas = featurePRs.map(({ date, pr }) => ms(date) - ms(startOf(pr)));
const leadTimeForChanges = deltas.reduce((a, b) => a + b, 0) / deltas.length;
```

### Change failure rate

Fraction of base-set deployments that carry at least one qualifying bug. Each deployment counts once. Result is 0..1.

```javascript
const set = baseSet(deployments);
const failed = set.filter(d => bugs(d).some(isQualifyingBug));
const changeFailureRate = failed.length / set.length;
```

### Total bugs

Flatten the base set down to bug level and count the qualifying bugs.

```javascript
const totalBugs =
  baseSet(deployments).flatMap(d => bugs(d).filter(isQualifyingBug)).length;
```

### Total bug fixes

Same as total bugs, but keep only qualifying bugs that have been resolved (`ResolvedAt` is set).

```javascript
const totalBugFixes = baseSet(deployments)
  .flatMap(d => bugs(d).filter(b => isQualifyingBug(b) && b.ResolvedAt))
  .length;
```

### Mean time to restore

A two-level mean. For each deployment with at least one resolved qualifying bug, average that deployment's restore times (resolved-time minus deployment-time); then average those per-deployment values. Result is in milliseconds.

```javascript
const perDeployment = baseSet(deployments)
  .map(d => ({ date: d.Date, fixed: bugs(d).filter(b => isQualifyingBug(b) && b.ResolvedAt) }))
  .filter(d => d.fixed.length > 0)
  .map(d => {
    const times = d.fixed.map(b => ms(b.ResolvedAt) - ms(d.date));
    return times.reduce((a, b) => a + b, 0) / times.length;
  });

const meanTimeToRestore =
  perDeployment.reduce((a, b) => a + b, 0) / perDeployment.length;
```
