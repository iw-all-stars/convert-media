export interface S3Event {
    s3SchemaVersion: string
    configurationId: string
    bucket: Bucket
    object: Object
  }
  
  export interface Bucket {
    name: string
    ownerIdentity: OwnerIdentity
    arn: string
  }
  
  export interface OwnerIdentity {
    principalId: string
  }
  
  export interface Object {
    key: string
    size: number
    eTag: string
    sequencer: string
  }
  