const aws = require('aws-sdk')
const core = require('@actions/core')
const adm = require('adm-zip')

async function run() {
    const regions = core.getInput('regions').split(',')
    const accessKeyId = core.getInput('access-key-id')
    const secretAccessKey = core.getInput('secret-access-key')
    const assumeRoleArn = core.getInput('assume-role-arn')
    const functionName = core.getInput('function-name')
    const functionHandler = core.getInput('function-handler')
    const functionSource = core.getInput('function-source')

    return Promise.all(
        regions.map(region =>
            deploy(region, accessKeyId, secretAccessKey, assumeRoleArn, functionName, functionHandler, functionSource)
                .catch(error => handleDeploymentError(functionName, region, error))
                .then(ignore => handleDeploymentSuccess(functionName, region))))
}

async function deploy(
    region, accessKeyId, secretAccessKey, assumeRoleArn, functionName, functionHandler, functionSource) {
    console.info(`Updating function: ${region}, ${functionName}, ${functionSource}`)
    const setup =
        await Promise.all([
            zipSource(functionSource),
            createSession(region, accessKeyId, secretAccessKey, assumeRoleArn, functionName)
        ])

    const source = setup[0]
    const session = setup[1]
    const lambda = createLambdaClient(session)

    const outcome =
        await Promise.all([
            updateFunctionCode(lambda, functionName, source),
            updateFunctionConfiguration(lambda, functionHandler)
        ])

    console.info(`Updated function code: ${JSON.stringify(outcome[0])}`)
    console.info(`Updated function configuration: ${JSON.stringify(outcome[1])}`)
}

async function zipSource(functionSource) {
    const zip = new adm(undefined, {})
    zip.addLocalFolder(functionSource)
    return zip.toBufferPromise()
}

async function createSession(region, accessKeyId, secretAccessKey, assumeRoleArn, functionName) {
    const sts = new aws.STS({
        region: region,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    })

    return sts.assumeRole({
        RoleArn: assumeRoleArn,
        RoleSessionName: `deploy-${functionName}-${region}`,
        DurationSeconds: 1200
    }).promise()
}

function createLambdaClient(session) {
    return new aws.Lambda({
        maxRetries: 3,
        sslEnabled: true,
        logger: console,
        credentials: {
            accessKeyId: session.Credentials.AccessKeyId,
            secretAccessKey: session.Credentials.SecretAccessKey,
            sessionToken: session.Credentials.SessionToken
        }
    });
}

async function updateFunctionCode(lambda, functionName, source) {
    return lambda.updateFunctionCode({
        FunctionName: functionName,
        Publish: false,
        ZipFile: source,
    }).promise()
}

async function updateFunctionConfiguration(lambda, functionHandler) {
    return lambda.updateFunctionConfiguration({
        Handler: functionHandler
    }).promise()
}

function handleDeploymentError(functionName, region, error) {
    console.error(`Failed to deploy ${functionName} to ${region}`, error)
    process.exit(1)
}

function handleDeploymentSuccess(functionName, region) {
    console.info(`Deployed ${functionName} to ${region}`)
}

module.exports = {run}