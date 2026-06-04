// dora-metrics.js
// Calls the Gearset Reporting API (v3) and computes DORA metrics.
// Single-file version. Requires Node.js 18+ (built-in fetch). No dependencies.
//
// Fill in the four values below, then run: node dora-metrics.js

// --- Configuration -----------------------------------------------------
const API_TOKEN = 'YOUR_API_ACCESS_TOKEN';
const PIPELINE_ID = 'YOUR_PIPELINE_ID';
const PRODUCTION_ENVIRONMENT_ID = 'YOUR_PRODUCTION_ENVIRONMENT_ID';

// The window to analyse, in UTC (inclusive).
const START_DATE = '2026-04-01T00:00:00.000Z';
const END_DATE = '2026-04-30T23:59:59.999Z';

// Every request carries the token and selects the v3 API.
const apiHeaders = () => ({
  Authorization: `token ${API_TOKEN}`,
  'Api-Version': '3',
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- Optional: find your production environment ID ---------------------
// List the pipeline's environments; the one whose OrgLocationType is
// 'SalesforceProductionOrg' is production — use its Id as PRODUCTION_ENVIRONMENT_ID.
async function getEnvironments() {
  const res = await fetch(
    `https://api.gearset.com/public/reporting/environments?PipelineId=${PIPELINE_ID}`,
    { headers: apiHeaders() }
  );
  return res.json();
}

// --- a) Retrieve deployment info ---------------------------------------
// Asynchronous: start the operation, poll until it completes, fetch the result.
async function getDeployments() {
  const headers = apiHeaders();

  // Step 1: start the operation.
  const params = new URLSearchParams({
    StartDate:  START_DATE,
    EndDate:    END_DATE,
    PipelineId: PIPELINE_ID,
  });

  const start = await fetch(
    `https://api.gearset.com/public/reporting/deployments?${params}`,
    { method: 'POST', headers }
  );
  const { OperationStatusId } = await start.json();

  // Step 2: poll the operation status until it is no longer Running.
  let status = 'Running';
  while (status === 'Running') {
    await sleep(2000);
    const statusRes = await fetch(
      `https://api.gearset.com/public/operation/${OperationStatusId}/status`,
      { headers }
    );
    status = (await statusRes.json()).Status;
  }

  // Step 3: retrieve the result.
  const result = await fetch(
    `https://api.gearset.com/public/operation/${OperationStatusId}/result`,
    { headers }
  );
  return (await result.json()).Deployments;
}

// --- b) Metrics --------------------------------------------------------
const ms = s => new Date(s).valueOf();
const bugs = d => d.ReportedBugs || [];           // null means no bugs
const isQualifyingBug = b => Number(b.Severity) <= 2;
const isProduction = d => d.PipelineEnvironmentId === PRODUCTION_ENVIRONMENT_ID;
const isSuccessful = d => d.Status === 'Successful';
const isNonEmpty = d =>
  d.MetadataItemsInDeploymentCount +
  d.VlocityItemsInDeploymentCount +
  d.ConfigDataItemsInDeploymentCount > 0;

// Successful, production, non-empty deployments — the set the metrics use.
const baseSet = deployments =>
  deployments.filter(d => isSuccessful(d) && isProduction(d) && isNonEmpty(d));

const daysInPeriod = () =>
  (ms(END_DATE) - ms(START_DATE)) / (1000 * 60 * 60 * 24);

// 1) Total deployments
const totalDeployments = d => baseSet(d).length;

// 2) Average deployments per day
const avgDeploymentsPerDay = d => baseSet(d).length / daysInPeriod();

// 3) Deployment success rate (%)
function deploymentSuccessRate(deployments) {
  const production = deployments.filter(isProduction);
  return production.filter(isSuccessful).length / production.length * 100;
}

// 4) Successful deployments
const successfulDeployments = d =>
  d.filter(x => isSuccessful(x) && isProduction(x)).length;

// 5) Failed deployments
const failedDeployments = d =>
  d.filter(x => !isSuccessful(x) && isProduction(x)).length;

// 6) Lead time for changes (ms) — averaged across all merged feature PRs.
// Prefer FirstCommitDate; if any PR lacks it, use CreatedAt for all.
function leadTimeForChanges(deployments) {
  const featurePRs = baseSet(deployments).flatMap(d =>
    d.DeploymentPullRequests
      .flatMap(dpr => dpr.FeaturePullRequests)
      .filter(pr => pr.MergedAt)
      .map(pr => ({ date: d.Date, pr }))
  );

  const useCreatedAt = featurePRs.some(({ pr }) => pr.FirstCommitDate == null);
  const startOf = useCreatedAt ? pr => pr.CreatedAt : pr => pr.FirstCommitDate;

  const observations = featurePRs.map(({ date, pr }) => ms(date) - ms(startOf(pr)));
  return observations.reduce((a, b) => a + b, 0) / observations.length;
}

// 7) Change failure rate (0..1)
function changeFailureRate(deployments) {
  const set = baseSet(deployments);
  const failed = set.filter(d => bugs(d).some(isQualifyingBug));
  return failed.length / set.length;
}

// 8) Total bugs
const totalBugs = d =>
  baseSet(d).flatMap(x => bugs(x).filter(isQualifyingBug)).length;

// 9) Total bug fixes (qualifying bugs that have been resolved)
const totalBugFixes = d =>
  baseSet(d).flatMap(x => bugs(x).filter(b => isQualifyingBug(b) && b.ResolvedAt)).length;

// 10) Mean time to restore (ms) — average restore time per deployment,
// then average across deployments that had a qualifying fix.
function meanTimeToRestore(deployments) {
  const perDeployment = baseSet(deployments)
    .map(d => ({ date: d.Date, fixed: bugs(d).filter(b => isQualifyingBug(b) && b.ResolvedAt) }))
    .filter(d => d.fixed.length > 0)
    .map(d => {
      const times = d.fixed.map(b => ms(b.ResolvedAt) - ms(d.date));
      return times.reduce((a, b) => a + b, 0) / times.length;
    });
  return perDeployment.reduce((a, b) => a + b, 0) / perDeployment.length;
}

const msToHours = m => m / (1000 * 60 * 60);
const msToDays  = m => m / (1000 * 60 * 60 * 24);

// --- Run everything ----------------------------------------------------
async function main() {
  const d = await getDeployments();
  console.log('Total deployments:       ', totalDeployments(d));
  console.log('Avg deployments per day: ', avgDeploymentsPerDay(d).toFixed(2));
  console.log('Deployment success rate: ', deploymentSuccessRate(d).toFixed(1) + '%');
  console.log('Successful deployments:  ', successfulDeployments(d));
  console.log('Failed deployments:      ', failedDeployments(d));
  console.log('Lead time for changes:   ', msToDays(leadTimeForChanges(d)).toFixed(2) + ' days');
  console.log('Change failure rate:     ', (changeFailureRate(d) * 100).toFixed(1) + '%');
  console.log('Total bugs:              ', totalBugs(d));
  console.log('Total bug fixes:         ', totalBugFixes(d));
  console.log('Mean time to restore:    ', msToHours(meanTimeToRestore(d)).toFixed(1) + ' hours');
}

main();
