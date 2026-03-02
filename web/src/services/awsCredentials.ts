import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts'

const AWS_REGION = 'eu-west-2'
const METADATA_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=sts.amazonaws.com'

interface CachedCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiry: Date
}

let cached: CachedCredentials | null = null

async function fetchGcpIdentityToken(): Promise<string> {
  const response = await fetch(METADATA_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) {
    throw new Error(`Metadata server returned ${response.status}`)
  }
  return response.text()
}

export async function getAwsCredentials(roleArn: string): Promise<{
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
} | null> {
  // Return cached creds if still valid for at least 5 more minutes
  if (cached && cached.expiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return cached
  }

  try {
    const webIdentityToken = await fetchGcpIdentityToken()

    const sts = new STSClient({ region: AWS_REGION })
    const response = await sts.send(
      new AssumeRoleWithWebIdentityCommand({
        RoleArn: roleArn,
        RoleSessionName: 'nakomis-status',
        WebIdentityToken: webIdentityToken,
      }),
    )

    const creds = response.Credentials
    if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken || !creds.Expiration) {
      throw new Error('Incomplete credentials from STS')
    }

    cached = {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
      expiry: creds.Expiration,
    }
    return cached
  } catch {
    // Not running in Cloud Run, or metadata server unavailable
    return null
  }
}
