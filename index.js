import AWS from 'aws-sdk'
import core from '@actions/core'

const accessKeyId = core.getInput('aws-access-key-id')
const secretAccessKey = core.getInput('aws-secret-access-key')
const assumeRoleArn = core.getInput('assume-role-arn')
const functionName = core.getInput('function-name')

const regions = core.getInput('aws-regions').split(',')
regions.forEach(region => deploy(region).then(() => console.log(`Deployed ${functionName} to ${region}`)))

async function deploy(region) {
    const sts = getStsClient(region);
    const session = await createSession(sts, region);
}

function getStsClient(region) {
    return new AWS.STS({
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
        region: region
    })
}

async function createSession(sts, region) {
    return sts.assumeRole({
        RoleArn: assumeRoleArn,
        RoleSessionName: `deploy-${functionName}-${region}`,
        DurationSeconds: 600
    }).promise()
}