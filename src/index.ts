import { ConvertService } from "./convert.service";
import { S3Event } from "./types";

export async function handler(event: {
    Records: { s3: S3Event }[];
}): Promise<any> {
    try {
        const s3Event = event.Records[0].s3
        const converter = new ConvertService(s3Event);
        await converter.handle();
    } catch (e) {
        console.error("[ERROR_HANDLER] : ", e);
    }
    return 0;
}
