import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds'
import { getAwsCredentials } from './awsCredentials'
import type { HeartbeatResult } from './heartbeat'

const AWS_REGION = 'eu-west-2'
const SSM_PARAM = '/nakomis-status/rds/analytics-instance-id'

const FAILED_STATES = [
  'failed',
  'inaccessible-encryption-credentials',
  'inaccessible-encryption-credentials-recoverable',
  'restore-error',
]

function mapRdsState(state: string | undefined): HeartbeatResult['status'] {
  if (!state) return 'unknown'
  if (state === 'stopped') return 'up'
  if (FAILED_STATES.includes(state)) return 'down'
  return 'warning'
}

export async function checkRdsStatus(service: string): Promise<HeartbeatResult> {
  const roleArn = process.env.AWS_READER_ROLE_ARN
  if (!roleArn) {
    return { service, url: '', status: 'unknown', detail: 'AWS_READER_ROLE_ARN not configured' }
  }

  const credentials = await getAwsCredentials(roleArn)
  if (!credentials) {
    return { service, url: '', status: 'unknown', detail: 'AWS credentials unavailable' }
  }

  const awsConfig = { region: AWS_REGION, credentials }

  try {
    const ssm = new SSMClient(awsConfig)
    const paramResponse = await ssm.send(new GetParameterCommand({ Name: SSM_PARAM }))
    const instanceId = paramResponse.Parameter?.Value
    if (!instanceId) {
      return { service, url: '', status: 'unknown', detail: 'SSM parameter missing' }
    }

    const rds = new RDSClient(awsConfig)
    const rdsResponse = await rds.send(
      new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }),
    )
    const state = rdsResponse.DBInstances?.[0]?.DBInstanceStatus

    return {
      service,
      url: '',
      status: mapRdsState(state),
      detail: state,
    }
  } catch (err) {
    return {
      service,
      url: '',
      status: 'down',
      detail: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
