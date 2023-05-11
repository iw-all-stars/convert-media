import { S3Event } from "./types";

export async function handler(event: {
    Records: { s3: S3Event }[];
}): Promise<any> {
    try {
        const s3Event = event.Records[0].s3
    } catch (e) {
        console.error("[ERROR] : ", e);
    }
    return 0;
}
