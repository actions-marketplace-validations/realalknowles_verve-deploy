import AWS from 'aws-sdk'
import core from '@actions/core'
import AdmZip from 'adm-zip'

const accessKeyId = core.getInput('aws-access-key-id')
const secretAccessKey = core.getInput('aws-secret-access-key')
const assumeRoleArn = core.getInput('assume-role-arn')
const functionName = core.getInput('function-name')

function run() {
    const regions = core.getInput('aws-regions').split(',')
    regions.forEach(region => deploy(region).then(() => console.log(`Deployed ${functionName} to ${region}`)))
}

async function deploy(region) {
    const setup =
        await Promise.all([
            zipSource(),
            createSession(region)
        ])

    const source = setup[0]
    const session = setup[1]
    const lambda = createLambdaClient(session)

    await Promise.all([
        updateFunctionCode(lambda, source),
        updateFunctionConfiguration(lambda)
    ])
}

async function zipSource() {
    const zip = new AdmZip(undefined, {})
    zip.addLocalFolder('./src')
    return zip.toBufferPromise()
}

async function createSession(region) {
    const sts = new AWS.STS({
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
        region: region
    })

    return sts.assumeRole({
        RoleArn: assumeRoleArn,
        RoleSessionName: `deploy-${functionName}-${region}`,
        DurationSeconds: 600
    }).promise()
}

function createLambdaClient(session) {
    return new AWS.Lambda({
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

async function updateFunctionCode(lambda, source) {
    return lambda.updateFunctionCode({
        FunctionName: functionName,
        Publish: false,
        ZipFile: source,
    }).promise()
}

async function updateFunctionConfiguration(lambda) {
    return lambda.updateFunctionConfiguration({
        Handler: 'function.handler'
    }).promise()
}

run()