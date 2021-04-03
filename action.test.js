const action = require('./action.js')
const sinon = require('sinon')
const core = require('@actions/core')
const aws = require('aws-sdk')
const _ = require('underscore')
const assert = require('assert')

describe('Deployer', () => {
    afterEach(() => sinon.restore())
    it('should deploy the lambda', function () {
        let log = sinon.spy(console, 'info')
        sinon.stub(core, 'getInput').callsFake(input => {
            return input
        })

        sinon.stub(aws, 'STS').callsFake(properties => {
            return stubSts(properties);
        })

        sinon.stub(aws, 'Lambda').callsFake(properties => {
            return stubLambda(properties)
        })

        return action.run().then(ignore => {
            assert.strictEqual(log.getCall(0).args[0], 'Updating function: regions, function-name, function-source')
            assert.strictEqual(log.getCall(1).args[0], 'Updated function code: {"outcome":"success"}')
            assert.strictEqual(log.getCall(2).args[0], 'Updated function configuration: {"outcome":"success"}')
            assert.strictEqual(log.getCall(3).args[0], 'Deployed function-name to regions')
        })
    })
})

function stubSts(properties) {
    if (_.isEqual(properties, {
        region: 'regions',
        credentials: {
            accessKeyId: 'access-key-id',
            secretAccessKey: 'secret-access-key'
        }
    })) {
        return stubAssumeRole();
    }
}

function stubAssumeRole() {
    return {
        assumeRole: properties => {
            if (_.isEqual(properties, {
                RoleArn: 'assume-role-arn',
                RoleSessionName: 'deploy-function-name-regions',
                DurationSeconds: 1200
            })) {
                return stubResolveAssumeRole();
            }
        }
    }
}

function stubResolveAssumeRole() {
    return {
        promise: () => {
            return {
                Credentials: {
                    AccessKeyId: 'assumed-access-key-id',
                    SecretAccessKey: 'assumed-secret-access-key',
                    SessionToken: 'session-token'
                }
            }
        }
    }
}

function stubLambda(properties) {
    if (_.isEqual(properties, {
        maxRetries: 3,
        sslEnabled: true,
        logger: console,
        credentials: {
            accessKeyId: 'assumed-access-key-id',
            secretAccessKey: 'assumed-secret-access-key',
            sessionToken: 'session-token'
        },
        region: 'regions'
    })) {
        return stubUpdateFunction();
    }
}

function stubUpdateFunction() {
    return {
        updateFunctionCode: properties => {
            if (properties.FunctionName === 'function-name' && !properties.Publish && properties.ZipFile) {
                return stubResolveUpdateFunction();
            }
        },
        updateFunctionConfiguration: properties => {
            if (_.isEqual(properties, {
                Handler: 'function-handler'
            })) {
                return stubResolveUpdateFunction();
            }
        }
    }
}

function stubResolveUpdateFunction() {
    return {
        promise: () => {
            return {
                outcome: 'success'
            }
        }
    }
}